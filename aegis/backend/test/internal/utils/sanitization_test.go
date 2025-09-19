package utils_test

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/balkanid/aegis-backend/internal/utils"
)

func TestSanitizeHTML(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected string
	}{
		{
			name:     "empty string",
			input:    "",
			expected: "",
		},
		{
			name:     "no special chars",
			input:    "hello world",
			expected: "hello world",
		},
		{
			name:     "ampersand",
			input:    "Tom & Jerry",
			expected: "Tom & Jerry",
		},
		{
			name:     "less than",
			input:    "5 < 10",
			expected: "5 < 10",
		},
		{
			name:     "greater than",
			input:    "10 > 5",
			expected: "10 > 5",
		},
		{
			name:     "quotes",
			input:    `"Hello"`,
			expected: `"Hello"`,
		},
		{
			name:     "apostrophe",
			input:    "Don't",
			expected: "Don&#x27;t",
		},
		{
			name:     "forward slash",
			input:    "path/to/file",
			expected: "path&#x2F;to&#x2F;file",
		},
		{
			name:     "backtick",
			input:    "`code`",
			expected: "&#x60;code&#x60;",
		},
		{
			name:     "equals",
			input:    "a=b",
			expected: "a&#x3D;b",
		},
		{
			name:     "mixed special chars",
			input:    `<script>alert("XSS")</script>`,
			expected: `<script>alert(&#x22;XSS&#x22;)</script>`,
		},
		{
			name:     "unicode characters",
			input:    "café résumé naïve",
			expected: "café résumé naïve",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := utils.SanitizeHTML(tt.input)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestSanitizeFilename(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected string
	}{
		{
			name:     "empty string",
			input:    "",
			expected: "",
		},
		{
			name:     "valid filename",
			input:    "document.pdf",
			expected: "document.pdf",
		},
		{
			name:     "dangerous chars",
			input:    `file<>:|?"*\.txt`,
			expected: "file.txt",
		},
		{
			name:     "control chars",
			input:    "file\x00\x01\x1f.txt",
			expected: "file.txt",
		},
		{
			name:     "leading dots",
			input:    "...file.txt",
			expected: "file.txt",
		},
		{
			name:     "trailing dots",
			input:    "file.txt...",
			expected: "file.txt",
		},
		{
			name:     "multiple spaces",
			input:    "file   with    spaces.txt",
			expected: "file with spaces.txt",
		},
		{
			name:     "long filename",
			input:    strings.Repeat("a", 300) + ".txt",
			expected: strings.Repeat("a", 255),
		},
		{
			name:     "only dangerous chars",
			input:    `<>:|?"*\`,
			expected: "",
		},
		{
			name:     "spaces and dots only",
			input:    "   ...   ",
			expected: "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := utils.SanitizeFilename(tt.input)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestSanitizeUserInput(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected string
	}{
		{
			name:     "empty string",
			input:    "",
			expected: "",
		},
		{
			name:     "normal text",
			input:    "Hello World",
			expected: "Hello World",
		},
		{
			name:     "with tabs and newlines",
			input:    "Hello\tWorld\nTest",
			expected: "Hello\tWorld\nTest",
		},
		{
			name:     "control chars removed",
			input:    "Hello\x00\x01\x1fWorld",
			expected: "HelloWorld",
		},
		{
			name:     "leading/trailing spaces",
			input:    "  Hello World  ",
			expected: "Hello World",
		},
		{
			name:     "long input truncated",
			input:    strings.Repeat("a", 1200),
			expected: strings.Repeat("a", 1000),
		},
		{
			name:     "carriage return preserved",
			input:    "Line1\r\nLine2",
			expected: "Line1\r\nLine2",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := utils.SanitizeUserInput(tt.input)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestSanitizeSearchQuery(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected string
	}{
		{
			name:     "empty string",
			input:    "",
			expected: "",
		},
		{
			name:     "normal query",
			input:    "search term",
			expected: "search term",
		},
		{
			name:     "html chars removed",
			input:    `<script>alert("xss")</script>`,
			expected: "scriptalertxss/script",
		},
		{
			name:     "quotes removed",
			input:    `"quoted" 'single'`,
			expected: "quoted single",
		},
		{
			name:     "ampersand removed",
			input:    "Tom & Jerry",
			expected: "Tom  Jerry",
		},
		{
			name:     "whitespace trimmed",
			input:    "  search term  ",
			expected: "search term",
		},
		{
			name:     "long query truncated",
			input:    strings.Repeat("a", 150),
			expected: strings.Repeat("a", 100),
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := utils.SanitizeSearchQuery(tt.input)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestIsValidEmail(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected bool
	}{
		{"empty string", "", false},
		{"valid email", "test@example.com", true},
		{"valid email with subdomain", "test@sub.example.com", true},
		{"valid email with numbers", "test123@example.com", true},
		{"valid email with dots", "test.email@example.com", true},
		{"valid email with plus", "test+tag@example.com", true},
		{"invalid no at", "testexample.com", false},
		{"invalid no domain", "test@", false},
		{"invalid no local", "@example.com", false},
		{"invalid spaces", "test @ example.com", false},
		{"invalid special chars", "test<>@example.com", false},
		{"invalid double at", "test@@example.com", false},
		{"invalid no tld", "test@example", false},
		{"invalid single char tld", "test@example.c", false},
		{"too long email", strings.Repeat("a", 250) + "@example.com", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := utils.IsValidEmail(tt.input)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestIsValidUsername(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected bool
	}{
		{"empty string", "", false},
		{"too short", "ab", false},
		{"valid username", "testuser", true},
		{"valid with underscore", "test_user", true},
		{"valid with hyphen", "test-user", true},
		{"valid with numbers", "user123", true},
		{"valid mixed", "user_123-test", true},
		{"too long", strings.Repeat("a", 51), false},
		{"invalid spaces", "test user", false},
		{"invalid special chars", "test@user", false},
		{"invalid dots", "test.user", false},
		{"invalid uppercase", "TestUser", false},
		{"starts with underscore", "_testuser", true},
		{"starts with hyphen", "-testuser", true},
		{"starts with number", "1testuser", true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := utils.IsValidUsername(tt.input)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestSanitizeSQLLikeQuery(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected string
	}{
		{
			name:     "empty string",
			input:    "",
			expected: "",
		},
		{
			name:     "no special chars",
			input:    "search term",
			expected: "search term",
		},
		{
			name:     "percent escaped",
			input:    "50%",
			expected: "50\\%",
		},
		{
			name:     "underscore escaped",
			input:    "test_case",
			expected: "test\\_case",
		},
		{
			name:     "both chars",
			input:    "test%_case",
			expected: "test\\%\\_case",
		},
		{
			name:     "multiple occurrences",
			input:    "%test%_case%",
			expected: "\\%test\\%\\_case\\%",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := utils.SanitizeSQLLikeQuery(tt.input)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestNormalizeWhitespace(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected string
	}{
		{
			name:     "empty string",
			input:    "",
			expected: "",
		},
		{
			name:     "no whitespace",
			input:    "hello",
			expected: "hello",
		},
		{
			name:     "single spaces",
			input:    "hello world",
			expected: "hello world",
		},
		{
			name:     "multiple spaces",
			input:    "hello   world",
			expected: "hello world",
		},
		{
			name:     "tabs",
			input:    "hello\tworld",
			expected: "hello world",
		},
		{
			name:     "newlines",
			input:    "hello\nworld",
			expected: "hello world",
		},
		{
			name:     "mixed whitespace",
			input:    "hello \t\n  world",
			expected: "hello world",
		},
		{
			name:     "leading/trailing whitespace",
			input:    "  hello world  ",
			expected: "hello world",
		},
		{
			name:     "only whitespace",
			input:    " \t\n ",
			expected: "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := utils.NormalizeWhitespace(tt.input)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestRemoveNonPrintable(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected string
	}{
		{
			name:     "empty string",
			input:    "",
			expected: "",
		},
		{
			name:     "printable chars",
			input:    "Hello World 123!@#",
			expected: "Hello World 123!@#",
		},
		{
			name:     "control chars removed",
			input:    "Hello\x00\x01\x1fWorld",
			expected: "HelloWorld",
		},
		{
			name:     "unicode printable",
			input:    "café résumé naïve",
			expected: "café résumé naïve",
		},
		{
			name:     "mixed printable and non-printable",
			input:    "Hello\x00World\x1fTest",
			expected: "HelloWorldTest",
		},
		{
			name:     "only non-printable",
			input:    "\x00\x01\x1f",
			expected: "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := utils.RemoveNonPrintable(tt.input)
			assert.Equal(t, tt.expected, result)
		})
	}
}