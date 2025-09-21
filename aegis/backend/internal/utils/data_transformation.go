package utils

import (
	"fmt"
	"math"
	"path/filepath"
	"strconv"
	"strings"
	"time"
)

// FormatFileSize formats bytes into human readable format (similar to frontend)
func FormatFileSize(bytes int64) string {
	if bytes == 0 {
		return "0 Bytes"
	}

	const unit = 1024
	sizes := []string{"Bytes", "KB", "MB", "GB", "TB"}

	i := int(math.Log(float64(bytes)) / math.Log(unit))
	if i >= len(sizes) {
		i = len(sizes) - 1
	}

	size := float64(bytes) / math.Pow(unit, float64(i))
	return fmt.Sprintf("%.2f %s", size, sizes[i])
}

// GetMimeTypeFromExtension returns MIME type based on file extension
func GetMimeTypeFromExtension(filename string) string {
	ext := strings.ToLower(filepath.Ext(filename))
	if ext == "" {
		return "application/octet-stream"
	}

	// Remove the dot from extension
	ext = ext[1:]

	mimeTypes := map[string]string{
		"txt":  "text/plain",
		"html": "text/html",
		"css":  "text/css",
		"js":   "application/javascript",
		"json": "application/json",
		"xml":  "application/xml",
		"pdf":  "application/pdf",
		"doc":  "application/msword",
		"docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
		"xls":  "application/vnd.ms-excel",
		"xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
		"ppt":  "application/vnd.ms-powerpoint",
		"pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
		"jpg":  "image/jpeg",
		"jpeg": "image/jpeg",
		"png":  "image/png",
		"gif":  "image/gif",
		"bmp":  "image/bmp",
		"svg":  "image/svg+xml",
		"mp4":  "video/mp4",
		"avi":  "video/x-msvideo",
		"mov":  "video/quicktime",
		"wmv":  "video/x-ms-wmv",
		"mp3":  "audio/mpeg",
		"wav":  "audio/wav",
		"flac": "audio/flac",
		"zip":  "application/zip",
		"rar":  "application/x-rar-compressed",
		"7z":   "application/x-7z-compressed",
		"tar":  "application/x-tar",
		"gz":   "application/gzip",
	}

	if mimeType, exists := mimeTypes[ext]; exists {
		return mimeType
	}
	return "application/octet-stream"
}

// IsImageMimeType checks if MIME type is an image
func IsImageMimeType(mimeType string) bool {
	return strings.HasPrefix(mimeType, "image/")
}

// IsVideoMimeType checks if MIME type is a video
func IsVideoMimeType(mimeType string) bool {
	return strings.HasPrefix(mimeType, "video/")
}

// IsAudioMimeType checks if MIME type is an audio
func IsAudioMimeType(mimeType string) bool {
	return strings.HasPrefix(mimeType, "audio/")
}

// IsArchiveMimeType checks if MIME type is an archive
func IsArchiveMimeType(mimeType string) bool {
	archiveTypes := []string{"zip", "rar", "7z", "tar", "gzip", "x-tar", "x-rar-compressed", "x-7z-compressed"}
	for _, archiveType := range archiveTypes {
		if strings.Contains(mimeType, archiveType) {
			return true
		}
	}
	return false
}

// IsCodeFile checks if file extension indicates a code file
func IsCodeFile(filename string) bool {
	ext := strings.ToLower(filepath.Ext(filename))
	if ext == "" {
		return false
	}

	codeExtensions := []string{".js", ".ts", ".jsx", ".tsx", ".html", ".css", ".scss", ".json", ".xml", ".py", ".java", ".cpp", ".c", ".php", ".rb", ".go", ".rs"}
	return containsString(codeExtensions, ext)
}

// IsDocumentFile checks if file extension indicates a document
func IsDocumentFile(filename string) bool {
	ext := strings.ToLower(filepath.Ext(filename))
	if ext == "" {
		return false
	}

	docExtensions := []string{".doc", ".docx", ".txt", ".rtf", ".odt"}
	return containsString(docExtensions, ext)
}

// containsString checks if slice contains string
func containsString(slice []string, item string) bool {
	for _, s := range slice {
		if s == item {
			return true
		}
	}
	return false
}

// ParseInt64 safely parses string to int64
func ParseInt64(s string) (int64, error) {
	if s == "" {
		return 0, nil
	}
	return strconv.ParseInt(s, 10, 64)
}

// ParseFloat64 safely parses string to float64
func ParseFloat64(s string) (float64, error) {
	if s == "" {
		return 0.0, nil
	}
	return strconv.ParseFloat(s, 64)
}

// FormatTimestamp formats time.Time to ISO 8601 string
func FormatTimestamp(t time.Time) string {
	return t.Format(time.RFC3339)
}

// ParseTimestamp parses ISO 8601 string to time.Time
func ParseTimestamp(s string) (time.Time, error) {
	if s == "" {
		return time.Time{}, nil
	}
	return time.Parse(time.RFC3339, s)
}

// TruncateString truncates string to specified length with ellipsis
func TruncateString(s string, maxLength int) string {
	if len(s) <= maxLength {
		return s
	}

	if maxLength <= 3 {
		return s[:maxLength]
	}

	return s[:maxLength-3] + "..."
}

// Slugify converts string to URL-friendly slug
func Slugify(s string) string {
	// Convert to lowercase
	slug := strings.ToLower(s)

	// Replace spaces and special characters with hyphens
	slug = strings.ReplaceAll(slug, " ", "-")

	// Remove non-alphanumeric characters except hyphens
	var result strings.Builder
	for _, r := range slug {
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') || r == '-' {
			result.WriteRune(r)
		} else {
			result.WriteRune('-')
		}
	}

	// Remove multiple consecutive hyphens
	for strings.Contains(result.String(), "--") {
		result.Reset()
		parts := strings.Split(slug, "--")
		result.WriteString(strings.Join(parts, "-"))
		slug = result.String()
	}

	// Trim hyphens from start and end
	return strings.Trim(slug, "-")
}

// CapitalizeFirst capitalizes the first letter of a string
func CapitalizeFirst(s string) string {
	if s == "" {
		return s
	}

	runes := []rune(s)
	runes[0] = []rune(strings.ToUpper(string(runes[0])))[0]
	return string(runes)
}

// CamelToSnake converts camelCase to snake_case
func CamelToSnake(s string) string {
	var result strings.Builder

	for i, r := range s {
		if i > 0 && r >= 'A' && r <= 'Z' {
			result.WriteRune('_')
		}
		result.WriteRune(r)
	}

	return strings.ToLower(result.String())
}

// SnakeToCamel converts snake_case to camelCase
func SnakeToCamel(s string) string {
	parts := strings.Split(s, "_")
	if len(parts) == 0 {
		return s
	}

	result := strings.ToLower(parts[0])
	for i := 1; i < len(parts); i++ {
		result += CapitalizeFirst(strings.ToLower(parts[i]))
	}

	return result
}
