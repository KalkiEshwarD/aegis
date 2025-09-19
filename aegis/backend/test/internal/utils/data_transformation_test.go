package utils_test

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"

	"github.com/balkanid/aegis-backend/internal/utils"
)

func TestFormatFileSize(t *testing.T) {
	tests := []struct {
		bytes    int64
		expected string
	}{
		{0, "0 Bytes"},
		{512, "512.00 Bytes"},
		{1024, "1.00 KB"},
		{1536, "1.50 KB"},
		{1048576, "1.00 MB"},
		{1073741824, "1.00 GB"},
		{1099511627776, "1.00 TB"},
		{1125899906842624, "1024.00 TB"}, // Large number
	}

	for _, test := range tests {
		result := utils.FormatFileSize(test.bytes)
		assert.Equal(t, test.expected, result, "FormatFileSize(%d) = %s, expected %s", test.bytes, result, test.expected)
	}
}

func TestGetMimeTypeFromExtension(t *testing.T) {
	tests := []struct {
		filename string
		expected string
	}{
		{"test.txt", "text/plain"},
		{"test.html", "text/html"},
		{"test.css", "text/css"},
		{"test.js", "application/javascript"},
		{"test.json", "application/json"},
		{"test.pdf", "application/pdf"},
		{"test.jpg", "image/jpeg"},
		{"test.jpeg", "image/jpeg"},
		{"test.png", "image/png"},
		{"test.mp4", "video/mp4"},
		{"test.mp3", "audio/mpeg"},
		{"test.zip", "application/zip"},
		{"test.unknown", "application/octet-stream"},
		{"noextension", "application/octet-stream"},
		{"", "application/octet-stream"},
	}

	for _, test := range tests {
		result := utils.GetMimeTypeFromExtension(test.filename)
		assert.Equal(t, test.expected, result, "GetMimeTypeFromExtension(%s) = %s, expected %s", test.filename, result, test.expected)
	}
}

func TestIsImageMimeType(t *testing.T) {
	tests := []struct {
		mimeType string
		expected bool
	}{
		{"image/jpeg", true},
		{"image/png", true},
		{"image/gif", true},
		{"text/plain", false},
		{"video/mp4", false},
		{"", false},
	}

	for _, test := range tests {
		result := utils.IsImageMimeType(test.mimeType)
		assert.Equal(t, test.expected, result, "IsImageMimeType(%s) = %v, expected %v", test.mimeType, result, test.expected)
	}
}

func TestIsVideoMimeType(t *testing.T) {
	tests := []struct {
		mimeType string
		expected bool
	}{
		{"video/mp4", true},
		{"video/avi", true},
		{"image/jpeg", false},
		{"text/plain", false},
		{"", false},
	}

	for _, test := range tests {
		result := utils.IsVideoMimeType(test.mimeType)
		assert.Equal(t, test.expected, result, "IsVideoMimeType(%s) = %v, expected %v", test.mimeType, result, test.expected)
	}
}

func TestIsAudioMimeType(t *testing.T) {
	tests := []struct {
		mimeType string
		expected bool
	}{
		{"audio/mpeg", true},
		{"audio/wav", true},
		{"image/jpeg", false},
		{"text/plain", false},
		{"", false},
	}

	for _, test := range tests {
		result := utils.IsAudioMimeType(test.mimeType)
		assert.Equal(t, test.expected, result, "IsAudioMimeType(%s) = %v, expected %v", test.mimeType, result, test.expected)
	}
}

func TestIsArchiveMimeType(t *testing.T) {
	tests := []struct {
		mimeType string
		expected bool
	}{
		{"application/zip", true},
		{"application/x-rar-compressed", true},
		{"application/x-7z-compressed", true},
		{"application/gzip", true},
		{"text/plain", false},
		{"image/jpeg", false},
		{"", false},
	}

	for _, test := range tests {
		result := utils.IsArchiveMimeType(test.mimeType)
		assert.Equal(t, test.expected, result, "IsArchiveMimeType(%s) = %v, expected %v", test.mimeType, result, test.expected)
	}
}

func TestIsCodeFile(t *testing.T) {
	tests := []struct {
		filename string
		expected bool
	}{
		{"test.js", true},
		{"test.ts", true},
		{"test.html", true},
		{"test.css", true},
		{"test.py", true},
		{"test.go", true},
		{"test.txt", false},
		{"test.jpg", false},
		{"noextension", false},
		{"", false},
	}

	for _, test := range tests {
		result := utils.IsCodeFile(test.filename)
		assert.Equal(t, test.expected, result, "IsCodeFile(%s) = %v, expected %v", test.filename, result, test.expected)
	}
}

func TestIsDocumentFile(t *testing.T) {
	tests := []struct {
		filename string
		expected bool
	}{
		{"test.doc", true},
		{"test.docx", true},
		{"test.txt", true},
		{"test.pdf", false}, // PDF is not in document extensions
		{"test.jpg", false},
		{"noextension", false},
		{"", false},
	}

	for _, test := range tests {
		result := utils.IsDocumentFile(test.filename)
		assert.Equal(t, test.expected, result, "IsDocumentFile(%s) = %v, expected %v", test.filename, result, test.expected)
	}
}

