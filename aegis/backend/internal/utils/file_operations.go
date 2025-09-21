package utils

import (
	"crypto/md5"
	"crypto/sha256"
	"fmt"
	"io"
	"mime"
	"path/filepath"
	"strings"
	"time"
)

// FileOperationResult represents the result of a file operation
type FileOperationResult struct {
	Success bool        `json:"success"`
	Message string      `json:"message"`
	Data    interface{} `json:"data,omitempty"`
}

// FileMetadata represents file metadata
type FileMetadata struct {
	Filename   string    `json:"filename"`
	Size       int64     `json:"size"`
	MimeType   string    `json:"mime_type"`
	Extension  string    `json:"extension"`
	Hash       string    `json:"hash"`
	CreatedAt  time.Time `json:"created_at"`
	ModifiedAt time.Time `json:"modified_at"`
}

// CalculateFileHash calculates SHA-256 hash of file content
func CalculateFileHash(reader io.Reader) (string, error) {
	hash := sha256.New()
	if _, err := io.Copy(hash, reader); err != nil {
		return "", fmt.Errorf("failed to calculate hash: %w", err)
	}
	return fmt.Sprintf("%x", hash.Sum(nil)), nil
}

// CalculateMD5Hash calculates MD5 hash of file content
func CalculateMD5Hash(reader io.Reader) (string, error) {
	hash := md5.New()
	if _, err := io.Copy(hash, reader); err != nil {
		return "", fmt.Errorf("failed to calculate MD5 hash: %w", err)
	}
	return fmt.Sprintf("%x", hash.Sum(nil)), nil
}

// DetectMimeType detects MIME type from filename and content
func DetectMimeType(filename string, reader io.Reader) (string, error) {
	// First try to detect from filename
	mimeType := mime.TypeByExtension(filepath.Ext(filename))

	// If not detected or generic, try to detect from content
	if mimeType == "" || mimeType == "application/octet-stream" {
		// Read first 512 bytes for content detection
		buffer := make([]byte, 512)
		n, err := reader.Read(buffer)
		if err != nil && err != io.EOF {
			return "", fmt.Errorf("failed to read file content: %w", err)
		}

		if n > 0 {
			mimeType = mime.TypeByExtension(filepath.Ext(filename))
			if mimeType == "" || mimeType == "application/octet-stream" {
				mimeType = "application/octet-stream"
			}
		}
	}

	return mimeType, nil
}

// GetFileExtension extracts file extension from filename
func GetFileExtension(filename string) string {
	return strings.ToLower(filepath.Ext(filename))
}

// IsValidFileExtension checks if file extension is allowed
func IsValidFileExtension(filename string, allowedExtensions []string) bool {
	ext := GetFileExtension(filename)
	if ext == "" {
		return false
	}

	// Remove the dot from extension for comparison
	ext = ext[1:]

	for _, allowed := range allowedExtensions {
		if strings.EqualFold(ext, strings.TrimPrefix(allowed, ".")) {
			return true
		}
	}
	return false
}

// IsValidMimeType checks if MIME type is allowed
func IsValidMimeType(mimeType string, allowedTypes []string) bool {
	for _, allowed := range allowedTypes {
		if strings.HasPrefix(mimeType, allowed) {
			return true
		}
	}
	return false
}

// GenerateUniqueFilename generates a unique filename
func GenerateUniqueFilename(originalFilename string) string {
	ext := filepath.Ext(originalFilename)
	name := strings.TrimSuffix(originalFilename, ext)
	timestamp := time.Now().UnixNano()
	return fmt.Sprintf("%s_%d%s", name, timestamp, ext)
}

// ValidateFileSize checks if file size is within limits
func ValidateFileSize(size int64, minSize, maxSize int64) error {
	if size < minSize {
		return fmt.Errorf("file size %d bytes is below minimum size %d bytes", size, minSize)
	}
	if size > maxSize {
		return fmt.Errorf("file size %d bytes exceeds maximum size %d bytes", size, maxSize)
	}
	return nil
}

// GetFileCategory determines file category based on MIME type
func GetFileCategory(mimeType string) string {
	if strings.HasPrefix(mimeType, "image/") {
		return "image"
	}
	if strings.HasPrefix(mimeType, "video/") {
		return "video"
	}
	if strings.HasPrefix(mimeType, "audio/") {
		return "audio"
	}
	if strings.HasPrefix(mimeType, "text/") {
		return "document"
	}
	if strings.Contains(mimeType, "pdf") {
		return "document"
	}
	if strings.Contains(mimeType, "zip") || strings.Contains(mimeType, "rar") || strings.Contains(mimeType, "7z") {
		return "archive"
	}
	if strings.Contains(mimeType, "json") || strings.Contains(mimeType, "xml") {
		return "data"
	}
	return "other"
}

