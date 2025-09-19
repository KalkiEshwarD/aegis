package utils_test

import (
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/balkanid/aegis-backend/internal/utils"
)

func TestNewValidationResult(t *testing.T) {
	result := utils.NewValidationResult()

	assert.True(t, result.Valid)
	assert.Empty(t, result.Errors)
	assert.False(t, result.HasErrors())
}

func TestValidationResultAddError(t *testing.T) {
	result := utils.NewValidationResult()

	result.AddError("First error")
	assert.False(t, result.Valid)
	assert.True(t, result.HasErrors())
	assert.Equal(t, []string{"First error"}, result.Errors)

	result.AddError("Second error")
	assert.Equal(t, []string{"First error", "Second error"}, result.Errors)
}

func TestValidateEmail(t *testing.T) {
	tests := []struct {
		name     string
		email    string
		expected bool
		errors   []string
	}{
		{
			name:     "valid email",
			email:    "test@example.com",
			expected: true,
			errors:   []string{},
		},
		{
			name:     "valid email with subdomain",
			email:    "user@sub.example.com",
			expected: true,
			errors:   []string{},
		},
		{
			name:     "valid email with plus",
			email:    "user+tag@example.com",
			expected: true,
			errors:   []string{},
		},
		{
			name:     "empty email",
			email:    "",
			expected: false,
			errors:   []string{"Email is required"},
		},
		{
			name:     "invalid format",
			email:    "invalid-email",
			expected: false,
			errors:   []string{"Invalid email format", "Invalid email address"},
		},
		{
			name:     "too long email",
			email:    string(make([]byte, 255)) + "@example.com",
			expected: false,
			errors:   []string{"Email is too long (max 254 characters)"},
		},
		{
			name:     "spaces in email",
			email:    "test @ example.com",
			expected: false,
			errors:   []string{"Invalid email address"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := utils.ValidateEmail(tt.email)
			assert.Equal(t, tt.expected, result.Valid)
			assert.Equal(t, tt.errors, result.Errors)
		})
	}
}

func TestValidateUsername(t *testing.T) {
	tests := []struct {
		name     string
		username string
		expected bool
		errors   []string
	}{
		{
			name:     "valid username",
			username: "testuser123",
			expected: true,
			errors:   []string{},
		},
		{
			name:     "valid with underscore",
			username: "test_user",
			expected: true,
			errors:   []string{},
		},
		{
			name:     "valid with hyphen",
			username: "test-user",
			expected: true,
			errors:   []string{},
		},
		{
			name:     "empty username",
			username: "",
			expected: false,
			errors:   []string{"Username is required"},
		},
		{
			name:     "too short",
			username: "ab",
			expected: false,
			errors:   []string{"Username must be at least 3 characters long"},
		},
		{
			name:     "too long",
			username: string(make([]byte, 51)),
			expected: false,
			errors:   []string{"Username must be no more than 50 characters long"},
		},
		{
			name:     "invalid characters",
			username: "test@user",
			expected: false,
			errors:   []string{"Username can only contain letters, numbers, underscores, and hyphens"},
		},
		{
			name:     "spaces",
			username: "test user",
			expected: false,
			errors:   []string{"Username can only contain letters, numbers, underscores, and hyphens"},
		},
		{
			name:     "multiple errors",
			username: "a@",
			expected: false,
			errors: []string{
				"Username must be at least 3 characters long",
				"Username can only contain letters, numbers, underscores, and hyphens",
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := utils.ValidateUsername(tt.username)
			assert.Equal(t, tt.expected, result.Valid)
			assert.Equal(t, tt.errors, result.Errors)
		})
	}
}

func TestValidatePassword(t *testing.T) {
	reqs := utils.DefaultPasswordRequirements()

	tests := []struct {
		name     string
		password string
		expected bool
		hasError bool
	}{
		{
			name:     "valid password",
			password: "StrongPass123!",
			expected: true,
			hasError: false,
		},
		{
			name:     "empty password",
			password: "",
			expected: false,
			hasError: true,
		},
		{
			name:     "too short",
			password: "Short1!",
			expected: false,
			hasError: true,
		},
		{
			name:     "no uppercase",
			password: "strongpass123!",
			expected: false,
			hasError: true,
		},
		{
			name:     "no lowercase",
			password: "STRONGPASS123!",
			expected: false,
			hasError: true,
		},
		{
			name:     "no digit",
			password: "StrongPass!",
			expected: false,
			hasError: true,
		},
		{
			name:     "no special char",
			password: "StrongPass123",
			expected: false,
			hasError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := utils.ValidatePassword(tt.password, reqs)
			assert.Equal(t, tt.expected, result.Valid)
			if tt.hasError {
				assert.True(t, result.HasErrors())
			}
		})
	}
}

