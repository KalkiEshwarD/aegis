package middleware_test

import (
	"bytes"
	"context"
	"fmt"
	"log"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/suite"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"

	"github.com/balkanid/aegis-backend/internal/config"
	"github.com/balkanid/aegis-backend/internal/database"
	"github.com/balkanid/aegis-backend/internal/middleware"
	"github.com/balkanid/aegis-backend/internal/models"
	"github.com/balkanid/aegis-backend/internal/services"
)

type MiddlewareTestSuite struct {
	suite.Suite
	db          *gorm.DB
	config      *config.Config
	authService *services.AuthService
	dbService   *database.DB
	router      *gin.Engine
}

func (suite *MiddlewareTestSuite) SetupSuite() {
	gin.SetMode(gin.TestMode)

	// Create in-memory SQLite database for testing
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	suite.Require().NoError(err)

	suite.db = db
	// Set the global database
	suite.dbService = database.NewDB(db)
	database.SetDB(suite.dbService)

	// Run migrations
	err = db.AutoMigrate(&models.User{})
	suite.Require().NoError(err)

	// Test config
	suite.config = &config.Config{
		JWTSecret: "test-secret-key",
	}

	// Create auth service
	suite.authService = services.NewAuthService(suite.config)

	// Setup router
	suite.router = gin.New()
}

func (suite *MiddlewareTestSuite) TearDownSuite() {
	if suite.db != nil {
		sqlDB, _ := suite.db.DB()
		sqlDB.Close()
	}
}

func (suite *MiddlewareTestSuite) SetupTest() {
	// Clean database before each test
	suite.db.Exec("DELETE FROM users")
}

func (suite *MiddlewareTestSuite) TestCORS_AllowedOrigin() {
	// Setup route with CORS middleware
	router := gin.New()
	router.Use(middleware.CORS("http://localhost:3000,https://example.com"))
	router.GET("/test", func(c *gin.Context) {
		c.JSON(200, gin.H{"message": "ok"})
	})

	// Test OPTIONS request with allowed origin
	req, _ := http.NewRequest("OPTIONS", "/test", nil)
	req.Header.Set("Origin", "http://localhost:3000")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(suite.T(), 204, w.Code)
	assert.Equal(suite.T(), "http://localhost:3000", w.Header().Get("Access-Control-Allow-Origin"))
	assert.Equal(suite.T(), "true", w.Header().Get("Access-Control-Allow-Credentials"))
	assert.Contains(suite.T(), w.Header().Get("Access-Control-Allow-Headers"), "Authorization")
	assert.Contains(suite.T(), w.Header().Get("Access-Control-Allow-Methods"), "POST")

	// Test regular GET request with allowed origin
	req, _ = http.NewRequest("GET", "/test", nil)
	req.Header.Set("Origin", "http://localhost:3000")
	w = httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(suite.T(), 200, w.Code)
	assert.Equal(suite.T(), "http://localhost:3000", w.Header().Get("Access-Control-Allow-Origin"))
}

func (suite *MiddlewareTestSuite) TestCORS_DisallowedOrigin() {
	// Setup route with CORS middleware
	router := gin.New()
	router.Use(middleware.CORS("http://localhost:3000"))
	router.GET("/test", func(c *gin.Context) {
		c.JSON(200, gin.H{"message": "ok"})
	})

	// Test request with disallowed origin
	req, _ := http.NewRequest("GET", "/test", nil)
	req.Header.Set("Origin", "http://evil.com")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(suite.T(), 403, w.Code)
	assert.Contains(suite.T(), w.Body.String(), "Origin not allowed")
}

func (suite *MiddlewareTestSuite) TestAuthMiddleware_HealthEndpoint() {
	// Setup route with auth middleware
	router := gin.New()
	router.Use(middleware.AuthMiddleware(suite.config, suite.authService, suite.dbService))
	router.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{"status": "ok"})
	})

	// Health endpoint should not require auth
	req, _ := http.NewRequest("GET", "/health", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(suite.T(), 200, w.Code)
}

