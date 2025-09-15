package middleware

import (
	"context"
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"

	"github.com/balkanid/aegis-backend/internal/config"
	"github.com/balkanid/aegis-backend/internal/database"
	"github.com/balkanid/aegis-backend/internal/models"
)

// CORS middleware to handle cross-origin requests
func CORS() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Header("Access-Control-Allow-Origin", "*")
		c.Header("Access-Control-Allow-Credentials", "true")
		c.Header("Access-Control-Allow-Headers", "Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization, accept, origin, Cache-Control, X-Requested-With")
		c.Header("Access-Control-Allow-Methods", "POST, OPTIONS, GET, PUT, DELETE")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}

		c.Next()
	}
}

// Claims represents the JWT claims
type Claims struct {
	UserID  uint   `json:"user_id"`
	Email   string `json:"email"`
	IsAdmin bool   `json:"is_admin"`
	jwt.RegisteredClaims
}

// AuthMiddleware validates JWT tokens and adds user context
func AuthMiddleware(cfg *config.Config) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Skip authentication for certain endpoints
		path := c.Request.URL.Path
		if path == "/health" || (c.Request.Method == "POST" && isPublicQuery(c)) {
			c.Next()
			return
		}

		// Extract token from Authorization header
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Authorization header required"})
			c.Abort()
			return
		}

		// Expect "Bearer <token>"
		bearerToken := strings.Split(authHeader, " ")
		if len(bearerToken) != 2 || bearerToken[0] != "Bearer" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid authorization header format"})
			c.Abort()
			return
		}

		tokenString := bearerToken[1]

		// Parse and validate token
		token, err := jwt.ParseWithClaims(tokenString, &Claims{}, func(token *jwt.Token) (interface{}, error) {
			if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, jwt.ErrSignatureInvalid
			}
			return []byte(cfg.JWTSecret), nil
		})

		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid token"})
			c.Abort()
			return
		}

		if claims, ok := token.Claims.(*Claims); ok && token.Valid {
			// Verify user still exists
			var user models.User
			if err := database.GetDB().First(&user, claims.UserID).Error; err != nil {
				c.JSON(http.StatusUnauthorized, gin.H{"error": "User not found"})
				c.Abort()
				return
			}

			// Add user to context for GraphQL resolvers
			ctx := context.WithValue(c.Request.Context(), "user", &user)
			c.Request = c.Request.WithContext(ctx)
		} else {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid token claims"})
			c.Abort()
			return
		}

		c.Next()
	}
}

// isPublicQuery checks if the GraphQL query is public (login/register)
func isPublicQuery(c *gin.Context) bool {
	// This is a simplified check - in production you might want to parse the actual GraphQL query
	// For now, we'll allow all POST requests to /graphql and handle auth in resolvers
	return c.Request.URL.Path == "/graphql"
}

// GetUserFromContext extracts the user from the request context
func GetUserFromContext(ctx context.Context) (*models.User, error) {
	user, ok := ctx.Value("user").(*models.User)
	if !ok {
		return nil, jwt.ErrTokenInvalidClaims
	}
	return user, nil
}

// RequireAdmin checks if the user has admin privileges
func RequireAdmin(ctx context.Context) (*models.User, error) {
	user, err := GetUserFromContext(ctx)
	if err != nil {
		return nil, err
	}

	if !user.IsAdmin {
		return nil, jwt.ErrTokenInvalidClaims
	}

	return user, nil
}

// ParseUserID safely converts string ID to uint
func ParseUserID(id string) (uint, error) {
	userID, err := strconv.ParseUint(id, 10, 32)
	if err != nil {
		return 0, err
	}
	return uint(userID), nil
}
