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

	apperrors "github.com/balkanid/aegis-backend/internal/errors"
	"gorm.io/gorm"

	"github.com/balkanid/aegis-backend/internal/config"
	"github.com/balkanid/aegis-backend/internal/database"
	"github.com/balkanid/aegis-backend/internal/models"
	"github.com/balkanid/aegis-backend/internal/repositories"
)

type StorageService struct {
	*BaseService
	userResourceRepo      *repositories.UserResourceRepository
	fileStorageService    *FileStorageService
	cfg                   *config.Config
	fileOperationsService *FileOperationsService
	authService           *AuthService
}

func NewStorageService(cfg *config.Config, db *database.DB, fileStorageService *FileStorageService, authService *AuthService) *StorageService {
	return &StorageService{
		BaseService:           NewBaseService(db),
		userResourceRepo:      repositories.NewUserResourceRepository(db),
		cfg:                   cfg,
		fileStorageService:    fileStorageService,
		fileOperationsService: NewFileOperationsService(db),
		authService:           authService,
	}
}

// UploadFileFromMap converts map[string]interface{} to UploadFileInput and uploads
// This solves the "map[string]interface {} is not an Upload" error using JSON unmarshaling
func (s *StorageService) UploadFileFromMap(userID uint, data map[string]interface{}) (*models.UserFile, error) {
	// Define a temporary struct that matches the expected JSON structure
	// Note: JSON numbers are float64, so we need to handle that
	type UploadData struct {
		Filename     string   `json:"filename"`
		MimeType     string   `json:"mime_type"`
		SizeBytes    float64  `json:"size_bytes"` // Use float64 for JSON compatibility
		ContentHash  string   `json:"content_hash"`
		EncryptedKey string   `json:"encrypted_key"`
		FolderID     *float64 `json:"folder_id,omitempty"` // Optional folder ID
		FileData     string   `json:"file_data,omitempty"` // Base64 encoded file data as string
	}

	// Convert map to JSON bytes
	jsonData, err := json.Marshal(data)
	if err != nil {
		return nil, apperrors.Wrap(err, apperrors.ErrCodeInternal, "failed to marshal upload data")
	}

	// Unmarshal into our temporary struct
	var uploadData UploadData
	err = json.Unmarshal(jsonData, &uploadData)
	if err != nil {
		return nil, apperrors.Wrap(err, apperrors.ErrCodeInvalidArgument, "failed to unmarshal upload data")
	}

	// Convert base64 file data to bytes
	var fileReader io.Reader
	if uploadData.FileData != "" {
		// Decode base64 to get the actual file bytes
		decodedData, err := base64.StdEncoding.DecodeString(uploadData.FileData)
		if err != nil {
			return nil, apperrors.Wrap(err, apperrors.ErrCodeInvalidArgument, "failed to decode base64 file data")
		}
		fileReader = bytes.NewReader(decodedData)
	} else {
		return nil, apperrors.New(apperrors.ErrCodeInvalidArgument, "file data is required for upload")
	}

	// Convert float64 size to int64
	sizeBytes := int64(uploadData.SizeBytes)

	// Convert folder_id if provided
	var folderID *uint
	if uploadData.FolderID != nil {
		fid := uint(*uploadData.FolderID)
		folderID = &fid
	}

	// Now call the existing UploadFile method with the converted data
	userFile, err := s.UploadFile(
		userID,
		uploadData.Filename,
		uploadData.MimeType,
		uploadData.ContentHash,
		uploadData.EncryptedKey,
		fileReader,
		sizeBytes,
		folderID,
	)
	return userFile, err
}