func (suite *MiddlewareTestSuite) TestAuthMiddleware_MissingAuthorizationHeader() {
	// Setup route with auth middleware
	router := gin.New()
	router.Use(middleware.AuthMiddleware(suite.config, suite.authService, suite.dbService))
	router.GET("/protected", func(c *gin.Context) {
		c.JSON(200, gin.H{"message": "protected"})
	})

	req, _ := http.NewRequest("GET", "/protected", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(suite.T(), 401, w.Code)
	assert.Contains(suite.T(), w.Body.String(), "Authorization header required")
}

func (suite *MiddlewareTestSuite) TestAuthMiddleware_InvalidAuthorizationFormat() {
	// Setup route with auth middleware
	router := gin.New()
	router.Use(middleware.AuthMiddleware(suite.config, suite.authService, suite.dbService))
	router.GET("/protected", func(c *gin.Context) {
		c.JSON(200, gin.H{"message": "protected"})
	})

	// Test invalid format (missing "Bearer")
	req, _ := http.NewRequest("GET", "/protected", nil)
	req.Header.Set("Authorization", "invalidtoken")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(suite.T(), 401, w.Code)
	assert.Contains(suite.T(), w.Body.String(), "Invalid authorization header format")
}

func (suite *MiddlewareTestSuite) TestAuthMiddleware_InvalidToken() {
	// Setup route with auth middleware
	router := gin.New()
	router.Use(middleware.AuthMiddleware(suite.config, suite.authService, suite.dbService))
	router.GET("/protected", func(c *gin.Context) {
		c.JSON(200, gin.H{"message": "protected"})
	})

	req, _ := http.NewRequest("GET", "/protected", nil)
	req.Header.Set("Authorization", "Bearer invalidtoken")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(suite.T(), 401, w.Code)
	assert.Contains(suite.T(), w.Body.String(), "Invalid token")
}

func (suite *MiddlewareTestSuite) TestAuthMiddleware_ValidToken() {
	// Create test user
	user := models.User{
		Email:        "test@example.com",
		PasswordHash: "hash",
		StorageQuota: 1024,
		UsedStorage:  0,
		IsAdmin:      false,
	}
	err := suite.db.Create(&user).Error
	suite.Require().NoError(err)

	// Create valid JWT token
	claims := &services.Claims{
		UserID:  user.ID,
		Email:   user.Email,
		IsAdmin: user.IsAdmin,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenString, err := token.SignedString([]byte(suite.config.JWTSecret))
	suite.Require().NoError(err)

	// Setup route with auth middleware
	router := gin.New()
	router.Use(middleware.AuthMiddleware(suite.config, suite.authService, suite.dbService))
	router.GET("/protected", func(c *gin.Context) {
		// Verify user was added to context
		user, err := middleware.GetUserFromContext(c.Request.Context())
		if err != nil {
			c.JSON(500, gin.H{"error": "Failed to get user from context"})
			return
		}
		c.JSON(200, gin.H{"user_id": user.ID, "email": user.Email})
	})

	req, _ := http.NewRequest("GET", "/protected", nil)
	req.Header.Set("Authorization", "Bearer "+tokenString)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(suite.T(), 200, w.Code)
	assert.Contains(suite.T(), w.Body.String(), user.Email)
}

func (suite *MiddlewareTestSuite) TestAuthMiddleware_UserNotFound() {
	// Create JWT token with non-existent user ID
	claims := &services.Claims{
		UserID:  999, // Non-existent user
		Email:   "nonexistent@example.com",
		IsAdmin: false,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenString, err := token.SignedString([]byte(suite.config.JWTSecret))
	suite.Require().NoError(err)

	// Setup route with auth middleware
	router := gin.New()
	router.Use(middleware.AuthMiddleware(suite.config, suite.authService, suite.dbService))
	router.GET("/protected", func(c *gin.Context) {
		c.JSON(200, gin.H{"message": "protected"})
	})

	req, _ := http.NewRequest("GET", "/protected", nil)
	req.Header.Set("Authorization", "Bearer "+tokenString)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(suite.T(), 401, w.Code)
	assert.Contains(suite.T(), w.Body.String(), "User not found")
}

func (suite *MiddlewareTestSuite) TestGetUserFromContext_ValidUser() {
	user := &models.User{
		ID:    1,
		Email: "test@example.com",
	}

	ctx := context.WithValue(context.Background(), "user", user)

	retrievedUser, err := middleware.GetUserFromContext(ctx)

	assert.NoError(suite.T(), err)
	assert.Equal(suite.T(), user.ID, retrievedUser.ID)
	assert.Equal(suite.T(), user.Email, retrievedUser.Email)
}

func (suite *MiddlewareTestSuite) TestGetUserFromContext_NoUser() {
	ctx := context.Background()

	retrievedUser, err := middleware.GetUserFromContext(ctx)

	assert.Error(suite.T(), err)
	assert.Nil(suite.T(), retrievedUser)
}

func (suite *MiddlewareTestSuite) TestGetUserFromContext_InvalidType() {
	ctx := context.WithValue(context.Background(), "user", "not a user")

	retrievedUser, err := middleware.GetUserFromContext(ctx)

	assert.Error(suite.T(), err)
	assert.Nil(suite.T(), retrievedUser)
}

func (suite *MiddlewareTestSuite) TestRequireAdmin_ValidAdmin() {
	user := &models.User{
		ID:      1,
		Email:   "admin@example.com",
		IsAdmin: true,
	}

	ctx := context.WithValue(context.Background(), "user", user)

	retrievedUser, err := middleware.RequireAdmin(ctx)

	assert.NoError(suite.T(), err)
	assert.Equal(suite.T(), user.ID, retrievedUser.ID)
	assert.True(suite.T(), retrievedUser.IsAdmin)
}

func (suite *MiddlewareTestSuite) TestRequireAdmin_NonAdmin() {
	user := &models.User{
		ID:      1,
		Email:   "user@example.com",
		IsAdmin: false,
	}

	ctx := context.WithValue(context.Background(), "user", user)

	retrievedUser, err := middleware.RequireAdmin(ctx)

	assert.Error(suite.T(), err)
	assert.Nil(suite.T(), retrievedUser)
}

func (suite *MiddlewareTestSuite) TestRequireAdmin_NoUser() {
	ctx := context.Background()

	retrievedUser, err := middleware.RequireAdmin(ctx)

	assert.Error(suite.T(), err)
	assert.Nil(suite.T(), retrievedUser)
}

func (suite *MiddlewareTestSuite) TestParseUserID_ValidID() {
	tests := []struct {
		input    string
		expected uint
	}{
		{"1", 1},
		{"123", 123},
		{"999999", 999999},
	}

	for _, tt := range tests {
		suite.T().Run(fmt.Sprintf("parse_%s", tt.input), func(t *testing.T) {
			result, err := middleware.ParseUserID(tt.input)
			assert.NoError(t, err)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func (suite *MiddlewareTestSuite) TestParseUserID_InvalidID() {
	tests := []string{
		"invalid",
		"",
		"-1",
		"1.5",
		"abc123",
	}

	for _, input := range tests {
		suite.T().Run(fmt.Sprintf("parse_%s", input), func(t *testing.T) {
			result, err := middleware.ParseUserID(input)
			assert.Error(t, err)
			assert.Equal(t, uint(0), result)
		})
	}
}

func (suite *MiddlewareTestSuite) TestClaims_Structure() {
	claims := services.Claims{
		UserID:  1,
		Email:   "test@example.com",
		IsAdmin: true,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}

	assert.Equal(suite.T(), uint(1), claims.UserID)
	assert.Equal(suite.T(), "test@example.com", claims.Email)
	assert.True(suite.T(), claims.IsAdmin)
	assert.NotNil(suite.T(), claims.ExpiresAt)
	assert.NotNil(suite.T(), claims.IssuedAt)
}

func (suite *MiddlewareTestSuite) TestAuthMiddleware_NoSensitiveDataInLogs() {
	// Capture log output to verify no sensitive data is logged
	var buf bytes.Buffer
	originalLogger := log.Writer()
	log.SetOutput(&buf)
	defer log.SetOutput(originalLogger)

	// Setup route with auth middleware
	router := gin.New()
	router.Use(middleware.AuthMiddleware(suite.config, suite.authService, suite.dbService))
	router.GET("/protected", func(c *gin.Context) {
		c.JSON(200, gin.H{"message": "protected"})
	})

	// Test with invalid token
	req, _ := http.NewRequest("GET", "/protected", nil)
	req.Header.Set("Authorization", "Bearer invalidtoken")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	// Verify response
	assert.Equal(suite.T(), 401, w.Code)

	// Verify no sensitive data in logs (token should not be logged)
	logOutput := buf.String()
	assert.NotContains(suite.T(), logOutput, "invalidtoken", "Token should not be logged")
	assert.NotContains(suite.T(), logOutput, "Bearer", "Authorization header should not be logged")
}

func TestMiddlewareSuite(t *testing.T) {
	suite.Run(t, new(MiddlewareTestSuite))
}