func TestDefaultPasswordRequirements(t *testing.T) {
	reqs := utils.DefaultPasswordRequirements()

	assert.Equal(t, 8, reqs.MinLength)
	assert.True(t, reqs.RequireUpper)
	assert.True(t, reqs.RequireLower)
	assert.True(t, reqs.RequireDigit)
	assert.True(t, reqs.RequireSpecial)
	assert.NotEmpty(t, reqs.SpecialChars)
}

func TestValidateFile(t *testing.T) {
	rules := utils.FileValidationRules{
		MaxSize:           1000,
		AllowedMimeTypes:  []string{"text/", "image/"},
		AllowedExtensions: []string{".txt", ".jpg"},
		RequireValidName:  true,
	}

	tests := []struct {
		name     string
		filename string
		size     int64
		mimeType string
		expected bool
	}{
		{
			name:     "valid file",
			filename: "test.txt",
			size:     500,
			mimeType: "text/plain",
			expected: true,
		},
		{
			name:     "file too large",
			filename: "test.txt",
			size:     1500,
			mimeType: "text/plain",
			expected: false,
		},
		{
			name:     "invalid mime type",
			filename: "test.pdf",
			size:     500,
			mimeType: "application/pdf",
			expected: false,
		},
		{
			name:     "invalid extension",
			filename: "test.exe",
			size:     500,
			mimeType: "text/plain",
			expected: false,
		},
		{
			name:     "dangerous filename",
			filename: "test<script>.txt",
			size:     500,
			mimeType: "text/plain",
			expected: false,
		},
		{
			name:     "empty filename",
			filename: "",
			size:     500,
			mimeType: "text/plain",
			expected: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := utils.ValidateFile(tt.filename, tt.size, tt.mimeType, rules)
			assert.Equal(t, tt.expected, result.Valid)
		})
	}
}

func TestValidateString(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		rules    utils.StringValidationRules
		expected bool
	}{
		{
			name:     "valid required string",
			input:    "hello",
			rules:    utils.StringValidationRules{Required: true, MinLength: 3, MaxLength: 10},
			expected: true,
		},
		{
			name:     "empty optional string",
			input:    "",
			rules:    utils.StringValidationRules{Required: false},
			expected: true,
		},
		{
			name:     "empty required string",
			input:    "",
			rules:    utils.StringValidationRules{Required: true},
			expected: false,
		},
		{
			name:     "too short",
			input:    "hi",
			rules:    utils.StringValidationRules{MinLength: 3},
			expected: false,
		},
		{
			name:     "too long",
			input:    "this is too long",
			rules:    utils.StringValidationRules{MaxLength: 10},
			expected: false,
		},
		{
			name:     "pattern match",
			input:    "abc123",
			rules:    utils.StringValidationRules{Pattern: `^[a-z]+\d+$`},
			expected: true,
		},
		{
			name:     "pattern mismatch",
			input:    "123abc",
			rules:    utils.StringValidationRules{Pattern: `^[a-z]+\d+$`},
			expected: false,
		},
		{
			name:     "trim whitespace",
			input:    "  hello  ",
			rules:    utils.StringValidationRules{TrimWhitespace: true, Required: true},
			expected: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := utils.ValidateString(tt.input, tt.rules)
			assert.Equal(t, tt.expected, result.Valid)
		})
	}
}