// UploadFile handles file upload with user-specific deduplication
func (s *StorageService) UploadFile(userID uint, filename, mimeType, contentHash, encryptionKey string, fileData io.Reader, sizeBytes int64, folderID *uint) (*models.UserFile, error) {
	db := s.db.GetDB()

	// Check if this user already has a file with the same content hash and filename
	// This prevents user-level duplicates while allowing different users to have the same file
	var existingUserFile models.UserFile
	err := db.Joins("JOIN files ON user_files.file_id = files.id").
		Where("user_files.user_id = ? AND files.content_hash = ? AND user_files.filename = ?",
			userID, contentHash, filename).
		Preload("File").
		First(&existingUserFile).Error

	if err == nil {
		// User already has this exact file - return the existing record
		return &existingUserFile, nil
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		// Database error
		return nil, apperrors.Wrap(err, apperrors.ErrCodeInternal, "database error checking for existing user file")
	}

	// User doesn't have this file yet - check if we can reuse an existing file record
	var existingFile models.File
	err = db.Where("content_hash = ?", contentHash).First(&existingFile).Error

	var file *models.File
	var storagePath string

	if err == nil {
		// File with same content hash exists - reuse it (storage deduplication)
		file = &existingFile
		storagePath = existingFile.StoragePath
	} else if errors.Is(err, gorm.ErrRecordNotFound) {
		// No existing file with this content hash - create new file record and upload to storage
		storagePath = fmt.Sprintf("%d/%s", userID, contentHash)
		if err := s.fileStorageService.UploadFile(context.Background(), storagePath, fileData, sizeBytes, mimeType); err != nil {
			return nil, apperrors.Wrap(err, apperrors.ErrCodeInternal, "failed to upload file to storage")
		}

		// Create new file record
		file = &models.File{
			ContentHash: contentHash,
			SizeBytes:   sizeBytes,
			StoragePath: storagePath,
		}

		if err := db.Create(file).Error; err != nil {
			// Clean up uploaded file if database fails
			s.fileStorageService.DeleteFile(context.Background(), storagePath)
			return nil, apperrors.Wrap(err, apperrors.ErrCodeInternal, "failed to create file record")
		}
	} else {
		// Database error
		log.Printf("DEBUG: Database error checking for existing file: %v", err)
		return nil, apperrors.Wrap(err, apperrors.ErrCodeInternal, "database error checking for existing file")
	}

	// Validate folder ownership if provided
	if folderID != nil {
		var folder models.Folder
		if err := s.ValidateOwnership(&folder, *folderID, userID); err != nil {
			return nil, err
		}
	}

	// Create user_file record linking user to the file (existing or new)
	userFile := &models.UserFile{
		UserID:        userID,
		FileID:        file.ID,
		FolderID:      folderID,
		Filename:      filename,
		MimeType:      mimeType,
		EncryptionKey: encryptionKey,
	}

	if err := db.Create(userFile).Error; err != nil {
		return nil, apperrors.Wrap(err, apperrors.ErrCodeInternal, "failed to create user file record")
	}

	// Load associations
	db.Preload("File").First(userFile, userFile.ID)

	return userFile, nil
}

func (s *StorageService) GetUserFiles(userID uint, filter *FileFilter) ([]*models.UserFile, error) {
	log.Printf("DEBUG: StorageService.GetUserFiles called for user %d with filter: %+v", userID, filter)
	filters := make(map[string]interface{})

	if filter != nil {
		if filter.IncludeTrashed != nil {
			log.Printf("DEBUG: Adding include_trashed filter: %v", *filter.IncludeTrashed)
			filters["include_trashed"] = filter.IncludeTrashed
		}
		if filter.Filename != nil {
			filters["filename"] = filter.Filename
		}
		if filter.MimeType != nil {
			filters["mime_type"] = filter.MimeType
		}
		if filter.MinSize != nil {
			filters["min_size"] = filter.MinSize
		}
		if filter.MaxSize != nil {
			filters["max_size"] = filter.MaxSize
		}
		if filter.DateFrom != nil {
			filters["date_from"] = filter.DateFrom
		}
		if filter.DateTo != nil {
			filters["date_to"] = filter.DateTo
		}
		if filter.FolderID != nil {
			filters["folder_id"] = filter.FolderID
		}
	}

	return s.userResourceRepo.FindUserFilesWithFilters(userID, filters, "File", "Folder")
}

