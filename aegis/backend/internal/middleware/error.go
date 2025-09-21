package middleware

import (
	"net/http"
	"time"

	"github.com/balkanid/aegis-backend/internal/errors"
	"github.com/gin-gonic/gin"
)

// ErrorHandler is a middleware that handles errors and returns standardized API error responses.
func ErrorHandler() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Next()

		for _, err := range c.Errors {
			// Check if the error is a custom error
			if e, ok := err.Err.(*errors.Error); ok {
				// Convert to standardized API error
				apiError := e.ToAPIError()

				// Determine HTTP status code based on error type
				statusCode := getHTTPStatusCode(e.Code)
				c.JSON(statusCode, apiError)
			} else {
				// Handle other errors with generic API error format
				apiError := &errors.APIError{
					Code:      "unknown_error",
					Message:   err.Error(),
					Timestamp: time.Now().UTC().Format(time.RFC3339),
				}
				c.JSON(http.StatusInternalServerError, apiError)
			}
		}
	}
}

// getHTTPStatusCode maps error codes to appropriate HTTP status codes
func getHTTPStatusCode(errorCode errors.ErrorCode) int {
	switch errorCode {
	case errors.ErrCodeNotFound:
		return http.StatusNotFound
	case errors.ErrCodeInvalidArgument, errors.ErrCodeValidation:
		return http.StatusBadRequest
	case errors.ErrCodeUnauthorized, errors.ErrCodeAuthentication:
		return http.StatusUnauthorized
	case errors.ErrCodeForbidden, errors.ErrCodePermission:
		return http.StatusForbidden
	case errors.ErrCodeConflict:
		return http.StatusConflict
	case errors.ErrCodeStorageQuotaExceeded:
		return http.StatusInsufficientStorage
	case errors.ErrCodeFileUpload, errors.ErrCodeFileDownload, errors.ErrCodeNetwork, errors.ErrCodeInternal:
		return http.StatusInternalServerError
	default:
		return http.StatusInternalServerError
	}
}
