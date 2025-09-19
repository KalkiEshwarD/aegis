package validation

import (
	"encoding/json"
	"fmt"
	"os"
	"regexp"
	"sync"

	"github.com/balkanid/aegis-backend/internal/errors"
)

// ValidationRules represents the shared validation configuration
type ValidationRules struct {
	Username struct {
		MinLength int    `json:"minLength"`
		MaxLength int    `json:"maxLength"`
		Regex     string `json:"regex"`
	} `json:"username"`
	Email struct {
		Regex     string `json:"regex"`
		MaxLength int    `json:"maxLength"`
	} `json:"email"`
	Password struct {
		MinLength      int    `json:"minLength"`
		RequireLower   bool   `json:"requireLower"`
		RequireUpper   bool   `json:"requireUpper"`
		RequireDigit   bool   `json:"requireDigit"`
		RequireSpecial bool   `json:"requireSpecial"`
		SpecialChars   string `json:"specialChars"`
	} `json:"password"`
	File struct {
		MaxSize         int64    `json:"maxSize"`
		AllowedMimeTypes []string `json:"allowedMimeTypes"`
	} `json:"file"`
}

var (
	rules     *ValidationRules
	rulesOnce sync.Once
)

// loadValidationRules loads the validation rules from the shared configuration file
func loadValidationRules() *ValidationRules {
	rulesOnce.Do(func() {
		file, err := os.Open("../../validation-rules.json")
		if err != nil {
			panic("Failed to load validation rules: " + err.Error())
		}
		defer file.Close()

		rules = &ValidationRules{}
		decoder := json.NewDecoder(file)
		if err := decoder.Decode(rules); err != nil {
			panic("Failed to parse validation rules: " + err.Error())
		}
	})
	return rules
}

// Validator is the validation service.
type Validator struct{}

// NewValidator creates a new validation service.
func NewValidator() *Validator {
	return &Validator{}
}

// ValidateUsername validates a username.
func (v *Validator) ValidateUsername(username string) error {
	rules := loadValidationRules()
	if username == "" {
		return errors.New(errors.ErrCodeInvalidArgument, "username is required")
	}
	if len(username) < rules.Username.MinLength || len(username) > rules.Username.MaxLength {
		return errors.New(errors.ErrCodeInvalidArgument, fmt.Sprintf("username must be between %d and %d characters", rules.Username.MinLength, rules.Username.MaxLength))
	}
	if matched, _ := regexp.MatchString(rules.Username.Regex, username); !matched {
		return errors.New(errors.ErrCodeInvalidArgument, "username must contain only alphanumeric characters")
	}
	return nil
}

// ValidateEmail validates an email address.
func (v *Validator) ValidateEmail(email string) error {
	rules := loadValidationRules()
	if email == "" {
		return errors.New(errors.ErrCodeInvalidArgument, "email is required")
	}
	if len(email) > rules.Email.MaxLength {
		return errors.New(errors.ErrCodeInvalidArgument, fmt.Sprintf("email must be no more than %d characters", rules.Email.MaxLength))
	}
	emailRegex := regexp.MustCompile(rules.Email.Regex)
	if !emailRegex.MatchString(email) {
		return errors.New(errors.ErrCodeInvalidArgument, "invalid email format")
	}
	return nil
}

// ValidatePassword validates a password.
func (v *Validator) ValidatePassword(password string) error {
	rules := loadValidationRules()
	if len(password) < rules.Password.MinLength {
		return errors.New(errors.ErrCodeInvalidArgument, fmt.Sprintf("password must be at least %d characters long", rules.Password.MinLength))
	}

	// Check for required character types
	hasLower := !rules.Password.RequireLower || regexp.MustCompile(`[a-z]`).MatchString(password)
	hasUpper := !rules.Password.RequireUpper || regexp.MustCompile(`[A-Z]`).MatchString(password)
	hasDigit := !rules.Password.RequireDigit || regexp.MustCompile(`\d`).MatchString(password)
	hasSpecial := !rules.Password.RequireSpecial || regexp.MustCompile(rules.Password.SpecialChars).MatchString(password)

	if !hasLower || !hasUpper || !hasDigit || !hasSpecial {
		return errors.New(errors.ErrCodeInvalidArgument, "password must contain at least one uppercase letter, one lowercase letter, one number, and one special character")
	}

	return nil
}
