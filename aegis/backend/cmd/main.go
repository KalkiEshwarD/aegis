package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/99designs/gqlgen/graphql/handler"
	"github.com/99designs/gqlgen/graphql/playground"
	"github.com/gin-gonic/gin"
	"github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/credentials"
	"github.com/vektah/gqlparser/v2/gqlerror"

	"github.com/balkanid/aegis-backend/graph"
	"github.com/balkanid/aegis-backend/graph/generated"
	"github.com/balkanid/aegis-backend/internal/config"
	"github.com/balkanid/aegis-backend/internal/database"
	apperrors "github.com/balkanid/aegis-backend/internal/errors"
	"github.com/balkanid/aegis-backend/internal/handlers"
	"github.com/balkanid/aegis-backend/internal/middleware"
	"github.com/balkanid/aegis-backend/internal/services"
)

func main() {
	// Load configuration
	cfg := config.Load()

	// Set Gin mode
	gin.SetMode(cfg.GinMode)

	// Initialize database
	db := &database.DB{}
	if err := db.Connect(cfg); err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer db.Close()

	// Run migrations
	// Commented out due to GORM compatibility issues
	// if err := db.AutoMigrate(); err != nil {
	// 	log.Printf("Warning: Failed to run migrations: %v", err)
	// 	// Don't fatal for now, continue with existing schema
	// }

	// Initialize services
	// Initialize MinIO client
	var minioClient *minio.Client
	var bucketName string
	if cfg.MinIOEndpoint != "" && cfg.MinIOAccessKey != "" && cfg.MinIOSecretKey != "" && cfg.MinIOBucket != "" {
		var err error
		minioClient, err = minio.New(cfg.MinIOEndpoint, &minio.Options{
			Creds:  credentials.NewStaticV4(cfg.MinIOAccessKey, cfg.MinIOSecretKey, ""),
			Secure: false, // Use HTTP for local development
		})
		if err != nil {
			log.Fatalf("Failed to initialize MinIO client: %v", err)
		}
		bucketName = cfg.MinIOBucket
	}

	fileStorageService := services.NewFileStorageService(minioClient, bucketName)

	authService := services.NewAuthService(cfg)
	storageService := services.NewStorageService(cfg, db, fileStorageService, authService)
	userService := services.NewUserService(authService, db)
	roomService := services.NewRoomService(db)
	adminService := services.NewAdminService(db)
	folderService := services.NewFolderService(db)
	passwordShareService := services.NewPasswordShareService(db)
	shareLinkService := services.NewShareLinkService(db, cfg.BaseURL)
	shareAccessService := services.NewShareAccessService(db)

	// Initialize handlers
	fileHandler := handlers.NewFileHandler(storageService, authService)

	// Initialize GraphQL resolver
	resolver := &graph.Resolver{
		StorageService:       storageService,
		UserService:          userService,
		RoomService:          roomService,
		AdminService:         adminService,
		FolderService:        folderService,
		PasswordShareService: passwordShareService,
		ShareLinkService:     shareLinkService,
		ShareAccessService:   shareAccessService,
	}

	// Create GraphQL server with custom error handling
	srv := handler.NewDefaultServer(generated.NewExecutableSchema(generated.Config{Resolvers: resolver}))

	// Add custom error presenter to include error codes in GraphQL responses
	srv.SetErrorPresenter(func(ctx context.Context, err error) *gqlerror.Error {
		// Check if it's our custom error type
		if customErr, ok := err.(*apperrors.Error); ok {
			return &gqlerror.Error{
				Message: customErr.Message,
				Extensions: map[string]interface{}{
					"code": string(customErr.Code),
				},
			}
		}

		// For other errors, return standard format
		return &gqlerror.Error{
			Message: err.Error(),
			Extensions: map[string]interface{}{
				"code": "unknown_error",
			},
		}
	})

	// Initialize Gin router
	r := gin.Default()

	// Add security headers middleware
	r.Use(middleware.SecurityHeaders())

	// Add CORS middleware
	r.Use(middleware.CORS(cfg.CORSAllowedOrigins))

	// Add error handling middleware
	r.Use(middleware.ErrorHandler())

	// Health check endpoint
	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"status":    "healthy",
			"timestamp": time.Now(),
		})
	})

	// GraphQL playground (only in development)
	if cfg.GinMode == "debug" {
		r.GET("/", gin.WrapH(playground.Handler("GraphQL playground", "/graphql")))
	}

	// GraphQL endpoint with authentication middleware
	r.POST("/graphql", middleware.AuthMiddleware(cfg, authService, db), func(c *gin.Context) {
		// Add gin context to GraphQL context (preserve existing context values)
		ctx := context.WithValue(c.Request.Context(), "gin", c)
		c.Request = c.Request.WithContext(ctx)
		srv.ServeHTTP(c.Writer, c.Request)
	})
	r.GET("/graphql", middleware.AuthMiddleware(cfg, authService, db), func(c *gin.Context) {
		// Add gin context to GraphQL context (preserve existing context values)
		ctx := context.WithValue(c.Request.Context(), "gin", c)
		c.Request = c.Request.WithContext(ctx)
		srv.ServeHTTP(c.Writer, c.Request)
	})

	// File download endpoint (authentication handled in handler)
	r.GET("/api/files/:id/download", middleware.ShareSecurityHeaders(), fileHandler.DownloadFile)

	// Serve shared static files (like error-codes.json and validation-rules.json)
	r.Static("/shared", "/app/shared")

	// Start server
	port := cfg.Port
	server := &http.Server{
		Addr:    ":" + port,
		Handler: r,
	}

	// Graceful shutdown
	go func() {
		log.Printf("Server starting on port %s", port)
		log.Printf("GraphQL playground available at http://localhost:%s/", port)
		log.Printf("GraphQL endpoint available at http://localhost:%s/graphql", port)

		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Failed to start server: %v", err)
		}
	}()

	// Wait for interrupt signal to gracefully shutdown the server
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	log.Println("Shutting down server...")

	// Give outstanding requests a deadline to complete
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if err := server.Shutdown(ctx); err != nil {
		log.Fatalf("Server forced to shutdown: %v", err)
	}

	log.Println("Server exited")
}
