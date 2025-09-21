package utils_test

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/balkanid/aegis-backend/internal/utils"
)

func TestCalculateFileHash(t *testing.T) {
	tests := []struct {
		content  string
		expected string
	}{
		{"hello world", "b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9"},
		{"", "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"},
		{"test content", "6ae8a75555209fd6c44157c0aed8016e763ff435a19cf186f76863140143ff72"},
	}

	for _, test := range tests {
		reader := strings.NewReader(test.content)
		hash, err := utils.CalculateFileHash(reader)
		assert.NoError(t, err)
		assert.Equal(t, test.expected, hash)
	}
}

func TestCalculateMD5Hash(t *testing.T) {
	tests := []struct {
		content  string
		expected string
	}{
		{"hello world", "5d41402abc4b2a76b9719d911017c592"},
		{"", "d41d8cd98f00b204e9800998ecf8427e"},
		{"test content", "9a0364b9e99bb480dd25e1f0284c8555"},
	}

	for _, test := range tests {
		reader := strings.NewReader(test.content)
		hash, err := utils.CalculateMD5Hash(reader)
		assert.NoError(t, err)
		assert.Equal(t, test.expected, hash)
	}
}

func TestDetectMimeType(t *testing.T) {
	tests := []struct {
		filename string
		content  string
		expected string
	}{
		{"test.txt", "hello world", "text/plain"},
		{"test.json", "{\"key\": \"value\"}", "application/json"},
		{"test.unknown", "some content", "application/octet-stream"},
	}

	for _, test := range tests {
		reader := strings.NewReader(test.content)
		mimeType, err := utils.DetectMimeType(test.filename, reader)
		assert.NoError(t, err)
		assert.Equal(t, test.expected, mimeType)
	}
}

func TestGetFileExtension(t *testing.T) {
	tests := []struct {
		filename string
		expected string
	}{
		{"test.txt", ".txt"},
		{"test.TXT", ".txt"},
		{"test", ""},
		{"test.file.name.txt", ".txt"},
		{"", ""},
	}

	for _, test := range tests {
		result := utils.GetFileExtension(test.filename)
		assert.Equal(t, test.expected, result)
	}
}

func TestIsValidFileExtension(t *testing.T) {
	allowed := []string{".txt", ".jpg", ".pdf"}

	tests := []struct {
		filename string
		expected bool
	}{
		{"test.txt", true},
		{"test.TXT", true},
		{"test.jpg", true},
		{"test.pdf", true},
		{"test.doc", false},
		{"test", false},
		{"", false},
	}

	for _, test := range tests {
		result := utils.IsValidFileExtension(test.filename, allowed)
		assert.Equal(t, test.expected, result)
	}
}

func TestIsValidMimeType(t *testing.T) {
	allowed := []string{"text/", "image/"}

	tests := []struct {
		mimeType string
		expected bool
	}{
		{"text/plain", true},
		{"text/html", true},
		{"image/jpeg", true},
		{"image/png", true},
		{"application/pdf", false},
		{"", false},
	}

	for _, test := range tests {
		result := utils.IsValidMimeType(test.mimeType, allowed)
		assert.Equal(t, test.expected, result)
	}
}

func TestGenerateUniqueFilename(t *testing.T) {
	filename := "test.txt"
	result := utils.GenerateUniqueFilename(filename)

	assert.Contains(t, result, "test_")
	assert.Contains(t, result, ".txt")
	assert.NotEqual(t, filename, result)
}

func TestValidateFileSize(t *testing.T) {
	tests := []struct {
		size     int64
		minSize  int64
		maxSize  int64
		hasError bool
	}{
		{1000, 100, 2000, false},
		{50, 100, 2000, true},    // Too small
		{3000, 100, 2000, true},  // Too large
		{100, 100, 2000, false},  // Min boundary
		{2000, 100, 2000, false}, // Max boundary
	}

	for _, test := range tests {
		err := utils.ValidateFileSize(test.size, test.minSize, test.maxSize)
		if test.hasError {
			assert.Error(t, err)
		} else {
			assert.NoError(t, err)
		}
	}
}

func TestGetFileCategory(t *testing.T) {
	tests := []struct {
		mimeType string
		expected string
	}{
		{"image/jpeg", "image"},
		{"video/mp4", "video"},
		{"audio/mpeg", "audio"},
		{"text/plain", "document"},
		{"application/pdf", "document"},
		{"application/zip", "archive"},
		{"application/json", "data"},
		{"application/octet-stream", "other"},
	}

	for _, test := range tests {
		result := utils.GetFileCategory(test.mimeType)
		assert.Equal(t, test.expected, result)
	}
}

