package validation

import (
	"fmt"
	"net/mail"
	"regexp"
	"strings"

	apperrors "github.com/balkanid/aegis-backend/internal/errors"
)

// ValidationResult represents the result of a validation
type ValidationResult struct {
	Valid  bool     `json:"valid"`
	Errors []string `json:"errors,omitempty"`
}

// NewValidationResult creates a new validation result
func NewValidationResult() *ValidationResult {
	return &ValidationResult{
		Valid:  true,
		Errors: make([]string, 0),
	}
}

// AddError adds an error to the validation result
func (vr *ValidationResult) AddError(error string) {
	vr.Valid = false
	vr.Errors = append(vr.Errors, error)
}

// HasErrors checks if validation result has errors
func (vr *ValidationResult) HasErrors() bool {
	return !vr.Valid
}

// ValidateInput validates general input with common rules
func ValidateInput(input string, rules InputValidationRules) error {
	if rules.Required && strings.TrimSpace(input) == "" {
		return apperrors.New(apperrors.ErrCodeValidation, fmt.Sprintf("%s is required", rules.FieldName))
	}

	input = strings.TrimSpace(input)

	if rules.MinLength > 0 && len(input) < rules.MinLength {
		return apperrors.New(apperrors.ErrCodeValidation,
			fmt.Sprintf("%s must be at least %d characters long", rules.FieldName, rules.MinLength))
	}

	if rules.MaxLength > 0 && len(input) > rules.MaxLength {
		return apperrors.New(apperrors.ErrCodeValidation,
			fmt.Sprintf("%s must be no more than %d characters long", rules.FieldName, rules.MaxLength))
	}

	if rules.Pattern != "" {
		matched, err := regexp.MatchString(rules.Pattern, input)
		if err != nil {
			return apperrors.New(apperrors.ErrCodeValidation, "Invalid validation pattern")
		}
		if !matched {
			return apperrors.New(apperrors.ErrCodeValidation,
				fmt.Sprintf("%s does not match required pattern", rules.FieldName))
		}
	}

	return nil
}

// InputValidationRules defines rules for input validation
type InputValidationRules struct {
	FieldName string
	Required  bool
	MinLength int
	MaxLength int
	Pattern   string
}

// ValidateEmail validates email format
func ValidateEmail(email string) error {
	if strings.TrimSpace(email) == "" {
		return apperrors.New(apperrors.ErrCodeValidation, "Email is required")
	}

	email = strings.TrimSpace(email)

	if len(email) > 254 {
		return apperrors.New(apperrors.ErrCodeValidation, "Email is too long (max 254 characters)")
	}

	emailRegex := regexp.MustCompile(`^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$`)
	if !emailRegex.MatchString(email) {
		return apperrors.New(apperrors.ErrCodeValidation, "Invalid email format")
	}

	// Additional validation using Go's mail package
	_, err := mail.ParseAddress(email)
	if err != nil {
		return apperrors.New(apperrors.ErrCodeValidation, "Invalid email address")
	}

	return nil
}

// ValidateUsername validates username format
func ValidateUsername(username string) error {
	if strings.TrimSpace(username) == "" {
		return apperrors.New(apperrors.ErrCodeValidation, "Username is required")
	}

	username = strings.TrimSpace(username)

	if len(username) < 3 {
		return apperrors.New(apperrors.ErrCodeValidation, "Username must be at least 3 characters long")
	}

	if len(username) > 50 {
		return apperrors.New(apperrors.ErrCodeValidation, "Username must be no more than 50 characters long")
	}

	usernameRegex := regexp.MustCompile(`^[a-zA-Z0-9_-]+$`)
	if !usernameRegex.MatchString(username) {
		return apperrors.New(apperrors.ErrCodeValidation, "Username can only contain letters, numbers, underscores, and hyphens")
	}

	return nil
}

// PasswordRequirements defines password validation requirements
type PasswordRequirements struct {
	MinLength      int
	RequireUpper   bool
	RequireLower   bool
	RequireDigit   bool
	RequireSpecial bool
	SpecialChars   string
}

// DefaultPasswordRequirements returns default password requirements
func DefaultPasswordRequirements() PasswordRequirements {
	return PasswordRequirements{
		MinLength:      8,
		RequireUpper:   true,
		RequireLower:   true,
		RequireDigit:   true,
		RequireSpecial: true,
		SpecialChars:   "!@#$%^&*()_+-=[]{}|;:,.<>?",
	}
}

