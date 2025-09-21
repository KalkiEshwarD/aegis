package middleware

import (
	"context"
	"fmt"
	"strconv"
	"strings"

	"github.com/balkanid/aegis-backend/internal/services"
	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"

	"github.com/balkanid/aegis-backend/internal/config"
	"github.com/balkanid/aegis-backend/internal/database"
	"github.com/balkanid/aegis-backend/internal/models"
)

// Context key type to avoid collisions
type contextKey string

const (
	UserContextKey contextKey = "user"
)


// AuthMiddleware validates JWT tokens and adds user context
func AuthMiddleware(cfg *config.Config, authService *services.AuthService, db *database.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Skip authentication for certain endpoints
		path := c.Request.URL.Path
		method := c.Request.Method
		fmt.Printf("DEBUG: AuthMiddleware called for path: %s, method: %s\n", path, method)

		if path == "/health" {
			fmt.Printf("DEBUG: Skipping auth for health endpoint\n")
			c.Next()
			return
		}

		// For GraphQL requests, handle authentication at resolver level
		if path == cfg.APIEndpoints.GraphQL.Base {
			fmt.Printf("DEBUG: Handling GraphQL request at configured path: %s\n", cfg.APIEndpoints.GraphQL.Base)
			// Check for token in Authorization header only
			var tokenString string
			authHeader := c.GetHeader("Authorization")
			if authHeader != "" {
				// Expect "Bearer <token>"
				bearerToken := strings.Split(authHeader, " ")
				if len(bearerToken) == 2 && bearerToken[0] == "Bearer" {
					tokenString = bearerToken[1]
				}
			}

			if tokenString != "" {
				fmt.Printf("DEBUG: GraphQL request has authorization token\n")
				// Parse and validate token
				claims, err := authService.ParseToken(tokenString)

				if err != nil {
					// Log authentication failure without sensitive details
					fmt.Printf("DEBUG: GraphQL authentication failed: %v\n", err)
				} else {
					// Verify user still exists
					var user models.User
					if err := db.GetDB().First(&user, claims.UserID).Error; err == nil {
						// Add user to context for GraphQL resolvers
						ctx := context.WithValue(c.Request.Context(), UserContextKey, &user)
						c.Request = c.Request.WithContext(ctx)
						fmt.Printf("DEBUG: User authenticated for GraphQL: %s\n", user.Email)
					} else {
						fmt.Printf("DEBUG: User not found in database: %v\n", err)
					}
				}
			} else {
				fmt.Printf("DEBUG: No authorization header for GraphQL request\n")
			}
			// Always allow GraphQL requests to proceed - authentication handled at resolver level
			fmt.Printf("DEBUG: Allowing GraphQL request to proceed\n")
			c.Next()
			return
		}

		fmt.Printf("DEBUG: Path %s does not match GraphQL endpoint %s, treating as REST endpoint\n", path, cfg.APIEndpoints.GraphQL.Base)

		// For other endpoints, require authentication
		// Skip authentication for health endpoint
		if path == cfg.APIEndpoints.Health.Base {
			fmt.Printf("DEBUG: Skipping auth for configured health endpoint: %s\n", cfg.APIEndpoints.Health.Base)
			c.Next()
			return
		}

		fmt.Printf("DEBUG: Authenticating REST endpoint: %s\n", path)

		// Authenticate REST endpoints
		var tokenString string
		authHeader := c.GetHeader("Authorization")
		if authHeader != "" {
			// Expect "Bearer <token>"
			bearerToken := strings.Split(authHeader, " ")
			if len(bearerToken) == 2 && bearerToken[0] == "Bearer" {
				tokenString = bearerToken[1]
			}
		}

		if tokenString == "" {
			fmt.Printf("DEBUG: No authorization token for REST endpoint %s, returning 401\n", path)
			c.AbortWithStatusJSON(401, gin.H{"error": "Authorization header required"})
			return
		}

		fmt.Printf("DEBUG: Validating token for REST endpoint\n")

		// Parse and validate token
		claims, err := authService.ParseToken(tokenString)
		if err != nil {
			fmt.Printf("DEBUG: Invalid token for REST endpoint: %v\n", err)
			c.AbortWithStatusJSON(401, gin.H{"error": "Invalid token"})
			return
		}

		// Verify user still exists
		var user models.User
		if err := db.GetDB().First(&user, claims.UserID).Error; err != nil {
			fmt.Printf("DEBUG: User not found for REST endpoint: %v\n", err)
			c.AbortWithStatusJSON(401, gin.H{"error": "User not found"})
			return
		}

		fmt.Printf("DEBUG: User authenticated for REST endpoint: %s\n", user.Email)

		// Add user to context for REST handlers
		ctx := context.WithValue(c.Request.Context(), UserContextKey, &user)
		c.Request = c.Request.WithContext(ctx)

		c.Next()
	}
}

// GetUserFromContext extracts the user from the request context
func GetUserFromContext(ctx context.Context) (*models.User, error) {
	user, ok := ctx.Value(UserContextKey).(*models.User)
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
