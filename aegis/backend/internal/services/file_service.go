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

	// Only initialize MinIO if configuration is provided
	if cfg.MinIOEndpoint != "" && cfg.MinIOAccessKey != "" && cfg.MinIOSecretKey != "" && cfg.MinIOBucket != "" {
		var err error
		minioClient, err = minio.New(cfg.MinIOEndpoint, &minio.Options{
			Creds:  credentials.NewStaticV4(cfg.MinIOAccessKey, cfg.MinIOSecretKey, ""),
			Secure: false, // Set to true for HTTPS
		})
		if err != nil {
			log.Fatalf("Failed to initialize MinIO client: %v", err)
		}
		bucketName = cfg.MinIOBucket
	}

	fs := &FileService{
		minioClient: minioClient,
		bucketName:  bucketName,
		cfg:         cfg,
	}

	// Ensure bucket exists (only if MinIO is configured)
	if minioClient != nil {
		fs.ensureBucketExists()
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
	return fs.UploadFile(
		userID,
		uploadData.Filename,
		uploadData.MimeType,
		uploadData.ContentHash,
		uploadData.EncryptedKey,
		fileReader,
		sizeBytes,
	)
}

// ensureBucketExists creates the bucket if it doesn't exist
func (fs *FileService) ensureBucketExists() {
	ctx := context.Background()

	exists, err := fs.minioClient.BucketExists(ctx, fs.bucketName)
	if err != nil {
		log.Fatalf("Failed to check bucket existence: %v", err)
	}

	if !exists {
		err = fs.minioClient.MakeBucket(ctx, fs.bucketName, minio.MakeBucketOptions{})
		if err != nil {
			log.Fatalf("Failed to create bucket: %v", err)
		}
		log.Printf("Created bucket: %s", fs.bucketName)
	}
}

// UploadFile handles file upload with deduplication
func (fs *FileService) UploadFile(userID uint, filename, mimeType, contentHash, encryptionKey string, fileData io.Reader, sizeBytes int64) (*models.UserFile, error) {
	db := database.GetDB()

	// Check if file with this hash already exists (including soft-deleted)
	var existingFile models.File
	err := db.Unscoped().Where("content_hash = ?", contentHash).First(&existingFile).Error

	var file *models.File
	if errors.Is(err, gorm.ErrRecordNotFound) {
		// File doesn't exist at all
		var storagePath string

		// Only upload to MinIO if it's configured
		if fs.minioClient != nil {
			storagePath = fmt.Sprintf("%d/%s", userID, contentHash)

			_, err = fs.minioClient.PutObject(
				context.Background(),
				fs.bucketName,
				storagePath,
				fileData,
				sizeBytes,
				minio.PutObjectOptions{
					ContentType: mimeType,
				},
			)
			if err != nil {
				return nil, fmt.Errorf("failed to upload file to storage: %w", err)
			}
		} else {
			// For tests without MinIO, use a mock storage path
			storagePath = fmt.Sprintf("mock/%d/%s", userID, contentHash)
		}

		// Create file record
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
	} else if err != nil {
		return nil, fmt.Errorf("database error: %w", err)
	} else {
		// File exists (either active or soft-deleted)
		if existingFile.DeletedAt.Valid {
			// File is soft-deleted, restore it
			existingFile.DeletedAt = gorm.DeletedAt{}
			if err := db.Unscoped().Save(&existingFile).Error; err != nil {
				return nil, fmt.Errorf("failed to restore soft-deleted file: %w", err)
			}
		}
		// Use the existing/restored file record
		file = &existingFile
	}

	// Check if user already has this file (user-level duplicate prevention)
	var existingUserFile models.UserFile
	err = db.Where("user_id = ? AND file_id = ?", userID, file.ID).First(&existingUserFile).Error

	if err == nil {
		// User already has this file - return the existing record
		// Load associations
		db.Preload("User").Preload("File").First(&existingUserFile, existingUserFile.ID)
		return &existingUserFile, nil
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		// Database error
		return nil, fmt.Errorf("database error checking for existing user file: %w", err)
	}

	// User doesn't have this file yet - create new user_file record
	userFile := &models.UserFile{
		UserID:        userID,
		FileID:        file.ID,
		Filename:      filename,
		MimeType:      mimeType,
		EncryptionKey: encryptionKey,
	}

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
	query := db.Where("user_id = ?", userID).Preload("File")

	if filter != nil {
		if filter.Filename != nil {
			// Use LIKE for SQLite compatibility (ILIKE is PostgreSQL-specific)
			query = query.Where("filename LIKE ?", "%"+*filter.Filename+"%")
		}
		if filter.MimeType != nil {
			query = query.Where("mime_type = ?", *filter.MimeType)
		}
		if filter.MinSize != nil {
			query = query.Joins("JOIN files ON user_files.file_id = files.id").
				Where("files.size_bytes >= ?", *filter.MinSize)
		}
		if filter.MaxSize != nil {
			query = query.Joins("JOIN files ON user_files.file_id = files.id").
				Where("files.size_bytes <= ?", *filter.MaxSize)
		}
		if filter.DateFrom != nil {
			query = query.Where("user_files.created_at >= ?", *filter.DateFrom)
		}
		if filter.DateTo != nil {
			query = query.Where("user_files.created_at <= ?", *filter.DateTo)
		}
	}

	var userFiles []*models.UserFile
	err := query.Find(&userFiles).Error
	return userFiles, err
}

// DeleteFile deletes a user's file (handles deduplication)
func (fs *FileService) DeleteFile(userID, userFileID uint) error {
	db := database.GetDB()

	// Get the user file
	var userFile models.UserFile
	if err := db.Preload("File").Where("id = ? AND user_id = ?", userFileID, userID).First(&userFile).Error; err != nil {
		return fmt.Errorf("file not found: %w", err)
	}

	// Delete the user_file record
	if err := db.Delete(&userFile).Error; err != nil {
		return fmt.Errorf("failed to delete user file record: %w", err)
	}

	// Check if other users still reference this file
	var count int64
	db.Model(&models.UserFile{}).Where("file_id = ?", userFile.FileID).Count(&count)

	// If no other users reference this file, delete from storage and file table
	if count == 0 {
		// Delete from MinIO (only if configured)
		if fs.minioClient != nil {
			err := fs.minioClient.RemoveObject(
				context.Background(),
				fs.bucketName,
				userFile.File.StoragePath,
				minio.RemoveObjectOptions{},
			)
			if err != nil {
				log.Printf("Warning: Failed to delete file from storage: %v", err)
			}
		}

		// Delete file record
		if err := db.Delete(&models.File{}, userFile.FileID).Error; err != nil {
			log.Printf("Warning: Failed to delete file record: %v", err)
		}
	}

	return nil
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
	Filename *string
	MimeType *string
	MinSize  *int64
	MaxSize  *int64
	DateFrom *interface{} // Time
	DateTo   *interface{} // Time
}
