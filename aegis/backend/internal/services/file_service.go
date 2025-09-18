package services

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"strings"

	"github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/credentials"
	"gorm.io/gorm"

	"github.com/balkanid/aegis-backend/internal/config"
	"github.com/balkanid/aegis-backend/internal/database"
	"github.com/balkanid/aegis-backend/internal/models"
)

type FileService struct {
	minioClient *minio.Client
	bucketName  string
	cfg         *config.Config
}

func NewFileService(cfg *config.Config) *FileService {
	var minioClient *minio.Client
	var bucketName string

	log.Printf("DEBUG: MinIO config - Endpoint: %s, AccessKey: %s, SecretKey: %s, Bucket: %s",
		cfg.MinIOEndpoint, cfg.MinIOAccessKey, cfg.MinIOSecretKey, cfg.MinIOBucket)

	// Only initialize MinIO if configuration is provided
	if cfg.MinIOEndpoint != "" && cfg.MinIOAccessKey != "" && cfg.MinIOSecretKey != "" && cfg.MinIOBucket != "" {
		log.Printf("DEBUG: All MinIO config values present, initializing client...")
		var err error
		minioClient, err = minio.New(cfg.MinIOEndpoint, &minio.Options{
			Creds:  credentials.NewStaticV4(cfg.MinIOAccessKey, cfg.MinIOSecretKey, ""),
			Secure: false, // Set to true for HTTPS
		})
		if err != nil {
			log.Fatalf("Failed to initialize MinIO client: %v", err)
		}
		log.Printf("DEBUG: MinIO client created successfully")
		bucketName = cfg.MinIOBucket
	} else {
		log.Printf("DEBUG: MinIO config incomplete, using mock storage")
	}

	fs := &FileService{
		minioClient: minioClient,
		bucketName:  bucketName,
		cfg:         cfg,
	}

	// Ensure bucket exists (only if MinIO is configured)
	if minioClient != nil {
		log.Printf("DEBUG: MinIO client exists, ensuring bucket exists...")
		fs.ensureBucketExists()
	} else {
		log.Printf("DEBUG: MinIO client is nil, skipping bucket creation")
	}

	return fs
}

// UploadFileFromMap converts map[string]interface{} to UploadFileInput and uploads
// This solves the "map[string]interface {} is not an Upload" error using JSON unmarshaling
func (fs *FileService) UploadFileFromMap(userID uint, data map[string]interface{}) (*models.UserFile, error) {
	// Define a temporary struct that matches the expected JSON structure
	// Note: JSON numbers are float64, so we need to handle that
	type UploadData struct {
		Filename     string  `json:"filename"`
		MimeType     string  `json:"mime_type"`
		SizeBytes    float64 `json:"size_bytes"` // Use float64 for JSON compatibility
		ContentHash  string  `json:"content_hash"`
		EncryptedKey string  `json:"encrypted_key"`
		FileData     string  `json:"file_data,omitempty"` // Base64 encoded file data as string
	}

	// Convert map to JSON bytes
	jsonData, err := json.Marshal(data)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal upload data: %w", err)
	}

	// Unmarshal into our temporary struct
	var uploadData UploadData
	err = json.Unmarshal(jsonData, &uploadData)
	if err != nil {
		return nil, fmt.Errorf("failed to unmarshal upload data: %w", err)
	}

	// Convert base64 file data to bytes
	var fileReader io.Reader
	if uploadData.FileData != "" {
		// Decode base64 to get the actual file bytes
		decodedData, err := base64.StdEncoding.DecodeString(uploadData.FileData)
		if err != nil {
			return nil, fmt.Errorf("failed to decode base64 file data: %w", err)
		}
		fileReader = bytes.NewReader(decodedData)
	} else {
		return nil, fmt.Errorf("file data is required for upload")
	}

	// Convert float64 size to int64
	sizeBytes := int64(uploadData.SizeBytes)

	// Now call the existing UploadFile method with the converted data
	userFile, err := fs.UploadFile(
		userID,
		uploadData.Filename,
		uploadData.MimeType,
		uploadData.ContentHash,
		uploadData.EncryptedKey,
		fileReader,
		sizeBytes,
	)
	return userFile, err
}

