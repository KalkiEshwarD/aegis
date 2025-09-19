package middleware

import (
	"net/http"

	"github.com/balkanid/aegis-backend/internal/errors"
	"github.com/gin-gonic/gin"
)

// ErrorHandler is a middleware that handles errors.
func ErrorHandler() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Next()

		for _, err := range c.Errors {
			// Check if the error is a custom error
			if e, ok := err.Err.(*errors.Error); ok {
				// Handle the custom error
				switch e.Code {
				case errors.ErrCodeNotFound:
					c.JSON(http.StatusNotFound, gin.H{"error": e.Message})
				case errors.ErrCodeInvalidArgument:
					c.JSON(http.StatusBadRequest, gin.H{"error": e.Message})
				case errors.ErrCodeUnauthorized:
					c.JSON(http.StatusUnauthorized, gin.H{"error": e.Message})
				case errors.ErrCodeForbidden:
					c.JSON(http.StatusForbidden, gin.H{"error": e.Message})
				default:
					c.JSON(http.StatusInternalServerError, gin.H{"error": e.Message})
				}
			} else {
				// Handle other errors
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			}
		}
	}
}
