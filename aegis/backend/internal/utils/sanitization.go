package utils

import (
	"regexp"
	"strings"
	"unicode"
)

// HTMLEscapeMap contains HTML entity mappings for sanitization
var HTMLEscapeMap = map[rune]string{
	'&':  "&",
	'<':  "<",
	'>':  ">",
	'"':  "&quot;",
	'\'': "&#x27;",
	'/':  "&#x2F;",
	'`':  "&#x60;",
	'=':  "&#x3D;",
}

// SanitizeHTML encodes HTML entities to prevent XSS attacks
func SanitizeHTML(input string) string {
	if input == "" {
		return ""
	}

	var result strings.Builder
	for _, char := range input {
		if entity, exists := HTMLEscapeMap[char]; exists {
			result.WriteString(entity)
		} else {
			result.WriteRune(char)
		}
	}
	return result.String()
}

// SanitizeFilename removes potentially dangerous characters from filenames
func SanitizeFilename(filename string) string {
	if filename == "" {
		return ""
	}

	// Remove dangerous characters
	dangerousChars := regexp.MustCompile(`[<>:"/\\|?*\x00-\x1f]`)
	result := dangerousChars.ReplaceAllString(filename, "")

	// Remove leading/trailing dots
	result = strings.Trim(result, ".")

	// Normalize whitespace
	result = regexp.MustCompile(`\s+`).ReplaceAllString(result, " ")

	// Trim and limit length
	result = strings.TrimSpace(result)
	if len(result) > 255 {
		result = result[:255]
	}

	return result
}

// SanitizeUserInput sanitizes general user input for database/storage
func SanitizeUserInput(input string) string {
	if input == "" {
		return ""
	}

	// Trim whitespace
	result := strings.TrimSpace(input)

	// Remove control characters (except tab, newline, carriage return)
	result = strings.Map(func(r rune) rune {
		if r < 32 && r != 9 && r != 10 && r != 13 {
			return -1
		}
		return r
	}, result)

	// Limit length
	if len(result) > 1000 {
		result = result[:1000]
	}

	return result
}

// SanitizeSearchQuery sanitizes search query input
func SanitizeSearchQuery(query string) string {
	if query == "" {
		return ""
	}

	// Trim whitespace
	result := strings.TrimSpace(query)

	// Remove HTML characters
	htmlChars := regexp.MustCompile(`[<>'"&]`)
	result = htmlChars.ReplaceAllString(result, "")

	// Limit length
	if len(result) > 100 {
		result = result[:100]
	}

	return result
}

// IsValidEmail validates email format using regex
func IsValidEmail(email string) bool {
	if email == "" {
		return false
	}

	// Basic email regex pattern
	emailRegex := regexp.MustCompile(`^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$`)
	return emailRegex.MatchString(email) && len(email) <= 254
}

// IsValidUsername validates username format
func IsValidUsername(username string) bool {
	if username == "" {
		return false
	}

	// Username should contain only alphanumeric characters, underscores, and hyphens
	usernameRegex := regexp.MustCompile(`^[a-zA-Z0-9_-]+$`)
	return usernameRegex.MatchString(username) && len(username) >= 3 && len(username) <= 50
}

// SanitizeSQLLikeQuery escapes special characters for SQL LIKE queries
func SanitizeSQLLikeQuery(query string) string {
	if query == "" {
		return ""
	}

	// Escape SQL LIKE special characters: % and _
	result := strings.ReplaceAll(query, "%", "\\%")
	result = strings.ReplaceAll(result, "_", "\\_")

	return result
}

// NormalizeWhitespace normalizes various whitespace characters to single spaces
func NormalizeWhitespace(input string) string {
	if input == "" {
		return ""
	}

	// Replace various whitespace with single space
	whitespaceRegex := regexp.MustCompile(`\s+`)
	return whitespaceRegex.ReplaceAllString(strings.TrimSpace(input), " ")
}

// RemoveNonPrintable removes non-printable characters
func RemoveNonPrintable(input string) string {
	if input == "" {
		return ""
	}

	return strings.Map(func(r rune) rune {
		if unicode.IsPrint(r) {
			return r
		}
		return -1
	}, input)
}
