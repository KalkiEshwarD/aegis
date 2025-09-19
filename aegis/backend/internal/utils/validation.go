package utils

import (
	"fmt"
	"net/mail"
	"regexp"
	"strings"
	"unicode"
)

// ValidationResult represents the result of a validation
type ValidationResult struct {
	Valid  bool   `json:"valid"`
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

// Email validation
var emailRegex = regexp.MustCompile(`^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$`)

// ValidateEmail validates email format
func ValidateEmail(email string) *ValidationResult {
	result := NewValidationResult()

	if email == "" {
		result.AddError("Email is required")
		return result
	}

	email = strings.TrimSpace(email)

	if len(email) > 254 {
		result.AddError("Email is too long (max 254 characters)")
		return result
	}

	if !emailRegex.MatchString(email) {
		result.AddError("Invalid email format")
		return result
	}

	// Additional validation using Go's mail package
	_, err := mail.ParseAddress(email)
	if err != nil {
		result.AddError("Invalid email address")
	}

	return result
}

// Username validation
var usernameRegex = regexp.MustCompile(`^[a-zA-Z0-9_-]+$`)

// ValidateUsername validates username format
func ValidateUsername(username string) *ValidationResult {
	result := NewValidationResult()

	if username == "" {
		result.AddError("Username is required")
		return result
	}

	username = strings.TrimSpace(username)

	if len(username) < 3 {
		result.AddError("Username must be at least 3 characters long")
	}

	if len(username) > 50 {
		result.AddError("Username must be no more than 50 characters long")
	}

	if !usernameRegex.MatchString(username) {
		result.AddError("Username can only contain letters, numbers, underscores, and hyphens")
	}

	return result
}

// Password validation
type PasswordRequirements struct {
	MinLength    int  `json:"min_length"`
	RequireUpper bool `json:"require_upper"`
	RequireLower bool `json:"require_lower"`
	RequireDigit bool `json:"require_digit"`
	RequireSpecial bool `json:"require_special"`
	SpecialChars string `json:"special_chars"`
}

// DefaultPasswordRequirements returns default password requirements
func DefaultPasswordRequirements() PasswordRequirements {
	return PasswordRequirements{
		MinLength:     8,
		RequireUpper:  true,
		RequireLower:  true,
		RequireDigit:  true,
		RequireSpecial: true,
		SpecialChars:  "!@#$%^&*()_+-=[]{}|;:,.<>?",
	}
}

// ValidatePassword validates password strength
func ValidatePassword(password string, reqs PasswordRequirements) *ValidationResult {
	result := NewValidationResult()

	if password == "" {
		result.AddError("Password is required")
		return result
	}

	if len(password) < reqs.MinLength {
		result.AddError(fmt.Sprintf("Password must be at least %d characters long", reqs.MinLength))
	}

	if reqs.RequireUpper && !strings.ContainsAny(password, "ABCDEFGHIJKLMNOPQRSTUVWXYZ") {
		result.AddError("Password must contain at least one uppercase letter")
	}

	if reqs.RequireLower && !strings.ContainsAny(password, "abcdefghijklmnopqrstuvwxyz") {
		result.AddError("Password must contain at least one lowercase letter")
	}

	if reqs.RequireDigit && !strings.ContainsAny(password, "0123456789") {
		result.AddError("Password must contain at least one digit")
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
			result.AddError("Password must contain at least one special character")
		}
	}

	return result
}

// File validation
type FileValidationRules struct {
	MaxSize            int64    `json:"max_size"`
	AllowedMimeTypes   []string `json:"allowed_mime_types"`
	AllowedExtensions  []string `json:"allowed_extensions"`
	RequireValidName   bool     `json:"require_valid_name"`
}

// ValidateFile validates file properties
func ValidateFile(filename string, size int64, mimeType string, rules FileValidationRules) *ValidationResult {
	result := NewValidationResult()

	// Validate filename
	if rules.RequireValidName {
		if filename == "" {
			result.AddError("Filename is required")
		} else if len(filename) > 255 {
			result.AddError("Filename is too long (max 255 characters)")
		} else {
			// Check for dangerous characters
			dangerousChars := []string{"<", ">", ":", "\"", "|", "?", "*", "\x00"}
			for _, char := range dangerousChars {
				if strings.Contains(filename, char) {
					result.AddError(fmt.Sprintf("Filename contains dangerous character: %s", char))
					break
				}
			}
		}
	}

	// Validate file size
	if rules.MaxSize > 0 && size > rules.MaxSize {
		result.AddError(fmt.Sprintf("File size %d bytes exceeds maximum size %d bytes", size, rules.MaxSize))
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
			result.AddError(fmt.Sprintf("MIME type %s is not allowed", mimeType))
		}
	}

	// Validate file extension
	if len(rules.AllowedExtensions) > 0 {
		ext := GetFileExtension(filename)
		if ext == "" {
			result.AddError("File must have an extension")
		} else {
			ext = ext[1:] // Remove the dot
			allowed := false
			for _, allowedExt := range rules.AllowedExtensions {
				if strings.EqualFold(ext, strings.TrimPrefix(allowedExt, ".")) {
					allowed = true
					break
				}
			}
			if !allowed {
				result.AddError(fmt.Sprintf("File extension %s is not allowed", ext))
			}
		}
	}

	return result
}

