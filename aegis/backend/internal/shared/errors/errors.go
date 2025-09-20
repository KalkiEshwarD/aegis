package errors

import (
	"fmt"

	apperrors "github.com/balkanid/aegis-backend/internal/errors"
)

// WrapFileOperationError wraps file operation errors with context
func WrapFileOperationError(err error, operation string, filename string) error {
	if err == nil {
		return nil
	}

	return apperrors.Wrap(err, apperrors.ErrCodeInternal,
		fmt.Sprintf("file operation '%s' failed for '%s'", operation, filename))
}

// WrapValidationError wraps validation errors
func WrapValidationError(err error, field string) error {
	if err == nil {
		return nil
	}

	return apperrors.Wrap(err, apperrors.ErrCodeValidation,
		fmt.Sprintf("validation failed for field '%s'", field))
}

// WrapDatabaseError wraps database operation errors
func WrapDatabaseError(err error, operation string, table string) error {
	if err == nil {
		return nil
	}

	return apperrors.Wrap(err, apperrors.ErrCodeInternal,
		fmt.Sprintf("database operation '%s' failed on table '%s'", operation, table))
}

// WrapAuthenticationError wraps authentication errors
func WrapAuthenticationError(err error, context string) error {
	if err == nil {
		return nil
	}

	return apperrors.Wrap(err, apperrors.ErrCodeUnauthorized,
		fmt.Sprintf("authentication failed: %s", context))
}

// WrapAuthorizationError wraps authorization errors
func WrapAuthorizationError(err error, resource string) error {
	if err == nil {
		return nil
	}

	return apperrors.Wrap(err, apperrors.ErrCodeForbidden,
		fmt.Sprintf("authorization failed for resource '%s'", resource))
}

// WrapNetworkError wraps network-related errors
func WrapNetworkError(err error, service string) error {
	if err == nil {
		return nil
	}

	return apperrors.Wrap(err, apperrors.ErrCodeInternal,
		fmt.Sprintf("network error communicating with '%s'", service))
}

// WrapExternalAPIError wraps external API errors
func WrapExternalAPIError(err error, apiName string, endpoint string) error {
	if err == nil {
		return nil
	}

	return apperrors.Wrap(err, apperrors.ErrCodeInternal,
		fmt.Sprintf("external API '%s' error on endpoint '%s'", apiName, endpoint))
}

// LogError logs an error with context (placeholder for actual logging implementation)
func LogError(err error, context string, additionalInfo map[string]interface{}) {
	if err == nil {
		return
	}

	// This is a placeholder - in a real implementation, you would use a proper logging library
	// For now, we'll just print to stderr or use a logging framework
	fmt.Printf("[ERROR] %s: %v", context, err)
	if additionalInfo != nil {
		fmt.Printf(" Additional info: %v", additionalInfo)
	}
	fmt.Println()
}

// LogAndWrapError logs an error and returns a wrapped version
func LogAndWrapError(err error, context string, code apperrors.ErrorCode) error {
	if err == nil {
		return nil
	}

	LogError(err, context, nil)
	return apperrors.Wrap(err, code, context)
}

// IsValidationError checks if an error is a validation error
func IsValidationError(err error) bool {
	if appErr, ok := err.(*apperrors.Error); ok {
		return appErr.Code == apperrors.ErrCodeValidation
	}
	return false
}

// IsNotFoundError checks if an error is a not found error
func IsNotFoundError(err error) bool {
	if appErr, ok := err.(*apperrors.Error); ok {
		return appErr.Code == apperrors.ErrCodeNotFound
	}
	return false
}

// IsUnauthorizedError checks if an error is an unauthorized error
func IsUnauthorizedError(err error) bool {
	if appErr, ok := err.(*apperrors.Error); ok {
		return appErr.Code == apperrors.ErrCodeUnauthorized
	}
	return false
}

// IsForbiddenError checks if an error is a forbidden error
func IsForbiddenError(err error) bool {
	if appErr, ok := err.(*apperrors.Error); ok {
		return appErr.Code == apperrors.ErrCodeForbidden
	}
	return false
}

// IsInternalError checks if an error is an internal error
func IsInternalError(err error) bool {
	if appErr, ok := err.(*apperrors.Error); ok {
		return appErr.Code == apperrors.ErrCodeInternal
	}
	return false
}

// NewValidationError creates a new validation error
func NewValidationError(message string) error {
	return apperrors.New(apperrors.ErrCodeValidation, message)
}

// NewNotFoundError creates a new not found error
func NewNotFoundError(resource string) error {
	return apperrors.New(apperrors.ErrCodeNotFound, fmt.Sprintf("%s not found", resource))
}

// NewUnauthorizedError creates a new unauthorized error
func NewUnauthorizedError(message string) error {
	return apperrors.New(apperrors.ErrCodeUnauthorized, message)
}

// NewForbiddenError creates a new forbidden error
func NewForbiddenError(message string) error {
	return apperrors.New(apperrors.ErrCodeForbidden, message)
}

// NewInternalError creates a new internal error
func NewInternalError(message string) error {
	return apperrors.New(apperrors.ErrCodeInternal, message)
}

// NewConflictError creates a new conflict error
func NewConflictError(message string) error {
	return apperrors.New(apperrors.ErrCodeConflict, message)
}