package utils

import (
	"fmt"
	"net/mail"
	"regexp"
	"strings"
)

// ValidationResult holds the outcome of a validation check.
type ValidationResult struct {
	Valid  bool
	Errors []string
}

// NewValidationResult creates a new, valid ValidationResult.
func NewValidationResult() *ValidationResult {
	return &ValidationResult{
		Valid:  true,
		Errors: []string{},
	}
}

// AddError adds an error to the validation result, marking it as invalid.
func (r *ValidationResult) AddError(err string) {
	r.Valid = false
	r.Errors = append(r.Errors, err)
}

// HasErrors returns true if the validation result has any errors.
func (r *ValidationResult) HasErrors() bool {
	return !r.Valid
}

var emailRegex = regexp.MustCompile(`^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$`)

func ValidateEmail(email string) *ValidationResult {
	result := NewValidationResult()
	if email == "" {
		result.AddError("Email is required")
		return result
	}

	email = strings.TrimSpace(email)

	if len(email) > 254 {
		result.AddError("Email is too long (max 254 characters)")
	}

	if !emailRegex.MatchString(email) {
		result.AddError("Invalid email format")
	}

	_, err := mail.ParseAddress(email)
	if err != nil {
		result.AddError("Invalid email address")
	}

	return result
}

var usernameRegex = regexp.MustCompile(`^[a-zA-Z0-9_-]+$`)

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

type PasswordRequirements struct {
	MinLength      int
	RequireUpper   bool
	RequireLower   bool
	RequireDigit   bool
	RequireSpecial bool
	SpecialChars   string
}

func DefaultPasswordRequirements() PasswordRequirements {
	return PasswordRequirements{
		MinLength:      8,
		RequireUpper:   true,
		RequireLower:   true,
		RequireDigit:   true,
		RequireSpecial: true,
		SpecialChars:   "!@#$%^&*()_+-=[]{}|;:,.<>?`",
	}
}

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

// FileValidationRules defines rules for file validation.
type FileValidationRules struct {
	MaxSize           int64
	AllowedMimeTypes  []string
	AllowedExtensions []string
	RequireValidName  bool
}

// ValidateFile validates a file based on the provided rules.
func ValidateFile(filename string, size int64, mimeType string, rules FileValidationRules) *ValidationResult {
	result := NewValidationResult()

	if rules.RequireValidName {
		if filename == "" {
			result.AddError("Filename is required")
		}
		// Basic check for dangerous characters in filename
		if strings.ContainsAny(filename, "<>:/\\|?*") {
			result.AddError("Filename contains invalid characters")
		}
	}

	if rules.MaxSize > 0 && size > rules.MaxSize {
		result.AddError(fmt.Sprintf("File size exceeds the limit of %d bytes", rules.MaxSize))
	}

	if len(rules.AllowedMimeTypes) > 0 {
		isAllowed := false
		for _, allowedType := range rules.AllowedMimeTypes {
			if strings.HasPrefix(mimeType, allowedType) {
				isAllowed = true
				break
			}
		}
		if !isAllowed {
			result.AddError(fmt.Sprintf("MIME type '%s' is not allowed", mimeType))
		}
	}

	if len(rules.AllowedExtensions) > 0 {
		isAllowed := false
		ext := strings.ToLower(regexp.MustCompile(`\.[^.]+$`).FindString(filename))
		for _, allowedExt := range rules.AllowedExtensions {
			if ext == allowedExt {
				isAllowed = true
				break
			}
		}
		if !isAllowed {
			result.AddError(fmt.Sprintf("File extension '%s' is not allowed", ext))
		}
	}

	return result
}

// StringValidationRules defines rules for string validation.
type StringValidationRules struct {
	Required       bool
	MinLength      int
	MaxLength      int
	Pattern        string
	TrimWhitespace bool
}

