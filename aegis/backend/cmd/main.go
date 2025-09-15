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

	"github.com/balkanid/aegis-backend/graph"
	"github.com/balkanid/aegis-backend/graph/generated"
	"github.com/balkanid/aegis-backend/internal/config"
	"github.com/balkanid/aegis-backend/internal/database"
	"github.com/balkanid/aegis-backend/internal/middleware"
	"github.com/balkanid/aegis-backend/internal/services"
)

func main() {
	// Load configuration
	cfg := config.Load()

	// Set Gin mode
	gin.SetMode(cfg.GinMode)

	// Initialize database
	if err := database.Connect(cfg); err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer database.Close()

	// Run migrations
	if err := database.AutoMigrate(); err != nil {
		log.Fatalf("Failed to run migrations: %v", err)
	}

	// Initialize services
	fileService := services.NewFileService(cfg)
	userService := services.NewUserService(cfg)
	roomService := services.NewRoomService()
	adminService := services.NewAdminService()

	// Initialize GraphQL resolver
	resolver := &graph.Resolver{
		FileService:  fileService,
		UserService:  userService,
		RoomService:  roomService,
		AdminService: adminService,
	}

	// Create GraphQL server
	srv := handler.NewDefaultServer(generated.NewExecutableSchema(generated.Config{Resolvers: resolver}))

	// Initialize Gin router
	r := gin.Default()

	// Add CORS middleware
	r.Use(middleware.CORS())

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
	r.POST("/graphql", middleware.AuthMiddleware(cfg), gin.WrapH(srv))
	r.GET("/graphql", middleware.AuthMiddleware(cfg), gin.WrapH(srv))

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
