package main

import (
	"bytes"
	"context"
	"encoding/base64"
	"fmt"
	"html/template"
	"io"
	"log"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"strings"
	"syscall"
	"time"

	"github.com/99designs/gqlgen/graphql/handler"
	"github.com/99designs/gqlgen/graphql/playground"
	"github.com/gin-contrib/cors"
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
	"github.com/balkanid/aegis-backend/internal/models"
	"github.com/balkanid/aegis-backend/internal/services"
)

// ShareAccessTemplateData represents the data passed to the share access HTML template
type ShareAccessTemplateData struct {
	Token              string
	Filename           string
	MimeType           string
	SizeFormatted      string
	ExpiresAt          *time.Time
	ExpiresAtFormatted string
	MaxDownloads       int
	RemainingDownloads int
}

// formatFileSize formats bytes into human readable format
func formatFileSize(bytes int64) string {
	const unit = 1024
	if bytes < unit {
		return fmt.Sprintf("%d B", bytes)
	}
	div, exp := int64(unit), 0
	for n := bytes / unit; n >= unit; n /= unit {
		div *= unit
		exp++
	}
	return fmt.Sprintf("%.1f %cB", float64(bytes)/float64(div), "KMGTPE"[exp])
}

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

	// Initialize centralized crypto manager
	cryptoManager, err := services.NewCryptoManager()
	if err != nil {
		log.Fatalf("Failed to initialize crypto manager: %v", err)
	}

	authService := services.NewAuthService(cfg)
	fileService := services.NewFileService(cfg, db, fileStorageService, authService)
	userService := services.NewUserService(authService, db)
	roomService := services.NewRoomService(db)
	adminService := services.NewAdminService(db)
	shareService := services.NewShareService(db, cfg.BaseURL, cryptoManager)

	// Initialize handlers
	fileHandler := handlers.NewFileHandler(fileService, authService)

	// Initialize GraphQL resolver
	resolver := &graph.Resolver{
		FileService:   fileService,
		UserService:   userService,
		RoomService:   roomService,
		AdminService:  adminService,
		ShareService:  shareService,
		CryptoManager: cryptoManager,
	}

	// Create GraphQL server with custom error handling
	srv := handler.NewDefaultServer(generated.NewExecutableSchema(generated.Config{Resolvers: resolver}))

	// Add custom error presenter to include standardized error format in GraphQL responses
	srv.SetErrorPresenter(func(ctx context.Context, err error) *gqlerror.Error {
		// Check if it's our custom error type
		if customErr, ok := err.(*apperrors.Error); ok {
			apiError := customErr.ToAPIError()
			return &gqlerror.Error{
				Message: apiError.Message,
				Extensions: map[string]interface{}{
					"code":      apiError.Code,
					"timestamp": apiError.Timestamp,
					"details":   apiError.Details,
				},
			}
		}

		// For other errors, return standardized format
		apiError := &apperrors.APIError{
			Code:      "unknown_error",
			Message:   err.Error(),
			Timestamp: time.Now().UTC().Format(time.RFC3339),
		}
		return &gqlerror.Error{
			Message: apiError.Message,
			Extensions: map[string]interface{}{
				"code":      apiError.Code,
				"timestamp": apiError.Timestamp,
			},
		}
	})

	// Initialize Gin router
	r := gin.Default()

	// Add security headers middleware
	r.Use(middleware.SecurityHeaders())

	// Configure CORS middleware
	corsConfig := cors.DefaultConfig()
	if cfg.CORSAllowedOrigins == "*" {
		corsConfig.AllowAllOrigins = true
	} else {
		corsConfig.AllowOrigins = strings.Split(cfg.CORSAllowedOrigins, ",")
		// Trim spaces from origins
		for i, origin := range corsConfig.AllowOrigins {
			corsConfig.AllowOrigins[i] = strings.TrimSpace(origin)
		}
	}
	corsConfig.AllowCredentials = true
	corsConfig.AllowMethods = []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"}
	corsConfig.AllowHeaders = []string{"Content-Type", "Content-Length", "Accept-Encoding", "X-CSRF-Token", "Authorization", "accept", "origin", "Cache-Control", "X-Requested-With"}
	r.Use(cors.New(corsConfig))

	// Add rate limiting middleware
	r.Use(middleware.RateLimitMiddleware(cfg))

	// Add error handling middleware
	r.Use(middleware.ErrorHandler())

	// Health check endpoint
	r.GET(cfg.APIEndpoints.Health.Base, func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"status":    "healthy",
			"timestamp": time.Now(),
		})
	})

	// GraphQL playground (only in development)
	if cfg.GinMode == "debug" {
		r.GET("/", gin.WrapH(playground.Handler("GraphQL playground", "/graphql")))
	}

	// GraphQL routes group
	graphqlGroup := r.Group(cfg.APIEndpoints.GraphQL.Base)
	graphqlGroup.Use(middleware.AuthMiddleware(cfg, authService, db))
	{
		graphqlGroup.POST("", func(c *gin.Context) {
			// Add gin context to GraphQL context (preserve existing context values)
			ctx := context.WithValue(c.Request.Context(), "gin", c)
			c.Request = c.Request.WithContext(ctx)
			srv.ServeHTTP(c.Writer, c.Request)
		})
		graphqlGroup.GET("", func(c *gin.Context) {
			// Add gin context to GraphQL context (preserve existing context values)
			ctx := context.WithValue(c.Request.Context(), "gin", c)
			c.Request = c.Request.WithContext(ctx)
			srv.ServeHTTP(c.Writer, c.Request)
		})
	}

	// API routes group (authenticated endpoints)
	apiGroup := r.Group(cfg.APIEndpoints.Base)
	apiGroup.Use(middleware.AuthMiddleware(cfg, authService, db))
	{
		// File-related endpoints
		relativeFilesPath := strings.TrimPrefix(cfg.APIEndpoints.Files.Base, cfg.APIEndpoints.Base)
		filesGroup := apiGroup.Group(relativeFilesPath)
		{
			filesGroup.GET("/:id/download", middleware.ShareSecurityHeaders(), fileHandler.DownloadFile)
		}
	}

	// Share routes group (public endpoints for file sharing)
	shareGroup := r.Group(cfg.APIEndpoints.Share.Base)
	{
		shareGroup.GET("/:token", func(c *gin.Context) {
			token := c.Param("token")

			// Get share metadata
			metadata, err := shareService.GetShareMetadata(token)
			if err != nil {
				c.JSON(http.StatusNotFound, gin.H{"error": "Share not found"})
				return
			}

			// Prepare template data
			templateData := ShareAccessTemplateData{
				Token:              metadata.Token,
				Filename:           metadata.Filename,
				MimeType:           metadata.MimeType,
				SizeFormatted:      formatFileSize(metadata.SizeBytes),
				ExpiresAt:          metadata.ExpiresAt,
				MaxDownloads:       metadata.MaxDownloads,
				RemainingDownloads: metadata.MaxDownloads - metadata.DownloadCount,
			}

			if metadata.ExpiresAt != nil {
				templateData.ExpiresAtFormatted = metadata.ExpiresAt.Format("Jan 2, 2006 at 3:04 PM")
			}

			// Load and parse template
			templatePath := filepath.Join("templates", "share_access.html")
			tmpl, err := template.ParseFiles(templatePath)
			if err != nil {
				log.Printf("Error parsing template: %v", err)
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Template error"})
				return
			}

			// Render template
			var buf bytes.Buffer
			if err := tmpl.Execute(&buf, templateData); err != nil {
				log.Printf("Error executing template: %v", err)
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Template execution error"})
				return
			}

			c.Header("Content-Type", "text/html")
			c.String(http.StatusOK, buf.String())
		})

		shareGroup.POST("/:token/access", func(c *gin.Context) {
			token := c.Param("token")

			var req struct {
				Password string `json:"password" binding:"required"`
			}

			if err := c.ShouldBindJSON(&req); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Password is required"})
				return
			}

			// Validate share and decrypt file key
			fileShare, err := shareService.ValidateShareToken(token)
			if err != nil {
				c.JSON(http.StatusNotFound, gin.H{"error": "Share not found"})
				return
			}

			_, err = shareService.DecryptFileKey(fileShare, req.Password)
			if err != nil {
				c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid password"})
				return
			}

			// Generate download URL
			downloadPath := strings.Replace(cfg.APIEndpoints.Files.Download, ":id", fmt.Sprintf("%d", fileShare.UserFileID), 1)
			downloadURL := fmt.Sprintf("%s?share_token=%s&password=%s",
				downloadPath, token, req.Password)

			c.JSON(http.StatusOK, gin.H{"downloadUrl": downloadURL})
		})

		// Direct download endpoint for shared files
		shareGroup.GET("/:token/download", func(c *gin.Context) {
			token := c.Param("token")
			password := c.Query("password")
			keyParam := c.Query("key")

			if password == "" && keyParam == "" {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Password or decryption key is required"})
				return
			}

			// Validate share token
			fileShare, err := shareService.ValidateShareToken(token)
			if err != nil {
				c.JSON(http.StatusNotFound, gin.H{"error": "Share not found"})
				return
			}

			// Get user file info for filename and encryption key
			var userFile models.UserFile
			if err := shareService.GetDB().GetDB().Preload("File").Where("id = ?", fileShare.UserFileID).First(&userFile).Error; err != nil {
				c.JSON(http.StatusNotFound, gin.H{"error": "File not found"})
				return
			}

			// Get the file encryption key. For shared files, this must be decrypted
			// using the password provided for the share.
			var fileKey []byte
			if keyParam != "" {
				// If a raw key is provided (e.g., from passwordless share), decode and use it
				var err error
				fileKey, err = base64.StdEncoding.DecodeString(keyParam)
				if err != nil {
					c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid key format"})
					return
				}
			} else {
				// If password is provided, use it to decrypt the file key stored in the share
				var err error
				fileKey, err = shareService.DecryptFileKey(fileShare, password)
				if err != nil {
					c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid password"})
					return
				}
			}

			if len(fileKey) == 0 {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to obtain file key"})
				return
			}

			// Get the encrypted file content
			reader, mimeType, err := fileService.StreamFile(userFile.UserID, fileShare.UserFileID)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get file"})
				return
			}
			defer reader.Close()

			// Read encrypted content
			encryptedData, err := io.ReadAll(reader)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to read file"})
				return
			}

			// Decrypt the file content using the centralized crypto manager
			decryptedData, err := cryptoManager.DecryptFileWithNoncePrefix(encryptedData, fileKey)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to decrypt file"})
				return
			}

			// Increment download count
			shareService.IncrementDownloadCount(fileShare.ID)

			// Set headers for download
			c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s\"", userFile.Filename))
			c.Header("Content-Type", mimeType)
			c.Header("Cache-Control", "no-cache, no-store, must-revalidate")
			c.Header("Pragma", "no-cache")
			c.Header("Expires", "0")
			c.Header("Content-Length", fmt.Sprintf("%d", len(decryptedData)))

			// Send the decrypted file
			c.Data(http.StatusOK, mimeType, decryptedData)
		})
	}

	// Shared dashboard endpoint - serve React app with shared view
	r.GET(cfg.APIEndpoints.Shared.Base, func(c *gin.Context) {
		// Redirect to frontend shared view
		c.Redirect(302, "http://localhost:3000/shared")
	})

	// Serve shared static files (like error-codes.json and validation-rules.json)
	r.Static(cfg.APIEndpoints.Shared.Base, "/app/shared")

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
		log.Printf("GraphQL endpoint available at http://localhost:%s%s", port, cfg.APIEndpoints.GraphQL.Base)

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
