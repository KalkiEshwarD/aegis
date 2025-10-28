package errors

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"time"
)

// ErrorCode represents a custom error code.
type ErrorCode string

// Shared error codes loaded from JSON file
var (
	ErrCodeUnknown              ErrorCode = "unknown_error"
	ErrCodeNotFound             ErrorCode = "not_found"
	ErrCodeInvalidArgument      ErrorCode = "invalid_argument"
	ErrCodeUnauthorized         ErrorCode = "unauthorized"
	ErrCodeForbidden            ErrorCode = "forbidden"
	ErrCodeConflict             ErrorCode = "conflict"
	ErrCodeInternal             ErrorCode = "internal_error"
	ErrCodeNetwork              ErrorCode = "network_error"
	ErrCodeAuthentication       ErrorCode = "authentication_error"
	ErrCodeValidation           ErrorCode = "validation_error"
	ErrCodeFileUpload           ErrorCode = "file_upload_error"
	ErrCodeFileDownload         ErrorCode = "file_download_error"
	ErrCodePermission           ErrorCode = "permission_error"
	ErrCodeStorageQuotaExceeded ErrorCode = "storage_quota_exceeded"
	ErrCodeFileExistsInTrash    ErrorCode = "file_exists_in_trash"
)

func init() {
	// Load shared error codes from JSON file
	loadSharedErrorCodes()
}

func loadSharedErrorCodes() {
	// Try to load from shared/error-codes.json relative to project root
	sharedFile := filepath.Join("..", "..", "shared", "error-codes.json")
	if _, err := os.Stat(sharedFile); os.IsNotExist(err) {
		// Fallback to current directory if running from different location
		sharedFile = filepath.Join("shared", "error-codes.json")
	}

	file, err := os.Open(sharedFile)
	if err != nil {
		// If file doesn't exist, use default values
		return
	}
	defer file.Close()

	var codes map[string]string
	if err := json.NewDecoder(file).Decode(&codes); err != nil {
		// If JSON parsing fails, use default values
		return
	}

	// Update error codes from JSON
	if code, exists := codes["UNKNOWN_ERROR"]; exists {
		ErrCodeUnknown = ErrorCode(code)
	}
	if code, exists := codes["NOT_FOUND"]; exists {
		ErrCodeNotFound = ErrorCode(code)
	}
	if code, exists := codes["INVALID_ARGUMENT"]; exists {
		ErrCodeInvalidArgument = ErrorCode(code)
	}
	if code, exists := codes["UNAUTHORIZED"]; exists {
		ErrCodeUnauthorized = ErrorCode(code)
	}
	if code, exists := codes["FORBIDDEN"]; exists {
		ErrCodeForbidden = ErrorCode(code)
	}
	if code, exists := codes["CONFLICT"]; exists {
		ErrCodeConflict = ErrorCode(code)
	}
	if code, exists := codes["INTERNAL_ERROR"]; exists {
		ErrCodeInternal = ErrorCode(code)
	}
	if code, exists := codes["NETWORK_ERROR"]; exists {
		ErrCodeNetwork = ErrorCode(code)
	}
	if code, exists := codes["AUTHENTICATION_ERROR"]; exists {
		ErrCodeAuthentication = ErrorCode(code)
	}
	if code, exists := codes["VALIDATION_ERROR"]; exists {
		ErrCodeValidation = ErrorCode(code)
	}
	if code, exists := codes["FILE_UPLOAD_ERROR"]; exists {
		ErrCodeFileUpload = ErrorCode(code)
	}
	if code, exists := codes["FILE_DOWNLOAD_ERROR"]; exists {
		ErrCodeFileDownload = ErrorCode(code)
	}
	if code, exists := codes["PERMISSION_ERROR"]; exists {
		ErrCodePermission = ErrorCode(code)
	}
	if code, exists := codes["STORAGE_QUOTA_EXCEEDED"]; exists {
		ErrCodeStorageQuotaExceeded = ErrorCode(code)
	}
	if code, exists := codes["FILE_EXISTS_IN_TRASH"]; exists {
		ErrCodeFileExistsInTrash = ErrorCode(code)
	}
}

// APIError represents a standardized error response for API endpoints
type APIError struct {
	Code      string                 `json:"code"`
	Message   string                 `json:"message"`
	Details   map[string]interface{} `json:"details,omitempty"`
	Timestamp string                 `json:"timestamp,omitempty"`
}

// Error is a custom error type.
type Error struct {
	Code    ErrorCode
	Message string
	Err     error
}

// Error returns the error message.
func (e *Error) Error() string {
	if e.Err != nil {
		return fmt.Sprintf("%s: %s", e.Message, e.Err.Error())
	}
	return e.Message
}

// ToAPIError converts the custom error to a standardized API error response
func (e *Error) ToAPIError() *APIError {
	apiError := &APIError{
		Code:      string(e.Code),
		Message:   e.Message,
		Timestamp: time.Now().UTC().Format(time.RFC3339),
	}

	// Add underlying error details if present
	if e.Err != nil {
		apiError.Details = map[string]interface{}{
			"underlying_error": e.Err.Error(),
		}
	}

	return apiError
}

// New creates a new custom error.
func New(code ErrorCode, message string) *Error {
	return &Error{
		Code:    code,
		Message: message,
	}
}

// Wrap wraps an existing error with a custom error.
func Wrap(err error, code ErrorCode, message string) *Error {
	return &Error{
		Code:    code,
		Message: message,
		Err:     err,
	}
}
