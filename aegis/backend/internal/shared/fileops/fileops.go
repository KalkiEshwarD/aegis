package fileops

import (
	"crypto/sha256"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"

	apperrors "github.com/balkanid/aegis-backend/internal/errors"
)

// ReadFile reads a file and returns its content as bytes
func ReadFile(filePath string) ([]byte, error) {
	if filePath == "" {
		return nil, apperrors.New(apperrors.ErrCodeValidation, "file path cannot be empty")
	}

	data, err := os.ReadFile(filePath)
	if err != nil {
		return nil, apperrors.Wrap(err, apperrors.ErrCodeInternal,
			fmt.Sprintf("failed to read file: %s", filePath))
	}

	return data, nil
}

// WriteFile writes data to a file
func WriteFile(filePath string, data []byte, perm os.FileMode) error {
	if filePath == "" {
		return apperrors.New(apperrors.ErrCodeValidation, "file path cannot be empty")
	}

	// Create directory if it doesn't exist
	dir := filepath.Dir(filePath)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return apperrors.Wrap(err, apperrors.ErrCodeInternal,
			fmt.Sprintf("failed to create directory: %s", dir))
	}

	if err := os.WriteFile(filePath, data, perm); err != nil {
		return apperrors.Wrap(err, apperrors.ErrCodeInternal,
			fmt.Sprintf("failed to write file: %s", filePath))
	}

	return nil
}

// FileExists checks if a file exists
func FileExists(filePath string) bool {
	_, err := os.Stat(filePath)
	return !os.IsNotExist(err)
}

// GetFileSize returns the size of a file
func GetFileSize(filePath string) (int64, error) {
	info, err := os.Stat(filePath)
	if err != nil {
		return 0, apperrors.Wrap(err, apperrors.ErrCodeInternal,
			fmt.Sprintf("failed to get file info: %s", filePath))
	}
	return info.Size(), nil
}

// CalculateFileHash computes SHA-256 hash of a file
func CalculateFileHash(filePath string) (string, error) {
	file, err := os.Open(filePath)
	if err != nil {
		return "", apperrors.Wrap(err, apperrors.ErrCodeInternal,
			fmt.Sprintf("failed to open file for hashing: %s", filePath))
	}
	defer file.Close()

	hasher := sha256.New()
	if _, err := io.Copy(hasher, file); err != nil {
		return "", apperrors.Wrap(err, apperrors.ErrCodeInternal,
			fmt.Sprintf("failed to hash file: %s", filePath))
	}

	return fmt.Sprintf("%x", hasher.Sum(nil)), nil
}

// CalculateFileHashFromReader computes hash from io.Reader
func CalculateFileHashFromReader(reader io.Reader) (string, error) {
	hasher := sha256.New()
	if _, err := io.Copy(hasher, reader); err != nil {
		return "", apperrors.Wrap(err, apperrors.ErrCodeInternal, "failed to hash data")
	}

	return fmt.Sprintf("%x", hasher.Sum(nil)), nil
}

// GetFileExtension extracts file extension from filename
func GetFileExtension(filename string) string {
	if lastDot := strings.LastIndex(filename, "."); lastDot != -1 && lastDot < len(filename)-1 {
		return filename[lastDot+1:]
	}
	return ""
}

// GetFileNameWithoutExtension returns filename without extension
func GetFileNameWithoutExtension(filename string) string {
	if lastDot := strings.LastIndex(filename, "."); lastDot != -1 {
		return filename[:lastDot]
	}
	return filename
}

// IsImageFile checks if file is an image based on extension
func IsImageFile(filename string) bool {
	ext := strings.ToLower(GetFileExtension(filename))
	imageExts := []string{"jpg", "jpeg", "png", "gif", "bmp", "webp", "svg"}
	for _, imgExt := range imageExts {
		if ext == imgExt {
			return true
		}
	}
	return false
}

// IsVideoFile checks if file is a video based on extension
func IsVideoFile(filename string) bool {
	ext := strings.ToLower(GetFileExtension(filename))
	videoExts := []string{"mp4", "avi", "mov", "wmv", "flv", "webm", "mkv"}
	for _, vidExt := range videoExts {
		if ext == vidExt {
			return true
		}
	}
	return false
}