func TestValidateNumber(t *testing.T) {
	rules := utils.NumericValidationRules{
		Required: true,
		Min:      0,
		Max:      100,
		IsInt:    false,
	}

	tests := []struct {
		name     string
		input    interface{}
		expected bool
	}{
		{"valid int", 50, true},
		{"valid float", 50.5, true},
		{"too small", -5, false},
		{"too large", 150, false},
		{"nil required", nil, false},
		{"nil not required", func() interface{} { r := rules; r.Required = false; return nil }(), true},
		{"non-integer when int required", func() interface{} {
			r := rules
			r.IsInt = true
			return 50.5
		}(), false},
		{"string input", "50", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var testRules utils.NumericValidationRules
			if tt.name == "nil not required" {
				testRules = utils.NumericValidationRules{Required: false}
			} else if tt.name == "non-integer when int required" {
				testRules = utils.NumericValidationRules{Required: true, Min: 0, Max: 100, IsInt: true}
			} else {
				testRules = rules
			}
			result := utils.ValidateNumber(tt.input, testRules)
			assert.Equal(t, tt.expected, result.Valid)
		})
	}
}

func TestValidateURL(t *testing.T) {
	tests := []struct {
		name     string
		url      string
		expected bool
	}{
		{"valid http", "http://example.com", true},
		{"valid https", "https://example.com", true},
		{"empty url", "", false},
		{"invalid format", "not-a-url", false},
		{"no protocol", "example.com", false},
		{"ftp protocol", "ftp://example.com", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := utils.ValidateURL(tt.url)
			assert.Equal(t, tt.expected, result.Valid)
		})
	}
}

func TestValidatePhoneNumber(t *testing.T) {
	tests := []struct {
		name     string
		phone    string
		expected bool
	}{
		{"valid US", "+1234567890", true},
		{"valid international", "+44 20 7123 4567", true},
		{"valid with parens", "(123) 456-7890", true},
		{"empty phone", "", false},
		{"too short", "123", false},
		{"too long", "+12345678901234567890", false},
		{"invalid chars", "abc1234567", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := utils.ValidatePhoneNumber(tt.phone)
			assert.Equal(t, tt.expected, result.Valid)
		})
	}
}

func TestValidateUUID(t *testing.T) {
	tests := []struct {
		name     string
		uuid     string
		expected bool
	}{
		{
			name:     "valid UUID",
			uuid:     "550e8400-e29b-41d4-a716-446655440000",
			expected: true,
		},
		{
			name:     "valid UUID uppercase",
			uuid:     "550E8400-E29B-41D4-A716-446655440000",
			expected: true,
		},
		{
			name:     "empty UUID",
			uuid:     "",
			expected: false,
		},
		{
			name:     "invalid format",
			uuid:     "not-a-uuid",
			expected: false,
		},
		{
			name:     "too short",
			uuid:     "550e8400-e29b-41d4-a716",
			expected: false,
		},
		{
			name:     "invalid characters",
			uuid:     "550e8400-e29b-41d4-a716-44665544000g",
			expected: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := utils.ValidateUUID(tt.uuid)
			assert.Equal(t, tt.expected, result.Valid)
		})
	}
}

func TestValidateDate(t *testing.T) {
	tests := []struct {
		name     string
		dateStr  string
		format   string
		expected bool
	}{
		{
			name:     "valid YYYY-MM-DD",
			dateStr:  "2023-12-25",
			format:   "YYYY-MM-DD",
			expected: true,
		},
		{
			name:     "empty date",
			dateStr:  "",
			format:   "YYYY-MM-DD",
			expected: false,
		},
		{
			name:     "invalid format",
			dateStr:  "12-25-2023",
			format:   "YYYY-MM-DD",
			expected: false,
		},
		{
			name:     "invalid date values",
			dateStr:  "2023-13-45",
			format:   "YYYY-MM-DD",
			expected: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := utils.ValidateDate(tt.dateStr, tt.format)
			assert.Equal(t, tt.expected, result.Valid)
		})
	}
}

func TestCombineValidationResults(t *testing.T) {
	validResult := utils.NewValidationResult()
	invalidResult1 := utils.NewValidationResult()
	invalidResult1.AddError("Error 1")
	invalidResult2 := utils.NewValidationResult()
	invalidResult2.AddError("Error 2")

	result := utils.CombineValidationResults(validResult, invalidResult1, invalidResult2)

	assert.False(t, result.Valid)
	assert.Equal(t, []string{"Error 1", "Error 2"}, result.Errors)
}

func TestCombineValidationResultsAllValid(t *testing.T) {
	validResult1 := utils.NewValidationResult()
	validResult2 := utils.NewValidationResult()

	result := utils.CombineValidationResults(validResult1, validResult2)

	assert.True(t, result.Valid)
	assert.Empty(t, result.Errors)
}