// ensureBucketExists creates the bucket if it doesn't exist
func (fs *FileService) ensureBucketExists() {
	ctx := context.Background()

	log.Printf("DEBUG: Checking if bucket '%s' exists...", fs.bucketName)
	exists, err := fs.minioClient.BucketExists(ctx, fs.bucketName)
	if err != nil {
		log.Fatalf("Failed to check bucket existence: %v", err)
	}

	if !exists {
		log.Printf("DEBUG: Bucket '%s' does not exist, creating...", fs.bucketName)
		err = fs.minioClient.MakeBucket(ctx, fs.bucketName, minio.MakeBucketOptions{})
		if err != nil {
			log.Fatalf("Failed to create bucket: %v", err)
		}
		log.Printf("Created bucket: %s", fs.bucketName)
	} else {
		log.Printf("DEBUG: Bucket '%s' already exists", fs.bucketName)
	}
}

// UploadFile handles file upload with user-specific deduplication
func (fs *FileService) UploadFile(userID uint, filename, mimeType, contentHash, encryptionKey string, fileData io.Reader, sizeBytes int64) (*models.UserFile, error) {
	db := database.GetDB()

	log.Printf("DEBUG: UploadFile called - userID: %d, filename: %s, contentHash: %s", userID, filename, contentHash)

	// First, let's check what files exist for this user
	var userFiles []models.UserFile
	err := db.Where("user_id = ?", userID).Preload("File").Find(&userFiles).Error
	if err != nil {
		log.Printf("DEBUG: Error fetching user files: %v", err)
	} else {
		log.Printf("DEBUG: User %d has %d files:", userID, len(userFiles))
		for i, uf := range userFiles {
			log.Printf("DEBUG: File %d: ID=%d, filename=%s, contentHash=%s", i+1, uf.ID, uf.Filename, uf.File.ContentHash)
		}
	}

	// Check if this user already has a file with the same content hash and filename
	// This prevents user-level duplicates while allowing different users to have the same file
	var existingUserFile models.UserFile
	err = db.Joins("JOIN files ON user_files.file_id = files.id").
		Where("user_files.user_id = ? AND files.content_hash = ? AND user_files.filename = ?",
			userID, contentHash, filename).
		Preload("User").Preload("File").
		First(&existingUserFile).Error

	if err == nil {
		// User already has this exact file - return the existing record
		log.Printf("DEBUG: Found existing user file - returning existing record with ID: %d", existingUserFile.ID)
		return &existingUserFile, nil
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		// Database error
		log.Printf("DEBUG: Database error checking for existing user file: %v", err)
		return nil, fmt.Errorf("database error checking for existing user file: %w", err)
	}

	log.Printf("DEBUG: No existing user file found for contentHash=%s, filename=%s", contentHash, filename)

	log.Printf("DEBUG: No existing user file found, checking for file with same content_hash")

	// User doesn't have this file yet - check if we can reuse an existing file record
	var existingFile models.File
	err = db.Where("content_hash = ?", contentHash).First(&existingFile).Error

	var file *models.File
	var storagePath string

	if err == nil {
		// File with same content hash exists - reuse it (storage deduplication)
		log.Printf("DEBUG: Found existing file with ID: %d, reusing it", existingFile.ID)
		file = &existingFile
		storagePath = existingFile.StoragePath
	} else if errors.Is(err, gorm.ErrRecordNotFound) {
		// No existing file with this content hash - create new file record and upload to storage
		log.Printf("DEBUG: No existing file found, creating new file record and uploading to storage")
		if fs.minioClient != nil {
			storagePath = fmt.Sprintf("%d/%s", userID, contentHash)
			_, err := fs.minioClient.PutObject(context.Background(), fs.bucketName, storagePath, fileData, sizeBytes, minio.PutObjectOptions{
				ContentType: mimeType,
			})
			if err != nil {
				return nil, fmt.Errorf("failed to upload file to storage: %w", err)
			}
		} else {
			// For tests without MinIO, use a mock storage path
			storagePath = fmt.Sprintf("mock/%d/%s", userID, contentHash)
		}

		// Create new file record
		file = &models.File{
			ContentHash: contentHash,
			SizeBytes:   sizeBytes,
			StoragePath: storagePath,
		}

		if err := db.Create(file).Error; err != nil {
			// Clean up uploaded file if database fails (only if MinIO is configured)
			if fs.minioClient != nil {
				fs.minioClient.RemoveObject(context.Background(), fs.bucketName, storagePath, minio.RemoveObjectOptions{})
			}
			return nil, fmt.Errorf("failed to create file record: %w", err)
		}
		log.Printf("DEBUG: Created new file record with ID: %d", file.ID)
	} else {
		// Database error
		log.Printf("DEBUG: Database error checking for existing file: %v", err)
		return nil, fmt.Errorf("database error checking for existing file: %w", err)
	}

	// Create user_file record linking user to the file (existing or new)
	userFile := &models.UserFile{
		UserID:        userID,
		FileID:        file.ID,
		Filename:      filename,
		MimeType:      mimeType,
		EncryptionKey: encryptionKey,
	}

	log.Printf("DEBUG: Creating user_file record - UserID: %d, FileID: %d, Filename: %s", userFile.UserID, userFile.FileID, userFile.Filename)

	if err := db.Create(userFile).Error; err != nil {
		return nil, fmt.Errorf("failed to create user file record: %w", err)
	}

	// Load associations
	db.Preload("User").Preload("File").First(userFile, userFile.ID)

	return userFile, nil
}

