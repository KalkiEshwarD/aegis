package services

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"log"

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
	// Initialize MinIO client
	minioClient, err := minio.New(cfg.MinIOEndpoint, &minio.Options{
		Creds:  credentials.NewStaticV4(cfg.MinIOAccessKey, cfg.MinIOSecretKey, ""),
		Secure: false, // Set to true for HTTPS
	})
	if err != nil {
		log.Fatalf("Failed to initialize MinIO client: %v", err)
	}

	fs := &FileService{
		minioClient: minioClient,
		bucketName:  cfg.MinIOBucket,
		cfg:         cfg,
	}

	// Ensure bucket exists
	fs.ensureBucketExists()

	return fs
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

	// Check if file with this hash already exists
	var existingFile models.File
	err := db.Where("content_hash = ?", contentHash).First(&existingFile).Error

	var file *models.File
	if errors.Is(err, gorm.ErrRecordNotFound) {
		// File doesn't exist, upload to MinIO
		storagePath := fmt.Sprintf("%s/%s", userID, contentHash)

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

		// Create file record
		file = &models.File{
			ContentHash: contentHash,
			SizeBytes:   sizeBytes,
			StoragePath: storagePath,
		}

		if err := db.Create(file).Error; err != nil {
			// Clean up uploaded file if database fails
			fs.minioClient.RemoveObject(context.Background(), fs.bucketName, storagePath, minio.RemoveObjectOptions{})
			return nil, fmt.Errorf("failed to create file record: %w", err)
		}
	} else if err != nil {
		return nil, fmt.Errorf("database error: %w", err)
	} else {
		// File already exists, use existing record
		file = &existingFile
	}

	// Create user_file record
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
			query = query.Where("filename ILIKE ?", "%"+*filter.Filename+"%")
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
		// Delete from MinIO
		err := fs.minioClient.RemoveObject(
			context.Background(),
			fs.bucketName,
			userFile.File.StoragePath,
			minio.RemoveObjectOptions{},
		)
		if err != nil {
			log.Printf("Warning: Failed to delete file from storage: %v", err)
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

	// Generate presigned URL (valid for 1 hour)
	url, err := fs.minioClient.PresignedGetObject(
		context.Background(),
		fs.bucketName,
		userFile.File.StoragePath,
		3600, // 1 hour
		nil,
	)
	if err != nil {
		return "", fmt.Errorf("failed to generate download URL: %w", err)
	}

	// Log download event
	downloadLog := &models.DownloadLog{
		UserFileID:       userFileID,
		DownloaderUserID: userID,
	}
	database.GetDB().Create(downloadLog)

	return url.String(), nil
}

// GetFile returns the file content as bytes
func (fs *FileService) GetFile(userID, userFileID uint) ([]byte, string, error) {
	db := database.GetDB()

	// Verify user owns the file
	var userFile models.UserFile
	if err := db.Preload("File").Where("id = ? AND user_id = ?", userFileID, userID).First(&userFile).Error; err != nil {
		return nil, "", fmt.Errorf("file not found: %w", err)
	}

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

	// Log download event
	downloadLog := &models.DownloadLog{
		UserFileID:       userFileID,
		DownloaderUserID: userID,
	}
	database.GetDB().Create(downloadLog)

	return buffer.Bytes(), userFile.MimeType, nil
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