// IsTextFile checks if file is a text file
func IsTextFile(mimeType string) bool {
	return strings.HasPrefix(mimeType, "text/") ||
		mimeType == "application/json" ||
		mimeType == "application/xml" ||
		mimeType == "application/javascript"
}

// IsImageFile checks if file is an image
func IsImageFile(mimeType string) bool {
	return strings.HasPrefix(mimeType, "image/")
}

// IsVideoFile checks if file is a video
func IsVideoFile(mimeType string) bool {
	return strings.HasPrefix(mimeType, "video/")
}

// IsAudioFile checks if file is an audio file
func IsAudioFile(mimeType string) bool {
	return strings.HasPrefix(mimeType, "audio/")
}

// IsArchiveFile checks if file is an archive
func IsArchiveFile(mimeType string) bool {
	return strings.Contains(mimeType, "zip") ||
		strings.Contains(mimeType, "rar") ||
		strings.Contains(mimeType, "7z") ||
		strings.Contains(mimeType, "tar") ||
		strings.Contains(mimeType, "gzip")
}

// GetFileIconType returns icon type based on file category
func GetFileIconType(mimeType, filename string) string {
	category := GetFileCategory(mimeType)

	switch category {
	case "image":
		return "image"
	case "video":
		return "video"
	case "audio":
		return "audio"
	case "document":
		if strings.Contains(mimeType, "pdf") {
			return "pdf"
		}
		return "document"
	case "archive":
		return "archive"
	case "data":
		return "data"
	default:
		// Check by extension for code files
		ext := GetFileExtension(filename)
		if ext != "" {
			codeExtensions := []string{".js", ".ts", ".jsx", ".tsx", ".html", ".css", ".scss", ".json", ".xml", ".py", ".java", ".cpp", ".c", ".php", ".rb", ".go", ".rs"}
			for _, codeExt := range codeExtensions {
				if ext == codeExt {
					return "code"
				}
			}
		}
		return "file"
	}
}

// FormatFileSizeBytes formats file size in bytes to human readable format
func FormatFileSizeBytes(size int64) string {
	return FormatFileSize(size)
}

// GetFileInfo extracts file information
func GetFileInfo(filename string, size int64, mimeType string) FileMetadata {
	return FileMetadata{
		Filename:   filename,
		Size:       size,
		MimeType:   mimeType,
		Extension:  GetFileExtension(filename),
		CreatedAt:  time.Now(),
		ModifiedAt: time.Now(),
	}
}

// ValidateFilename validates filename format and safety
func ValidateFilename(filename string) error {
	if filename == "" {
		return fmt.Errorf("filename cannot be empty")
	}

	if len(filename) > 255 {
		return fmt.Errorf("filename too long (max 255 characters)")
	}

	// Check for dangerous characters
	dangerousChars := []string{"<", ">", ":", "\"", "|", "?", "*", "\x00"}
	for _, char := range dangerousChars {
		if strings.Contains(filename, char) {
			return fmt.Errorf("filename contains dangerous character: %s", char)
		}
	}

	// Check for reserved names (Windows)
	reservedNames := []string{"CON", "PRN", "AUX", "NUL", "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7", "COM8", "COM9", "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9"}
	name := strings.ToUpper(strings.Split(filename, ".")[0])
	for _, reserved := range reservedNames {
		if name == reserved {
			return fmt.Errorf("filename uses reserved name: %s", reserved)
		}
	}

	return nil
}

// SanitizePath sanitizes file path for security
func SanitizePath(path string) string {
	// Remove dangerous path traversal
	path = strings.ReplaceAll(path, "..", "")
	path = strings.ReplaceAll(path, "\\", "/")

	// Remove leading/trailing slashes
	path = strings.Trim(path, "/")

	return path
}

// GetRelativePath gets relative path between two paths
func GetRelativePath(basePath, targetPath string) (string, error) {
	return filepath.Rel(basePath, targetPath)
}

// IsPathSafe checks if path is safe (no traversal)
func IsPathSafe(path string) bool {
	// Check for path traversal attempts
	if strings.Contains(path, "..") {
		return false
	}

	// Check for absolute paths
	if strings.HasPrefix(path, "/") || strings.HasPrefix(path, "\\") {
		return false
	}

	// Check for Windows drive letters
	if len(path) >= 3 && path[1] == ':' && (path[2] == '\\' || path[2] == '/') {
		return false
	}

	return true
}
