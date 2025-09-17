package integration

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"time"

	"github.com/99designs/gqlgen/graphql/handler"
	"github.com/gin-gonic/gin"
	"github.com/machinebox/graphql"

	"github.com/balkanid/aegis-backend/graph"
	"github.com/balkanid/aegis-backend/graph/generated"
	"github.com/balkanid/aegis-backend/internal/config"
	"github.com/balkanid/aegis-backend/internal/middleware"
	"github.com/balkanid/aegis-backend/internal/services"
)

// TestGraphQLServer represents a test GraphQL server
type TestGraphQLServer struct {
	Server *httptest.Server
	Client *graphql.Client
	Config *config.Config
}

// NewTestGraphQLServer creates a new test GraphQL server
func NewTestGraphQLServer(cfg *config.Config) *TestGraphQLServer {
	// Set Gin to test mode
	gin.SetMode(gin.TestMode)

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

	// GraphQL endpoint with authentication middleware
	r.POST("/graphql", middleware.AuthMiddleware(cfg), gin.WrapH(srv))
	r.GET("/graphql", middleware.AuthMiddleware(cfg), gin.WrapH(srv))

	// Create test server
	testServer := httptest.NewServer(r)

	// Create GraphQL client
	client := graphql.NewClient(testServer.URL + "/graphql")

	return &TestGraphQLServer{
		Server: testServer,
		Client: client,
		Config: cfg,
	}
}

// Close shuts down the test server
func (t *TestGraphQLServer) Close() {
	t.Server.Close()
}

// SetAuthToken sets the authorization header for authenticated requests
func (t *TestGraphQLServer) SetAuthToken(token string) {
	t.Client.Log = func(s string) {} // Disable logging for tests

	// Note: machinebox/graphql doesn't have WithHeader method
	// Headers need to be set on individual requests
}

// MakeRequest executes a GraphQL query/mutation
func (t *TestGraphQLServer) MakeRequest(ctx context.Context, query string, variables map[string]interface{}, response interface{}) error {
	req := graphql.NewRequest(query)
	if variables != nil {
		for key, value := range variables {
			req.Var(key, value)
		}
	}

	// Set timeout for request
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	if err := t.Client.Run(ctx, req, response); err != nil {
		return fmt.Errorf("GraphQL request failed: %w", err)
	}

	return nil
}

// MakeAuthenticatedRequest executes an authenticated GraphQL query/mutation
func (t *TestGraphQLServer) MakeAuthenticatedRequest(ctx context.Context, token string, query string, variables map[string]interface{}, response interface{}) error {
	// Create a new client for this request
	client := graphql.NewClient(t.Server.URL + "/graphql")

	req := graphql.NewRequest(query)
	if variables != nil {
		for key, value := range variables {
			req.Var(key, value)
		}
	}

	// Set authorization header
	req.Header.Set("Authorization", "Bearer "+token)

	// Set timeout for request
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	if err := client.Run(ctx, req, response); err != nil {
		return fmt.Errorf("authenticated GraphQL request failed: %w", err)
	}

	return nil
}

// HealthCheck performs a health check on the test server
func (t *TestGraphQLServer) HealthCheck() error {
	resp, err := http.Get(t.Server.URL + "/health")
	if err != nil {
		return fmt.Errorf("health check failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("health check returned status %d", resp.StatusCode)
	}

	return nil
}