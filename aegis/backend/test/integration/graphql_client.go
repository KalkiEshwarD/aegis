package integration

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
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
	r.Use(middleware.CORS(cfg.CORSAllowedOrigins))

	// GraphQL endpoint with authentication middleware and gin context
	r.POST("/graphql", middleware.AuthMiddleware(cfg), func(c *gin.Context) {
		// Add gin context to GraphQL context
		ctx := context.WithValue(c.Request.Context(), "gin", c)
		c.Request = c.Request.WithContext(ctx)
		srv.ServeHTTP(c.Writer, c.Request)
	})
	r.GET("/graphql", middleware.AuthMiddleware(cfg), func(c *gin.Context) {
		// Add gin context to GraphQL context
		ctx := context.WithValue(c.Request.Context(), "gin", c)
		c.Request = c.Request.WithContext(ctx)
		srv.ServeHTTP(c.Writer, c.Request)
	})

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
	// Create request payload
	payload := map[string]interface{}{
		"query": query,
	}
	if variables != nil {
		payload["variables"] = variables
	}

	payloadBytes, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("failed to marshal GraphQL request: %w", err)
	}

	// Create HTTP request
	req, err := http.NewRequestWithContext(ctx, "POST", t.Server.URL+"/graphql", bytes.NewReader(payloadBytes))
	if err != nil {
		return fmt.Errorf("failed to create HTTP request: %w", err)
	}

	// Set headers
	req.Header.Set("Content-Type", "application/json")

	// Set timeout
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()
	req = req.WithContext(ctx)

	// Make HTTP request
	httpClient := &http.Client{}
	resp, err := httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("GraphQL request failed: %w", err)
	}
	defer resp.Body.Close()

	// Read response body
	respBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("failed to read response body: %w", err)
	}

	// Decode the response into the provided response struct
	// This allows GraphQL errors to be in response.Errors without returning a Go error
	fmt.Printf("DEBUG: Raw GraphQL response: %s\n", string(respBytes))
	if err := json.Unmarshal(respBytes, response); err != nil {
		fmt.Printf("DEBUG: Failed to unmarshal response: %v\n", err)
		return fmt.Errorf("failed to decode GraphQL response: %w", err)
	}
	fmt.Printf("DEBUG: Successfully unmarshaled response\n")

	return nil
}

// MakeAuthenticatedRequest executes an authenticated GraphQL query/mutation
func (t *TestGraphQLServer) MakeAuthenticatedRequest(ctx context.Context, token string, query string, variables map[string]interface{}, response interface{}) error {
	// Create request payload
	payload := map[string]interface{}{
		"query": query,
	}
	if variables != nil {
		payload["variables"] = variables
	}

	payloadBytes, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("failed to marshal GraphQL request: %w", err)
	}

	// Create HTTP request
	req, err := http.NewRequestWithContext(ctx, "POST", t.Server.URL+"/graphql", bytes.NewReader(payloadBytes))
	if err != nil {
		return fmt.Errorf("failed to create HTTP request: %w", err)
	}

	// Set headers
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+token)

	// Set timeout
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()
	req = req.WithContext(ctx)

	// Make HTTP request
	httpClient := &http.Client{}
	resp, err := httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("authenticated GraphQL request failed: %w", err)
	}
	defer resp.Body.Close()

	// Read response body
	respBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("failed to read response body: %w", err)
	}

	// Decode the response into the provided response struct
	// This allows GraphQL errors to be in response.Errors without returning a Go error
	if err := json.Unmarshal(respBytes, response); err != nil {
		return fmt.Errorf("failed to decode GraphQL response: %w", err)
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