// GetUserFiles returns files owned by a user with optional filtering
func (fs *FileService) GetUserFiles(userID uint, filter *FileFilter) ([]*models.UserFile, error) {
	db := database.GetDB()

	// Use Unscoped if we want to include trashed files
	query := db.Where("user_id = ?", userID).Preload("File")
	includeTrashed := false

	if filter != nil {
		if filter.IncludeTrashed != nil && *filter.IncludeTrashed {
			includeTrashed = true
			query = db.Unscoped().Where("user_id = ?", userID).Preload("File")
		}

		if filter.Filename != nil {
			// Use LIKE for SQLite compatibility (ILIKE is PostgreSQL-specific)
			query = query.Where("filename LIKE ?", "%"+*filter.Filename+"%")
		}
		if filter.MimeType != nil {
			query = query.Where("mime_type = ?", *filter.MimeType)
		}
		if filter.MinSize != nil || filter.MaxSize != nil {
			query = query.Joins("JOIN files ON user_files.file_id = files.id")
			if filter.MinSize != nil {
				query = query.Where("files.size_bytes >= ?", *filter.MinSize)
			}
			if filter.MaxSize != nil {
				query = query.Where("files.size_bytes <= ?", *filter.MaxSize)
			}
		}
		if filter.DateFrom != nil {
			query = query.Where("user_files.created_at >= ?", *filter.DateFrom)
		}
		if filter.DateTo != nil {
			query = query.Where("user_files.created_at <= ?", *filter.DateTo)
		}
	}

	// If not including trashed files, exclude soft-deleted files
	if !includeTrashed {
		query = query.Where("user_files.deleted_at IS NULL")
	}

	var userFiles []*models.UserFile
	err := query.Find(&userFiles).Error
	return userFiles, err
}

// DeleteFile soft deletes a user's file (moves to trash)
func (fs *FileService) DeleteFile(userID, userFileID uint) error {
	log.Printf("DEBUG: DeleteFile called with userID=%d, userFileID=%d", userID, userFileID)
	db := database.GetDB()

	// Get the user file
	var userFile models.UserFile
	if err := db.Preload("File").Where("id = ? AND user_id = ?", userFileID, userID).First(&userFile).Error; err != nil {
		log.Printf("DEBUG: Failed to find user file: %v", err)
		return fmt.Errorf("file not found: %w", err)
	}
	log.Printf("DEBUG: Found user file ID=%d, file ID=%d", userFile.ID, userFile.FileID)

	// Remove file from all rooms first (to avoid foreign key constraint issues)
	if err := db.Where("user_file_id = ?", userFileID).Delete(&models.RoomFile{}).Error; err != nil {
		log.Printf("DEBUG: Failed to remove file from rooms: %v", err)
		return fmt.Errorf("failed to remove file from rooms: %w", err)
	}
	log.Printf("DEBUG: Removed file from rooms")

	// Soft delete the user_file record (sets deleted_at timestamp)
	if err := db.Delete(&userFile).Error; err != nil {
		log.Printf("DEBUG: Failed to soft delete user file record: %v", err)
		return fmt.Errorf("failed to soft delete user file record: %w", err)
	}
	log.Printf("DEBUG: Soft deleted user file record")

	return nil
}