// ValidatePassword validates password strength
func ValidatePassword(password string, reqs PasswordRequirements) error {
	if password == "" {
		return apperrors.New(apperrors.ErrCodeValidation, "Password is required")
	}

	if len(password) < reqs.MinLength {
		return apperrors.New(apperrors.ErrCodeValidation,
			fmt.Sprintf("Password must be at least %d characters long", reqs.MinLength))
	}

	if reqs.RequireUpper && !strings.ContainsAny(password, "ABCDEFGHIJKLMNOPQRSTUVWXYZ") {
		return apperrors.New(apperrors.ErrCodeValidation, "Password must contain at least one uppercase letter")
	}

	if reqs.RequireLower && !strings.ContainsAny(password, "abcdefghijklmnopqrstuvwxyz") {
		return apperrors.New(apperrors.ErrCodeValidation, "Password must contain at least one lowercase letter")
	}

	if reqs.RequireDigit && !strings.ContainsAny(password, "0123456789") {
		return apperrors.New(apperrors.ErrCodeValidation, "Password must contain at least one digit")
	}

	if reqs.RequireSpecial {
		hasSpecial := false
		for _, char := range password {
			if strings.ContainsRune(reqs.SpecialChars, char) {
				hasSpecial = true
				break
			}
		}
		if !hasSpecial {
			return apperrors.New(apperrors.ErrCodeValidation, "Password must contain at least one special character")
		}
	}

	return nil
}

// FileValidationRules defines rules for file validation
type FileValidationRules struct {
	MaxSize           int64
	AllowedMimeTypes  []string
	AllowedExtensions []string
	RequireValidName  bool
}

// ValidateFile validates file properties
func ValidateFile(filename string, size int64, mimeType string, rules FileValidationRules) error {
	// Validate filename
	if rules.RequireValidName {
		if strings.TrimSpace(filename) == "" {
			return apperrors.New(apperrors.ErrCodeValidation, "Filename is required")
		}
		if len(filename) > 255 {
			return apperrors.New(apperrors.ErrCodeValidation, "Filename is too long (max 255 characters)")
		}
		// Check for dangerous characters
		dangerousChars := []string{"<", ">", ":", "\"", "|", "?", "*", "\x00"}
		for _, char := range dangerousChars {
			if strings.Contains(filename, char) {
				return apperrors.New(apperrors.ErrCodeValidation,
					fmt.Sprintf("Filename contains dangerous character: %s", char))
			}
		}
	}

	// Validate file size
	if rules.MaxSize > 0 && size > rules.MaxSize {
		return apperrors.New(apperrors.ErrCodeValidation,
			fmt.Sprintf("File size %d bytes exceeds maximum size %d bytes", size, rules.MaxSize))
	}

	// Validate MIME type
	if len(rules.AllowedMimeTypes) > 0 {
		allowed := false
		for _, allowedType := range rules.AllowedMimeTypes {
			if strings.HasPrefix(mimeType, allowedType) {
				allowed = true
				break
			}
		}
		if !allowed {
			return apperrors.New(apperrors.ErrCodeValidation,
				fmt.Sprintf("MIME type %s is not allowed", mimeType))
		}
	}

	// Validate file extension
	if len(rules.AllowedExtensions) > 0 {
		ext := GetFileExtension(filename)
		if ext == "" {
			return apperrors.New(apperrors.ErrCodeValidation, "File must have an extension")
		}
		ext = ext[1:] // Remove the dot
		allowed := false
		for _, allowedExt := range rules.AllowedExtensions {
			if strings.EqualFold(ext, strings.TrimPrefix(allowedExt, ".")) {
				allowed = true
				break
			}
		}
		if !allowed {
			return apperrors.New(apperrors.ErrCodeValidation,
				fmt.Sprintf("File extension %s is not allowed", ext))
		}
	}

	return nil
}

// GetFileExtension extracts file extension from filename
func GetFileExtension(filename string) string {
	if lastDot := strings.LastIndex(filename, "."); lastDot != -1 {
		return filename[lastDot:]
	}
	return ""
}

// CombineValidationErrors combines multiple validation errors
func CombineValidationErrors(errors ...error) error {
	var errorMessages []string
	for _, err := range errors {
		if err != nil {
			errorMessages = append(errorMessages, err.Error())
		}
	}
	if len(errorMessages) == 0 {
		return nil
	}
	return apperrors.New(apperrors.ErrCodeValidation, strings.Join(errorMessages, "; "))
}