// String validation
type StringValidationRules struct {
	Required bool   `json:"required"`
	MinLength int  `json:"min_length"`
	MaxLength int  `json:"max_length"`
	Pattern   string `json:"pattern"`
	TrimWhitespace bool `json:"trim_whitespace"`
}

// ValidateString validates string input
func ValidateString(input string, rules StringValidationRules) *ValidationResult {
	result := NewValidationResult()

	if rules.TrimWhitespace {
		input = strings.TrimSpace(input)
	}

	if rules.Required && input == "" {
		result.AddError("This field is required")
		return result
	}

	if input == "" && !rules.Required {
		return result // Empty optional field is valid
	}

	if rules.MinLength > 0 && len(input) < rules.MinLength {
		result.AddError(fmt.Sprintf("Must be at least %d characters long", rules.MinLength))
	}

	if rules.MaxLength > 0 && len(input) > rules.MaxLength {
		result.AddError(fmt.Sprintf("Must be no more than %d characters long", rules.MaxLength))
	}

	if rules.Pattern != "" {
		matched, err := regexp.MatchString(rules.Pattern, input)
		if err != nil {
			result.AddError("Invalid validation pattern")
		} else if !matched {
			result.AddError("Does not match required pattern")
		}
	}

	return result
}

// Numeric validation
type NumericValidationRules struct {
	Required bool    `json:"required"`
	Min      float64 `json:"min"`
	Max      float64 `json:"max"`
	IsInt    bool    `json:"is_int"`
}

// ValidateNumber validates numeric input
func ValidateNumber(input interface{}, rules NumericValidationRules) *ValidationResult {
	result := NewValidationResult()

	if input == nil {
		if rules.Required {
			result.AddError("This field is required")
		}
		return result
	}

	var value float64
	switch v := input.(type) {
	case int:
		value = float64(v)
	case int64:
		value = float64(v)
	case float32:
		value = float64(v)
	case float64:
		value = v
	default:
		result.AddError("Invalid numeric value")
		return result
	}

	if rules.IsInt && value != float64(int64(value)) {
		result.AddError("Must be an integer")
	}

	if value < rules.Min {
		result.AddError(fmt.Sprintf("Must be at least %g", rules.Min))
	}

	if value > rules.Max {
		result.AddError(fmt.Sprintf("Must be no more than %g", rules.Max))
	}

	return result
}

// URL validation
var urlRegex = regexp.MustCompile(`^https?://[^\s/$.?#].[^\s]*$`)

// ValidateURL validates URL format
func ValidateURL(url string) *ValidationResult {
	result := NewValidationResult()

	if url == "" {
		result.AddError("URL is required")
		return result
	}

	url = strings.TrimSpace(url)

	if !urlRegex.MatchString(url) {
		result.AddError("Invalid URL format")
	}

	return result
}

// Phone number validation (basic)
var phoneRegex = regexp.MustCompile(`^\+?[\d\s\-\(\)]{10,}$`)

// ValidatePhoneNumber validates phone number format
func ValidatePhoneNumber(phone string) *ValidationResult {
	result := NewValidationResult()

	if phone == "" {
		result.AddError("Phone number is required")
		return result
	}

	phone = strings.TrimSpace(phone)

	// Remove all non-digit characters for length check
	digitsOnly := strings.Map(func(r rune) rune {
		if unicode.IsDigit(r) {
			return r
		}
		return -1
	}, phone)

	if len(digitsOnly) < 10 {
		result.AddError("Phone number must have at least 10 digits")
	}

	if len(digitsOnly) > 15 {
		result.AddError("Phone number must have no more than 15 digits")
	}

	if !phoneRegex.MatchString(phone) {
		result.AddError("Invalid phone number format")
	}

	return result
}

// UUID validation
var uuidRegex = regexp.MustCompile(`^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$`)

// ValidateUUID validates UUID format
func ValidateUUID(uuid string) *ValidationResult {
	result := NewValidationResult()

	if uuid == "" {
		result.AddError("UUID is required")
		return result
	}

	uuid = strings.TrimSpace(uuid)

	if !uuidRegex.MatchString(uuid) {
		result.AddError("Invalid UUID format")
	}

	return result
}

// Date validation
func ValidateDate(dateStr string, format string) *ValidationResult {
	result := NewValidationResult()

	if dateStr == "" {
		result.AddError("Date is required")
		return result
	}

	// This is a basic implementation - in production you'd use a proper date parsing library
	// For now, we'll just check if it matches the expected format pattern
	if format == "YYYY-MM-DD" {
		dateRegex := regexp.MustCompile(`^\d{4}-\d{2}-\d{2}$`)
		if !dateRegex.MatchString(dateStr) {
			result.AddError("Invalid date format (expected YYYY-MM-DD)")
		}
	}

	return result
}

// Combine multiple validation results
func CombineValidationResults(results ...*ValidationResult) *ValidationResult {
	combined := NewValidationResult()

	for _, result := range results {
		if result.HasErrors() {
			combined.Valid = false
			combined.Errors = append(combined.Errors, result.Errors...)
		}
	}

	return combined
}