// RestoreFile restores a soft-deleted file
func (fs *FileService) RestoreFile(userID, userFileID uint) error {
	log.Printf("DEBUG: RestoreFile called with userID=%d, userFileID=%d", userID, userFileID)
	db := database.GetDB()

	// Find the soft-deleted user file using Unscoped to include deleted records
	var userFile models.UserFile
	if err := db.Unscoped().Preload("File").Where("id = ? AND user_id = ?", userFileID, userID).First(&userFile).Error; err != nil {
		log.Printf("DEBUG: Failed to find user file (including soft-deleted): %v", err)
		return fmt.Errorf("file not found: %w", err)
	}

	// Check if the file is actually soft-deleted
	if userFile.DeletedAt.Valid == false {
		log.Printf("DEBUG: File is not soft-deleted")
		return fmt.Errorf("file is not in trash")
	}

	log.Printf("DEBUG: Found soft-deleted user file ID=%d, file ID=%d", userFile.ID, userFile.FileID)

	// Restore the file by setting deleted_at to NULL using raw SQL
	if err := db.Exec("UPDATE user_files SET deleted_at = NULL WHERE id = ? AND user_id = ?", userFileID, userID).Error; err != nil {
		log.Printf("DEBUG: Failed to restore user file record: %v", err)
		return fmt.Errorf("failed to restore user file record: %w", err)
	}
	log.Printf("DEBUG: Restored user file record")

	return nil
}

// PermanentlyDeleteFile permanently deletes a soft-deleted file from storage and database
func (fs *FileService) PermanentlyDeleteFile(userID, userFileID uint) error {
	log.Printf("DEBUG: PermanentlyDeleteFile called with userID=%d, userFileID=%d", userID, userFileID)
	db := database.GetDB()

	// Find the soft-deleted user file using Unscoped to include deleted records
	var userFile models.UserFile
	if err := db.Unscoped().Preload("File").Where("id = ? AND user_id = ?", userFileID, userID).First(&userFile).Error; err != nil {
		log.Printf("DEBUG: Failed to find user file (including soft-deleted): %v", err)
		return fmt.Errorf("file not found: %w", err)
	}

	// Check if the file is actually soft-deleted
	if userFile.DeletedAt.Valid == false {
		log.Printf("DEBUG: File is not soft-deleted")
		return fmt.Errorf("file is not in trash - use DeleteFile first")
	}

	log.Printf("DEBUG: Found soft-deleted user file ID=%d, file ID=%d", userFile.ID, userFile.FileID)

	// Delete from MinIO storage (only if configured)
	if fs.minioClient != nil {
		err := fs.minioClient.RemoveObject(
			context.Background(),
			fs.bucketName,
			userFile.File.StoragePath,
			minio.RemoveObjectOptions{},
		)
		if err != nil {
			log.Printf("Warning: Failed to delete file from storage: %v", err)
			// Continue with database deletion even if storage deletion fails
		}
	}

	// Hard delete the user_file record using Unscoped
	if err := db.Unscoped().Delete(&userFile).Error; err != nil {
		log.Printf("DEBUG: Failed to permanently delete user file record: %v", err)
		return fmt.Errorf("failed to permanently delete user file record: %w", err)
	}
	log.Printf("DEBUG: Permanently deleted user file record")

	// Check if any other user_files (including soft-deleted) reference this file
	var count int64
	if err := db.Unscoped().Model(&models.UserFile{}).Where("file_id = ?", userFile.FileID).Count(&count).Error; err != nil {
		log.Printf("Warning: Failed to check for other file references: %v", err)
		return nil // Don't fail the operation if we can't check
	}

	// If no other references, permanently delete the file record
	if count == 0 {
		if err := db.Unscoped().Delete(&models.File{}, userFile.FileID).Error; err != nil {
			log.Printf("Warning: Failed to permanently delete file record: %v", err)
		} else {
			log.Printf("DEBUG: Permanently deleted file record (no more references)")
		}
	} else {
		log.Printf("DEBUG: File record still has %d references, keeping it", count)
	}

	return nil
}

