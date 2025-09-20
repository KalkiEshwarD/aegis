
package utils

import (
	"errors"
	"fmt"
	"net/mail"
	"regexp"
	"strings"
)

var emailRegex = regexp.MustCompile(`^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$`)

func ValidateEmail(email string) error {
	if email == "" {
		return errors.New("email is required")
	}

	email = strings.TrimSpace(email)

	if len(email) > 254 {
		return errors.New("email is too long (max 254 characters)")
	}

	if !emailRegex.MatchString(email) {
		return errors.New("invalid email format")
	}

	_, err := mail.ParseAddress(email)
	if err != nil {
		return errors.New("invalid email address")
	}

	return nil
}

var usernameRegex = regexp.MustCompile(`^[a-zA-Z0-9_-]+$`)

func ValidateUsername(username string) error {
	if username == "" {
		return errors.New("username is required")
	}

	username = strings.TrimSpace(username)

	if len(username) < 3 {
		return errors.New("username must be at least 3 characters long")
	}

	if len(username) > 50 {
		return errors.New("username must be no more than 50 characters long")
	}

	if !usernameRegex.MatchString(username) {
		return errors.New("username can only contain letters, numbers, underscores, and hyphens")
	}

	return nil
}

type PasswordRequirements struct {
	MinLength    int
	RequireUpper bool
	RequireLower bool
	RequireDigit bool
	RequireSpecial bool
	SpecialChars string
}

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

func ValidatePassword(password string, reqs PasswordRequirements) error {
	if password == "" {
		return errors.New("password is required")
	}

	if len(password) < reqs.MinLength {
		return fmt.Errorf("password must be at least %d characters long", reqs.MinLength)
	}

	if reqs.RequireUpper && !strings.ContainsAny(password, "ABCDEFGHIJKLMNOPQRSTUVWXYZ") {
		return errors.New("password must contain at least one uppercase letter")
	}

	if reqs.RequireLower && !strings.ContainsAny(password, "abcdefghijklmnopqrstuvwxyz") {
		return errors.New("password must contain at least one lowercase letter")
	}

	if reqs.RequireDigit && !strings.ContainsAny(password, "0123456789") {
		return errors.New("password must contain at least one digit")
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
			return errors.New("password must contain at least one special character")
		}
	}

	return nil
}