// DeleteFile soft deletes a user's file (moves to trash)
func (s *StorageService) DeleteFile(userID, userFileID uint) error {
	db := s.db.GetDB()

	// Get the user file
	var userFile models.UserFile
	if err := s.ValidateOwnership(&userFile, userFileID, userID); err != nil {
		return err
	}
	// Preload File for later use
	db.Preload("File").First(&userFile, userFile.ID)

	// Remove file from all rooms first (to avoid foreign key constraint issues)
	if err := db.Where("user_file_id = ?", userFileID).Delete(&models.RoomFile{}).Error; err != nil {
		return apperrors.Wrap(err, apperrors.ErrCodeInternal, "failed to remove file from rooms")
	}

	// Soft delete the user_file record (sets deleted_at timestamp)
	if err := db.Delete(&userFile).Error; err != nil {
		return apperrors.Wrap(err, apperrors.ErrCodeInternal, "failed to soft delete user file record")
	}

	return nil
}

// RestoreFile restores a soft-deleted file
func (s *StorageService) RestoreFile(userID, userFileID uint) error {
	db := s.db.GetDB()

	// Find the soft-deleted user file using Unscoped to include deleted records
	var userFile models.UserFile
	if err := db.Unscoped().Where("id = ? AND user_id = ?", userFileID, userID).First(&userFile).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return apperrors.New(apperrors.ErrCodeNotFound, "file not found")
		}
		return apperrors.Wrap(err, apperrors.ErrCodeInternal, "database error")
	}
	// Preload File for later use
	db.Preload("File").First(&userFile, userFile.ID)

	// Check if the file is actually soft-deleted
	if userFile.DeletedAt.Valid == false {
		return apperrors.New(apperrors.ErrCodeInvalidArgument, "file is not in trash")
	}

	// Restore the file by setting deleted_at to NULL using raw SQL
	if err := db.Exec("UPDATE user_files SET deleted_at = NULL WHERE id = ? AND user_id = ?", userFileID, userID).Error; err != nil {
		return apperrors.Wrap(err, apperrors.ErrCodeInternal, "failed to restore user file record")
	}

	return nil
}

// PermanentlyDeleteFile permanently deletes a soft-deleted file from storage and database
func (s *StorageService) PermanentlyDeleteFile(userID, userFileID uint) error {
	db := s.db.GetDB()

	// Find the soft-deleted user file using Unscoped to include deleted records
	var userFile models.UserFile
	if err := db.Unscoped().Where("id = ? AND user_id = ?", userFileID, userID).First(&userFile).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return apperrors.New(apperrors.ErrCodeNotFound, "file not found")
		}
		return apperrors.Wrap(err, apperrors.ErrCodeInternal, "database error")
	}
	// Preload File for later use
	db.Preload("File").First(&userFile, userFile.ID)

	// Check if the file is actually soft-deleted
	if userFile.DeletedAt.Valid == false {
		return apperrors.New(apperrors.ErrCodeInvalidArgument, "file is not in trash - use DeleteFile first")
	}

	// Delete from MinIO storage
	if err := s.fileStorageService.DeleteFile(context.Background(), userFile.File.StoragePath); err != nil {
		log.Printf("Warning: Failed to delete file from storage: %v", err)
		// Continue with database deletion even if storage deletion fails
	}

	// Hard delete the user_file record using Unscoped
	if err := db.Unscoped().Delete(&userFile).Error; err != nil {
		return apperrors.Wrap(err, apperrors.ErrCodeInternal, "failed to permanently delete user file record")
	}

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
		}
	}

	return nil
}