// IsAudioFile checks if file is an audio based on extension
func IsAudioFile(filename string) bool {
	ext := strings.ToLower(GetFileExtension(filename))
	audioExts := []string{"mp3", "wav", "flac", "aac", "ogg", "wma"}
	for _, audExt := range audioExts {
		if ext == audExt {
			return true
		}
	}
	return false
}

// IsArchiveFile checks if file is an archive based on extension
func IsArchiveFile(filename string) bool {
	ext := strings.ToLower(GetFileExtension(filename))
	archiveExts := []string{"zip", "rar", "7z", "tar", "gz", "bz2"}
	for _, archExt := range archiveExts {
		if ext == archExt {
			return true
		}
	}
	return false
}

// FormatFileSize formats file size in human readable format
func FormatFileSize(bytes int64) string {
	const unit = 1024
	if bytes < unit {
		return fmt.Sprintf("%d B", bytes)
	}
	div, exp := int64(unit), 0
	for n := bytes / unit; n >= unit; n /= unit {
		div *= unit
		exp++
	}
	return fmt.Sprintf("%.1f %cB", float64(bytes)/float64(div), "KMGTPE"[exp])
}

// SanitizeFilename removes potentially dangerous characters from filenames
func SanitizeFilename(filename string) string {
	if filename == "" {
		return ""
	}

	// Remove dangerous characters
	dangerousChars := []string{"<", ">", ":", "\"", "|", "?", "*", "\x00"}
	result := filename
	for _, char := range dangerousChars {
		result = strings.ReplaceAll(result, char, "")
	}

	// Remove leading/trailing dots and spaces
	result = strings.Trim(result, ". ")

	// Replace multiple spaces with single space
	for strings.Contains(result, "  ") {
		result = strings.ReplaceAll(result, "  ", " ")
	}

	// Limit length
	if len(result) > 255 {
		result = result[:255]
	}

	return result
}

// EnsureDirectory creates directory if it doesn't exist
func EnsureDirectory(dirPath string) error {
	if dirPath == "" {
		return apperrors.New(apperrors.ErrCodeValidation, "directory path cannot be empty")
	}

	if err := os.MkdirAll(dirPath, 0755); err != nil {
		return apperrors.Wrap(err, apperrors.ErrCodeInternal,
			fmt.Sprintf("failed to create directory: %s", dirPath))
	}

	return nil
}

// MoveFile moves a file from source to destination
func MoveFile(srcPath, dstPath string) error {
	if srcPath == "" || dstPath == "" {
		return apperrors.New(apperrors.ErrCodeValidation, "source and destination paths cannot be empty")
	}

	// Ensure destination directory exists
	dstDir := filepath.Dir(dstPath)
	if err := EnsureDirectory(dstDir); err != nil {
		return err
	}

	if err := os.Rename(srcPath, dstPath); err != nil {
		return apperrors.Wrap(err, apperrors.ErrCodeInternal,
			fmt.Sprintf("failed to move file from %s to %s", srcPath, dstPath))
	}

	return nil
}

// CopyFile copies a file from source to destination
func CopyFile(srcPath, dstPath string) error {
	if srcPath == "" || dstPath == "" {
		return apperrors.New(apperrors.ErrCodeValidation, "source and destination paths cannot be empty")
	}

	// Ensure destination directory exists
	dstDir := filepath.Dir(dstPath)
	if err := EnsureDirectory(dstDir); err != nil {
		return err
	}

	srcFile, err := os.Open(srcPath)
	if err != nil {
		return apperrors.Wrap(err, apperrors.ErrCodeInternal,
			fmt.Sprintf("failed to open source file: %s", srcPath))
	}
	defer srcFile.Close()

	dstFile, err := os.Create(dstPath)
	if err != nil {
		return apperrors.Wrap(err, apperrors.ErrCodeInternal,
			fmt.Sprintf("failed to create destination file: %s", dstPath))
	}
	defer dstFile.Close()

	if _, err := io.Copy(dstFile, srcFile); err != nil {
		return apperrors.Wrap(err, apperrors.ErrCodeInternal,
			fmt.Sprintf("failed to copy file from %s to %s", srcPath, dstPath))
	}

	return nil
}