// GetTrashedFiles returns soft-deleted files for a user
func (fs *FileService) GetTrashedFiles(userID uint) ([]*models.UserFile, error) {
	db := database.GetDB()

	var userFiles []*models.UserFile
	err := db.Unscoped().
		Where("user_id = ? AND deleted_at IS NOT NULL", userID).
		Preload("File").
		Find(&userFiles).Error

	return userFiles, err
}

// GetFileDownloadURL generates a presigned URL for file download
func (fs *FileService) GetFileDownloadURL(userID, userFileID uint) (string, error) {
	db := database.GetDB()

	// Verify user owns the file
	var userFile models.UserFile
	if err := db.Preload("File").Where("id = ? AND user_id = ?", userFileID, userID).First(&userFile).Error; err != nil {
		return "", fmt.Errorf("file not found: %w", err)
	}

	// Generate download URL - use backend proxy instead of presigned URL
	downloadURL := fmt.Sprintf("http://localhost:8080/api/files/%d/download", userFileID)

	// Log download event
	downloadLog := &models.DownloadLog{
		UserFileID:       userFileID,
		DownloaderUserID: userID,
	}
	database.GetDB().Create(downloadLog)

	return downloadURL, nil
}

// GetFile returns the file content as bytes
func (fs *FileService) GetFile(userID, userFileID uint) ([]byte, string, error) {
	db := database.GetDB()

	// Verify user owns the file
	var userFile models.UserFile
	if err := db.Preload("File").Where("id = ? AND user_id = ?", userFileID, userID).First(&userFile).Error; err != nil {
		return nil, "", fmt.Errorf("file not found: %w", err)
	}

	// Get file content
	var fileContent []byte
	if fs.minioClient != nil {
		// Get file from MinIO
		object, err := fs.minioClient.GetObject(
			context.Background(),
			fs.bucketName,
			userFile.File.StoragePath,
			minio.GetObjectOptions{},
		)
		if err != nil {
			return nil, "", fmt.Errorf("failed to get file from storage: %w", err)
		}
		defer object.Close()

		// Read file content
		var buffer bytes.Buffer
		_, err = io.Copy(&buffer, object)
		if err != nil {
			return nil, "", fmt.Errorf("failed to read file content: %w", err)
		}
		fileContent = buffer.Bytes()
	} else {
		// For tests without MinIO, return mock content
		fileContent = []byte(fmt.Sprintf("Mock file content for %s", userFile.Filename))
	}

	// Log download event
	downloadLog := &models.DownloadLog{
		UserFileID:       userFileID,
		DownloaderUserID: userID,
	}
	database.GetDB().Create(downloadLog)

	return fileContent, userFile.MimeType, nil
}

// StreamFile returns a reader for the file content (for direct streaming)
func (fs *FileService) StreamFile(userID, userFileID uint) (io.ReadCloser, string, error) {
	db := database.GetDB()

	// Verify user owns the file
	var userFile models.UserFile
	if err := db.Preload("File").Where("id = ? AND user_id = ?", userFileID, userID).First(&userFile).Error; err != nil {
		return nil, "", fmt.Errorf("file not found: %w", err)
	}

	// Get file from MinIO
	if fs.minioClient != nil {
		object, err := fs.minioClient.GetObject(
			context.Background(),
			fs.bucketName,
			userFile.File.StoragePath,
			minio.GetObjectOptions{},
		)
		if err != nil {
			return nil, "", fmt.Errorf("failed to get file from storage: %w", err)
		}
		return object, userFile.MimeType, nil
	} else {
		// For tests without MinIO, return mock content
		return io.NopCloser(strings.NewReader(fmt.Sprintf("Mock file content for %s", userFile.Filename))), userFile.MimeType, nil
	}
}

// GetAllFiles returns all files in the system (admin only)
func (fs *FileService) GetAllFiles() ([]*models.UserFile, error) {
	var userFiles []*models.UserFile
	err := database.GetDB().Preload("User").Preload("File").Find(&userFiles).Error
	return userFiles, err
}

// FileFilter represents filters for file queries
type FileFilter struct {
	Filename      *string
	MimeType      *string
	MinSize       *int64
	MaxSize       *int64
	DateFrom      *interface{} // Time
	DateTo        *interface{} // Time
	IncludeTrashed *bool
}