// GetFile returns the file content as bytes
func (s *StorageService) GetFile(userID, userFileID uint) ([]byte, string, error) {
	db := s.db.GetDB()

	// Verify user owns the file
	var userFile models.UserFile
	if err := s.ValidateOwnership(&userFile, userFileID, userID); err != nil {
		return nil, "", err
	}
	// Preload File for later use
	db.Preload("File").First(&userFile, userFile.ID)

	// Get file content
	object, err := s.fileStorageService.DownloadFile(context.Background(), userFile.File.StoragePath)
	if err != nil {
		return nil, "", apperrors.Wrap(err, apperrors.ErrCodeInternal, "failed to get file from storage")
	}
	defer object.Close()

	// Read file content
	var buffer bytes.Buffer
	_, err = io.Copy(&buffer, object)
	if err != nil {
		return nil, "", apperrors.Wrap(err, apperrors.ErrCodeInternal, "failed to read file content")
	}

	// Log download event
	downloadLog := &models.DownloadLog{
		UserFileID:       userFileID,
		DownloaderUserID: userID,
	}
	db.Create(downloadLog)

	return buffer.Bytes(), userFile.MimeType, nil
}

// StreamFile returns a reader for the file content (for direct streaming)
func (s *StorageService) StreamFile(userID, userFileID uint) (io.ReadCloser, string, error) {
	db := s.db.GetDB()

	// Verify user owns the file
	var userFile models.UserFile
	if err := s.ValidateOwnership(&userFile, userFileID, userID); err != nil {
		return nil, "", err
	}
	// Preload File for later use
	db.Preload("File").First(&userFile, userFile.ID)

	// Get file from MinIO
	object, err := s.fileStorageService.DownloadFile(context.Background(), userFile.File.StoragePath)
	if err != nil {
		return nil, "", apperrors.Wrap(err, apperrors.ErrCodeInternal, "failed to get file from storage")
	}

	return object, userFile.MimeType, nil
}

// GetAllFiles returns all files in the system (admin only)
func (s *StorageService) GetAllFiles() ([]*models.UserFile, error) {
	var userFiles []*models.UserFile
	err := s.db.GetDB().Preload("User").Preload("File").Find(&userFiles).Error
	return userFiles, err
}

// MoveFile moves a file to a different folder
func (s *StorageService) MoveFile(userID, fileID uint, newFolderID *uint) error {
	return s.fileOperationsService.MoveFile(userID, fileID, newFolderID)
}

// GetFileDownloadURL generates a download URL for the file
func (s *StorageService) GetFileDownloadURL(ctx context.Context, user *models.User, userFileID uint) (string, error) {
	db := s.db.GetDB()

	// Verify user owns the file
	var userFile models.UserFile
	if err := s.ValidateOwnership(&userFile, userFileID, user.ID); err != nil {
		return "", err
	}
	// Preload File for later use
	db.Preload("File").First(&userFile, userFile.ID)

	// Generate a token for the download
	token, err := s.authService.GenerateToken(user)
	if err != nil {
		return "", fmt.Errorf("failed to generate download token: %w", err)
	}

	// Generate download URL with token
	baseURL := s.cfg.BaseURL
	if baseURL == "" {
		baseURL = "http://localhost:8080" // Default for development
	}

	return fmt.Sprintf("%s/api/files/%d/download?token=%s", baseURL, userFileID, token), nil
}

// GetTrashedFiles returns all trashed (soft-deleted) files for a user
func (s *StorageService) GetTrashedFiles(userID uint) ([]*models.UserFile, error) {
	includeTrashed := true
	filter := &FileFilter{
		IncludeTrashed: &includeTrashed,
	}
	return s.GetUserFiles(userID, filter)
}

// FileFilter represents filters for file queries
type FileFilter struct {
	Filename       *string
	MimeType       *string
	MinSize        *int64
	MaxSize        *int64
	DateFrom       *interface{} // Time
	DateTo         *interface{} // Time
	IncludeTrashed *bool
	FolderID       *string
}