// ValidateString validates a string based on the provided rules.
func ValidateString(input string, rules StringValidationRules) *ValidationResult {
	result := NewValidationResult()
	if rules.TrimWhitespace {
		input = strings.TrimSpace(input)
	}

	if rules.Required && input == "" {
		result.AddError("Input is required")
		return result
	}

	if rules.MinLength > 0 && len(input) < rules.MinLength {
		result.AddError(fmt.Sprintf("Input must be at least %d characters long", rules.MinLength))
	}

	if rules.MaxLength > 0 && len(input) > rules.MaxLength {
		result.AddError(fmt.Sprintf("Input must be no more than %d characters long", rules.MaxLength))
	}

	if rules.Pattern != "" {
		matched, _ := regexp.MatchString(rules.Pattern, input)
		if !matched {
			result.AddError("Input does not match the required pattern")
		}
	}

	return result
}

// NumericValidationRules defines rules for numeric validation.
type NumericValidationRules struct {
	Required bool
	Min      float64
	Max      float64
	IsInt    bool
}

// ValidateNumber validates a number based on the provided rules.
func ValidateNumber(input interface{}, rules NumericValidationRules) *ValidationResult {
	result := NewValidationResult()

	if input == nil {
		if rules.Required {
			result.AddError("Number is required")
		}
		return result
	}

	var val float64
	switch v := input.(type) {
	case int:
		val = float64(v)
	case int32:
		val = float64(v)
	case int64:
		val = float64(v)
	case float32:
		val = float64(v)
	case float64:
		val = v
	default:
		result.AddError("Input is not a valid number")
		return result
	}

	if rules.IsInt && val != float64(int64(val)) {
		result.AddError("Number must be an integer")
	}

	if val < rules.Min {
		result.AddError(fmt.Sprintf("Number must be at least %v", rules.Min))
	}

	if val > rules.Max {
		result.AddError(fmt.Sprintf("Number must be no more than %v", rules.Max))
	}

	return result
}

// ValidateURL validates a URL.
func ValidateURL(url string) *ValidationResult {
	result := NewValidationResult()
	if url == "" {
		result.AddError("URL is required")
		return result
	}

	if !strings.HasPrefix(url, "http://") && !strings.HasPrefix(url, "https://") {
		result.AddError("URL must start with http:// or https://")
	}
	// A more robust URL validation would be needed for production
	return result
}

// ValidatePhoneNumber validates a phone number.
func ValidatePhoneNumber(phone string) *ValidationResult {
	result := NewValidationResult()
	if phone == "" {
		result.AddError("Phone number is required")
		return result
	}
	// This is a very basic phone number validation
	if len(phone) < 7 || len(phone) > 20 {
		result.AddError("Invalid phone number length")
	}
	return result
}

// ValidateUUID validates a UUID.
func ValidateUUID(uuid string) *ValidationResult {
	result := NewValidationResult()
	if uuid == "" {
		result.AddError("UUID is required")
		return result
	}
	// Regex for UUID validation
	uuidRegex := regexp.MustCompile(`^[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}$`)
	if !uuidRegex.MatchString(uuid) {
		result.AddError("Invalid UUID format")
	}
	return result
}

// ValidateDate validates a date string.
func ValidateDate(dateStr, format string) *ValidationResult {
	result := NewValidationResult()
	if dateStr == "" {
		result.AddError("Date is required")
		return result
	}
	// This is a placeholder for a real date validation logic
	if format == "YYYY-MM-DD" {
		dateRegex := regexp.MustCompile(`^\d{4}-\d{2}-\d{2}$`)
		if !dateRegex.MatchString(dateStr) {
			result.AddError("Invalid date format")
		}
	}
	return result
}

// CombineValidationResults combines multiple validation results into one.
func CombineValidationResults(results ...*ValidationResult) *ValidationResult {
	combined := NewValidationResult()
	for _, r := range results {
		if !r.Valid {
			combined.Valid = false
			combined.Errors = append(combined.Errors, r.Errors...)
		}
	}
	return combined
}