func TestIsTextFile(t *testing.T) {
	tests := []struct {
		mimeType string
		expected bool
	}{
		{"text/plain", true},
		{"application/json", true},
		{"application/xml", true},
		{"application/javascript", true},
		{"image/jpeg", false},
		{"", false},
	}

	for _, test := range tests {
		result := utils.IsTextFile(test.mimeType)
		assert.Equal(t, test.expected, result)
	}
}

func TestIsImageFile(t *testing.T) {
	tests := []struct {
		mimeType string
		expected bool
	}{
		{"image/jpeg", true},
		{"image/png", true},
		{"text/plain", false},
		{"", false},
	}

	for _, test := range tests {
		result := utils.IsImageFile(test.mimeType)
		assert.Equal(t, test.expected, result)
	}
}

func TestIsVideoFile(t *testing.T) {
	tests := []struct {
		mimeType string
		expected bool
	}{
		{"video/mp4", true},
		{"video/avi", true},
		{"text/plain", false},
		{"", false},
	}

	for _, test := range tests {
		result := utils.IsVideoFile(test.mimeType)
		assert.Equal(t, test.expected, result)
	}
}

func TestIsAudioFile(t *testing.T) {
	tests := []struct {
		mimeType string
		expected bool
	}{
		{"audio/mpeg", true},
		{"audio/wav", true},
		{"text/plain", false},
		{"", false},
	}

	for _, test := range tests {
		result := utils.IsAudioFile(test.mimeType)
		assert.Equal(t, test.expected, result)
	}
}

func TestIsArchiveFile(t *testing.T) {
	tests := []struct {
		mimeType string
		expected bool
	}{
		{"application/zip", true},
		{"application/x-rar-compressed", true},
		{"application/x-7z-compressed", true},
		{"application/x-tar", true},
		{"application/gzip", true},
		{"text/plain", false},
		{"", false},
	}

	for _, test := range tests {
		result := utils.IsArchiveFile(test.mimeType)
		assert.Equal(t, test.expected, result)
	}
}

func TestGetFileIconType(t *testing.T) {
	tests := []struct {
		mimeType string
		filename string
		expected string
	}{
		{"image/jpeg", "test.jpg", "image"},
		{"video/mp4", "test.mp4", "video"},
		{"audio/mpeg", "test.mp3", "audio"},
		{"application/pdf", "test.pdf", "pdf"},
		{"text/plain", "test.txt", "document"},
		{"application/zip", "test.zip", "archive"},
		{"application/json", "test.json", "data"},
		{"text/javascript", "test.js", "code"},
		{"application/octet-stream", "test.unknown", "file"},
	}

	for _, test := range tests {
		result := utils.GetFileIconType(test.mimeType, test.filename)
		assert.Equal(t, test.expected, result)
	}
}

func TestGetFileInfo(t *testing.T) {
	metadata := utils.GetFileInfo("test.txt", 1024, "text/plain")

	assert.Equal(t, "test.txt", metadata.Filename)
	assert.Equal(t, int64(1024), metadata.Size)
	assert.Equal(t, "text/plain", metadata.MimeType)
	assert.Equal(t, ".txt", metadata.Extension)
	assert.NotZero(t, metadata.CreatedAt)
	assert.NotZero(t, metadata.ModifiedAt)
}

func TestValidateFilename(t *testing.T) {
	tests := []struct {
		filename string
		hasError bool
	}{
		{"valid.txt", false},
		{"", true},
		{strings.Repeat("a", 256), true},
		{"test<file.txt", true},
		{"test>file.txt", true},
		{"test:file.txt", true},
		{"test\"file.txt", true},
		{"test|file.txt", true},
		{"test?file.txt", true},
		{"test*file.txt", true},
		{"test\x00file.txt", true},
		{"CON.txt", true},
		{"con.txt", true},
		{"normal_file.txt", false},
	}

	for _, test := range tests {
		err := utils.ValidateFilename(test.filename)
		if test.hasError {
			assert.Error(t, err)
		} else {
			assert.NoError(t, err)
		}
	}
}

func TestSanitizePath(t *testing.T) {
	tests := []struct {
		input    string
		expected string
	}{
		{"path/to/file", "path/to/file"},
		{"path\\to\\file", "path/to/file"},
		{"/path/to/file", "path/to/file"},
		{"path/to/file/", "path/to/file"},
		{"path/../to/file", "path/to/file"},
		{"", ""},
	}

	for _, test := range tests {
		result := utils.SanitizePath(test.input)
		assert.Equal(t, test.expected, result)
	}
}

func TestIsPathSafe(t *testing.T) {
	tests := []struct {
		path     string
		expected bool
	}{
		{"path/to/file", true},
		{"file.txt", true},
		{"path/../file", false},
		{"/absolute/path", false},
		{"\\absolute\\path", false},
		{"C:\\windows\\file", false},
		{"c:/windows/file", false},
		{"", true},
	}

	for _, test := range tests {
		result := utils.IsPathSafe(test.path)
		assert.Equal(t, test.expected, result)
	}
}