func TestParseInt64(t *testing.T) {
	tests := []struct {
		input    string
		expected int64
		hasError bool
	}{
		{"123", 123, false},
		{"0", 0, false},
		{"-123", -123, false},
		{"", 0, false},
		{"abc", 0, true},
		{"123.45", 0, true},
	}

	for _, test := range tests {
		result, err := utils.ParseInt64(test.input)
		if test.hasError {
			assert.Error(t, err, "ParseInt64(%s) should return error", test.input)
		} else {
			assert.NoError(t, err, "ParseInt64(%s) should not return error", test.input)
			assert.Equal(t, test.expected, result, "ParseInt64(%s) = %d, expected %d", test.input, result, test.expected)
		}
	}
}

func TestParseFloat64(t *testing.T) {
	tests := []struct {
		input    string
		expected float64
		hasError bool
	}{
		{"123.45", 123.45, false},
		{"0", 0.0, false},
		{"-123.45", -123.45, false},
		{"", 0.0, false},
		{"abc", 0.0, true},
	}

	for _, test := range tests {
		result, err := utils.ParseFloat64(test.input)
		if test.hasError {
			assert.Error(t, err, "ParseFloat64(%s) should return error", test.input)
		} else {
			assert.NoError(t, err, "ParseFloat64(%s) should not return error", test.input)
			assert.Equal(t, test.expected, result, "ParseFloat64(%s) = %f, expected %f", test.input, result, test.expected)
		}
	}
}

func TestFormatTimestamp(t *testing.T) {
	testTime := time.Date(2023, 1, 15, 10, 30, 45, 0, time.UTC)
	expected := "2023-01-15T10:30:45Z"
	result := utils.FormatTimestamp(testTime)
	assert.Equal(t, expected, result)
}

func TestParseTimestamp(t *testing.T) {
	tests := []struct {
		input    string
		hasError bool
	}{
		{"2023-01-15T10:30:45Z", false},
		{"", false},
		{"invalid", true},
	}

	for _, test := range tests {
		result, err := utils.ParseTimestamp(test.input)
		if test.hasError {
			assert.Error(t, err, "ParseTimestamp(%s) should return error", test.input)
		} else {
			assert.NoError(t, err, "ParseTimestamp(%s) should not return error", test.input)
			if test.input != "" {
				expected, _ := time.Parse(time.RFC3339, test.input)
				assert.Equal(t, expected, result, "ParseTimestamp(%s) = %v, expected %v", test.input, result, expected)
			}
		}
	}
}

func TestTruncateString(t *testing.T) {
	tests := []struct {
		input    string
		maxLen   int
		expected string
	}{
		{"hello", 10, "hello"},
		{"hello world", 5, "he..."},
		{"hello world", 8, "hello..."},
		{"hi", 3, "hi"},
		{"hi", 2, "hi"},
		{"hi", 1, "h"},
		{"", 5, ""},
	}

	for _, test := range tests {
		result := utils.TruncateString(test.input, test.maxLen)
		assert.Equal(t, test.expected, result, "TruncateString(%s, %d) = %s, expected %s", test.input, test.maxLen, result, test.expected)
	}
}

func TestSlugify(t *testing.T) {
	tests := []struct {
		input    string
		expected string
	}{
		{"Hello World", "hello-world"},
		{"Hello   World", "hello-world"},
		{"Hello@World!", "hello-world"},
		{"Hello--World", "hello-world"},
		{"", ""},
		{"a", "a"},
		{"A", "a"},
		{"123", "123"},
		{"hello-world", "hello-world"},
		{"--hello--", "hello"},
	}

	for _, test := range tests {
		result := utils.Slugify(test.input)
		assert.Equal(t, test.expected, result, "Slugify(%s) = %s, expected %s", test.input, result, test.expected)
	}
}

func TestCapitalizeFirst(t *testing.T) {
	tests := []struct {
		input    string
		expected string
	}{
		{"hello", "Hello"},
		{"HELLO", "HELLO"},
		{"hELLO", "HELLO"},
		{"", ""},
		{"a", "A"},
		{"123", "123"},
	}

	for _, test := range tests {
		result := utils.CapitalizeFirst(test.input)
		assert.Equal(t, test.expected, result, "CapitalizeFirst(%s) = %s, expected %s", test.input, result, test.expected)
	}
}

func TestCamelToSnake(t *testing.T) {
	tests := []struct {
		input    string
		expected string
	}{
		{"camelCase", "camel_case"},
		{"CamelCase", "camel_case"},
		{"XMLHttpRequest", "xml_http_request"},
		{"simple", "simple"},
		{"", ""},
		{"A", "a"},
	}

	for _, test := range tests {
		result := utils.CamelToSnake(test.input)
		assert.Equal(t, test.expected, result, "CamelToSnake(%s) = %s, expected %s", test.input, result, test.expected)
	}
}

func TestSnakeToCamel(t *testing.T) {
	tests := []struct {
		input    string
		expected string
	}{
		{"snake_case", "snakeCase"},
		{"another_example", "anotherExample"},
		{"simple", "simple"},
		{"", ""},
		{"a_b_c", "aBC"},
		{"_leading", "Leading"},
		{"trailing_", "trailing"},
	}

	for _, test := range tests {
		result := utils.SnakeToCamel(test.input)
		assert.Equal(t, test.expected, result, "SnakeToCamel(%s) = %s, expected %s", test.input, result, test.expected)
	}
}