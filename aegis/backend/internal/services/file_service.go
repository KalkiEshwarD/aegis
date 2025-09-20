
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

type FileService struct {
	*BaseService
	userResourceRepo   *repositories.UserResourceRepository
	fileStorageService *FileStorageService
	cfg                *config.Config
	authService        *AuthService
}

func NewFileService(cfg *config.Config, db *database.DB, fileStorageService *FileStorageService, authService *AuthService) *FileService {
	return &FileService{
		BaseService:        NewBaseService(db),
		userResourceRepo:   repositories.NewUserResourceRepository(db),
		cfg:                cfg,
		fileStorageService: fileStorageService,
		authService:        authService,
	}
}

//================================================================================
// File Operations
//================================================================================

func (s *FileService) UploadFileFromMap(userID uint, data map[string]interface{}) (*models.UserFile, error) {
	type UploadData struct {
		Filename     string   `json:"filename"`
		MimeType     string   `json:"mime_type"`
		SizeBytes    float64  `json:"size_bytes"`
		ContentHash  string   `json:"content_hash"`
		EncryptedKey string   `json:"encrypted_key"`
		FolderID     *float64 `json:"folder_id,omitempty"`
		FileData     string   `json:"file_data,omitempty"`
	}

	jsonData, err := json.Marshal(data)
	if err != nil {
		return nil, apperrors.Wrap(err, apperrors.ErrCodeInternal, "failed to marshal upload data")
	}

	var uploadData UploadData
	err = json.Unmarshal(jsonData, &uploadData)
	if err != nil {
		return nil, apperrors.Wrap(err, apperrors.ErrCodeInvalidArgument, "failed to unmarshal upload data")
	}

	var fileReader io.Reader
	if uploadData.FileData != "" {
		decodedData, err := base64.StdEncoding.DecodeString(uploadData.FileData)
		if err != nil {
			return nil, apperrors.Wrap(err, apperrors.ErrCodeInvalidArgument, "failed to decode base64 file data")
		}
		fileReader = bytes.NewReader(decodedData)
	} else {
		return nil, apperrors.New(apperrors.ErrCodeInvalidArgument, "file data is required for upload")
	}

	sizeBytes := int64(uploadData.SizeBytes)

	var folderID *uint
	if uploadData.FolderID != nil {
		fid := uint(*uploadData.FolderID)
		folderID = &fid
	}

	return s.UploadFile(
		userID,
		uploadData.Filename,
		uploadData.MimeType,
		uploadData.ContentHash,
		uploadData.EncryptedKey,
		fileReader,
		sizeBytes,
		folderID,
	)
}

func (s *FileService) UploadFile(userID uint, filename, mimeType, contentHash, encryptionKey string, fileData io.Reader, sizeBytes int64, folderID *uint) (*models.UserFile, error) {
	db := s.db.GetDB()

	var existingUserFile models.UserFile
	err := db.Joins("JOIN files ON user_files.file_id = files.id").
		Where("user_files.user_id = ? AND files.content_hash = ? AND user_files.filename = ?",
			userID, contentHash, filename).
		Preload("File").
		First(&existingUserFile).Error

	if err == nil {
		return &existingUserFile, nil
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, apperrors.Wrap(err, apperrors.ErrCodeInternal, "database error checking for existing user file")
	}

	var existingFile models.File
	err = db.Where("content_hash = ?", contentHash).First(&existingFile).Error

	var file *models.File
	var storagePath string

	if err == nil {
		file = &existingFile
		storagePath = existingFile.StoragePath
	} else if errors.Is(err, gorm.ErrRecordNotFound) {
		storagePath = fmt.Sprintf("%d/%s", userID, contentHash)
		if err := s.fileStorageService.UploadFile(context.Background(), storagePath, fileData, sizeBytes, mimeType); err != nil {
			return nil, apperrors.Wrap(err, apperrors.ErrCodeInternal, "failed to upload file to storage")
		}

		file = &models.File{
			ContentHash: contentHash,
			SizeBytes:   sizeBytes,
			StoragePath: storagePath,
		}

		if err := db.Create(file).Error; err != nil {
			s.fileStorageService.DeleteFile(context.Background(), storagePath)
			return nil, apperrors.Wrap(err, apperrors.ErrCodeInternal, "failed to create file record")
		}
	} else {
		log.Printf("DEBUG: Database error checking for existing file: %v", err)
		return nil, apperrors.Wrap(err, apperrors.ErrCodeInternal, "database error checking for existing file")
	}

	if folderID != nil {
		var folder models.Folder
		if err := s.ValidateOwnership(&folder, *folderID, userID); err != nil {
			return nil, err
		}
	}

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

	db.Preload("File").First(userFile, userFile.ID)

	return userFile, nil
}

func (s *FileService) GetUserFiles(userID uint, filter *FileFilter) ([]*models.UserFile, error) {
	filters := make(map[string]interface{})
	if filter != nil {
		if filter.IncludeTrashed != nil {
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

func (s *FileService) DeleteFile(userID, userFileID uint) error {
	db := s.db.GetDB()

	var userFile models.UserFile
	if err := s.ValidateOwnership(&userFile, userFileID, userID); err != nil {
		return err
	}
	db.Preload("File").First(&userFile, userFile.ID)

	if err := db.Where("user_file_id = ?", userFileID).Delete(&models.RoomFile{}).Error; err != nil {
		return apperrors.Wrap(err, apperrors.ErrCodeInternal, "failed to remove file from rooms")
	}

	if err := db.Delete(&userFile).Error; err != nil {
		return apperrors.Wrap(err, apperrors.ErrCodeInternal, "failed to soft delete user file record")
	}

	return nil
}

func (s *FileService) RestoreFile(userID, userFileID uint) error {
	db := s.db.GetDB()

	var userFile models.UserFile
	if err := db.Unscoped().Where("id = ? AND user_id = ?", userFileID, userID).First(&userFile).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return apperrors.New(apperrors.ErrCodeNotFound, "file not found")
		}
		return apperrors.Wrap(err, apperrors.ErrCodeInternal, "database error")
	}

	if userFile.DeletedAt.Valid == false {
		return apperrors.New(apperrors.ErrCodeInvalidArgument, "file is not in trash")
	}

	if err := db.Exec("UPDATE user_files SET deleted_at = NULL WHERE id = ? AND user_id = ?", userFileID, userID).Error; err != nil {
		return apperrors.Wrap(err, apperrors.ErrCodeInternal, "failed to restore user file record")
	}

	return nil
}

func (s *FileService) PermanentlyDeleteFile(userID, userFileID uint) error {
	db := s.db.GetDB()

	var userFile models.UserFile
	if err := db.Unscoped().Where("id = ? AND user_id = ?", userFileID, userID).First(&userFile).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return apperrors.New(apperrors.ErrCodeNotFound, "file not found")
		}
		return apperrors.Wrap(err, apperrors.ErrCodeInternal, "database error")
	}
	db.Preload("File").First(&userFile, userFile.ID)

	if userFile.DeletedAt.Valid == false {
		return apperrors.New(apperrors.ErrCodeInvalidArgument, "file is not in trash - use DeleteFile first")
	}

	if err := s.fileStorageService.DeleteFile(context.Background(), userFile.File.StoragePath); err != nil {
		log.Printf("Warning: Failed to delete file from storage: %v", err)
	}

	if err := db.Unscoped().Delete(&userFile).Error; err != nil {
		return apperrors.Wrap(err, apperrors.ErrCodeInternal, "failed to permanently delete user file record")
	}

	var count int64
	if err := db.Unscoped().Model(&models.UserFile{}).Where("file_id = ?", userFile.FileID).Count(&count).Error; err != nil {
		log.Printf("Warning: Failed to check for other file references: %v", err)
		return nil
	}

	if count == 0 {
		if err := db.Unscoped().Delete(&models.File{}, userFile.FileID).Error; err != nil {
			log.Printf("Warning: Failed to permanently delete file record: %v", err)
		}
	}

	return nil
}

func (s *FileService) GetFile(userID, userFileID uint) ([]byte, string, error) {
	db := s.db.GetDB()

	var userFile models.UserFile
	if err := s.ValidateOwnership(&userFile, userFileID, userID); err != nil {
		return nil, "", err
	}
	db.Preload("File").First(&userFile, userFile.ID)

	object, err := s.fileStorageService.DownloadFile(context.Background(), userFile.File.StoragePath)
	if err != nil {
		return nil, "", apperrors.Wrap(err, apperrors.ErrCodeInternal, "failed to get file from storage")
	}
	defer object.Close()

	var buffer bytes.Buffer
	_, err = io.Copy(&buffer, object)
	if err != nil {
		return nil, "", apperrors.Wrap(err, apperrors.ErrCodeInternal, "failed to read file content")
	}

	downloadLog := &models.DownloadLog{
		UserFileID:       userFileID,
		DownloaderUserID: userID,
	}
	db.Create(downloadLog)

	return buffer.Bytes(), userFile.MimeType, nil
}

func (s *FileService) StreamFile(userID, userFileID uint) (io.ReadCloser, string, error) {
	db := s.db.GetDB()

	var userFile models.UserFile
	if err := s.ValidateOwnership(&userFile, userFileID, userID); err != nil {
		return nil, "", err
	}
	db.Preload("File").First(&userFile, userFile.ID)

	object, err := s.fileStorageService.DownloadFile(context.Background(), userFile.File.StoragePath)
	if err != nil {
		return nil, "", apperrors.Wrap(err, apperrors.ErrCodeInternal, "failed to get file from storage")
	}

	return object, userFile.MimeType, nil
}

func (s *FileService) GetFileDownloadURL(ctx context.Context, user *models.User, userFileID uint) (string, error) {
	db := s.db.GetDB()

	var userFile models.UserFile
	if err := s.ValidateOwnership(&userFile, userFileID, user.ID); err != nil {
		return "", err
	}
	db.Preload("File").First(&userFile, userFile.ID)

	token, err := s.authService.GenerateToken(user)
	if err != nil {
		return "", fmt.Errorf("failed to generate download token: %w", err)
	}

	baseURL := s.cfg.BaseURL
	if baseURL == "" {
		baseURL = "http://localhost:8080"
	}

	return fmt.Sprintf("%s/api/files/%d/download?token=%s", baseURL, userFileID, token), nil
}

func (s *FileService) CheckDuplicateName(tableName, fieldName, parentFieldName string, userID uint, name string, parentID *uint, excludeID *uint) error {
	db := s.db.GetDB()

	// Build the query dynamically
	query := db.Table(tableName).Where(fieldName+" = ? AND user_id = ?", name, userID)

	// Add parent condition if provided
	if parentID != nil {
		query = query.Where(parentFieldName+" = ?", *parentID)
	} else {
		query = query.Where(parentFieldName+" IS NULL")
	}

	// Exclude specific ID if provided (for rename operations)
	if excludeID != nil {
		query = query.Where("id != ?", *excludeID)
	}

	var count int64
	if err := query.Count(&count).Error; err != nil {
		return apperrors.Wrap(err, apperrors.ErrCodeInternal, "database error")
	}

	if count > 0 {
		return apperrors.New(apperrors.ErrCodeConflict, fieldName+" with this name already exists in the specified location")
	}

	return nil
}

func (s *FileService) GetAllFiles() ([]*models.UserFile, error) {
	var userFiles []*models.UserFile
	err := s.db.GetDB().Preload("User").Preload("File").Find(&userFiles).Error
	return userFiles, err
}

//================================================================================
// Folder Operations
//================================================================================

func (s *FileService) CreateFolder(userID uint, name string, parentID *uint) (*models.Folder, error) {
	db := s.db.GetDB()

	if parentID != nil {
		var parentFolder models.Folder
		if err := s.ValidateOwnership(&parentFolder, *parentID, userID); err != nil {
			return nil, err
		}
	}

	if err := s.CheckDuplicateName("folders", "name", "parent_id", userID, name, parentID, nil); err != nil {
		return nil, err
	}

	folder := &models.Folder{
		UserID:   userID,
		Name:     name,
		ParentID: parentID,
	}

	if err := db.Create(folder).Error; err != nil {
		return nil, apperrors.Wrap(err, apperrors.ErrCodeInternal, "failed to create folder")
	}

	db.Preload("User").Preload("Parent").First(folder, folder.ID)

	return folder, nil
}

func (s *FileService) GetUserFolders(userID uint) ([]*models.Folder, error) {
	return s.userResourceRepo.GetUserFolders(userID, "Parent", "Children", "Files")
}

func (s *FileService) GetFolder(userID, folderID uint) (*models.Folder, error) {
	return s.userResourceRepo.GetUserFolderByID(userID, folderID, "User", "Parent", "Children", "Files")
}

func (s *FileService) RenameFolder(userID, folderID uint, newName string) error {
	db := s.db.GetDB()

	var folder models.Folder
	if err := s.ValidateOwnership(&folder, folderID, userID); err != nil {
		return err
	}

	if err := s.CheckDuplicateName("folders", "name", "parent_id", userID, newName, folder.ParentID, &folderID); err != nil {
		return err
	}

	if err := db.Model(&folder).Update("name", newName).Error; err != nil {
		return apperrors.Wrap(err, apperrors.ErrCodeInternal, "failed to rename folder")
	}

	return nil
}

func (s *FileService) MoveFolder(userID, folderID uint, newParentID *uint) error {
	db := s.db.GetDB()

	var folder models.Folder
	if err := s.ValidateOwnership(&folder, folderID, userID); err != nil {
		return err
	}

	if newParentID != nil {
		if *newParentID == folderID {
			return apperrors.New(apperrors.ErrCodeInvalidArgument, "cannot move folder into itself")
		}

		if s.isDescendant(db, folderID, *newParentID) {
			return apperrors.New(apperrors.ErrCodeInvalidArgument, "cannot move folder into its own descendant")
		}

		var newParent models.Folder
		if err := s.ValidateOwnership(&newParent, *newParentID, userID); err != nil {
			return err
		}
	}

	if err := db.Model(&folder).Update("parent_id", newParentID).Error; err != nil {
		return apperrors.Wrap(err, apperrors.ErrCodeInternal, "failed to move folder")
	}

	return nil
}

func (s *FileService) DeleteFolder(userID, folderID uint) error {
	db := s.db.GetDB()

	var folder models.Folder
	if err := s.ValidateOwnership(&folder, folderID, userID); err != nil {
		return err
	}

	tx := db.Begin()
	if tx.Error != nil {
		return apperrors.Wrap(tx.Error, apperrors.ErrCodeInternal, "failed to start transaction")
	}
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	folderIDsToDelete, err := s.collectDescendantFolders(tx, folderID)
	if err != nil {
		tx.Rollback()
		return err
	}
	folderIDsToDelete = append(folderIDsToDelete, folderID)

	if len(folderIDsToDelete) > 0 {
		if err := tx.Model(&models.UserFile{}).
			Where("folder_id IN (?) AND user_id = ?", folderIDsToDelete, userID).
			Update("folder_id", nil).Error; err != nil {
			tx.Rollback()
			return apperrors.Wrap(err, apperrors.ErrCodeInternal, "failed to move files to root")
		}

		var fileIDs []uint
		if err := tx.Model(&models.UserFile{}).
			Where("folder_id IN (?) AND user_id = ?", folderIDsToDelete, userID).
			Pluck("id", &fileIDs).Error; err != nil {
			tx.Rollback()
			return apperrors.Wrap(err, apperrors.ErrCodeInternal, "failed to get file IDs")
		}

		if len(fileIDs) > 0 {
			if err := tx.Where("user_file_id IN (?)", fileIDs).Delete(&models.RoomFile{}).Error; err != nil {
				tx.Rollback()
				return apperrors.Wrap(err, apperrors.ErrCodeInternal, "failed to remove files from rooms")
			}
		}

		if err := tx.Where("folder_id IN (?)", folderIDsToDelete).Delete(&models.RoomFolder{}).Error; err != nil {
			tx.Rollback()
			return apperrors.Wrap(err, apperrors.ErrCodeInternal, "failed to remove folders from rooms")
		}

		for i := len(folderIDsToDelete) - 1; i >= 0; i-- {
			if err := tx.Where("id = ? AND user_id = ?", folderIDsToDelete[i], userID).Delete(&models.Folder{}).Error; err != nil {
				tx.Rollback()
				return apperrors.Wrap(err, apperrors.ErrCodeInternal, "failed to delete folder")
			}
		}
	}

	if err := tx.Commit().Error; err != nil {
		return apperrors.Wrap(err, apperrors.ErrCodeInternal, "failed to commit transaction")
	}

	return nil
}

func (s *FileService) collectDescendantFolders(db *gorm.DB, parentID uint) ([]uint, error) {
	var folderIDs []uint
	var children []models.Folder

	if err := db.Where("parent_id = ?", parentID).Find(&children).Error; err != nil {
		return nil, apperrors.Wrap(err, apperrors.ErrCodeInternal, "failed to get child folders")
	}

	for _, child := range children {
		folderIDs = append(folderIDs, child.ID)
		descendants, err := s.collectDescendantFolders(db, child.ID)
		if err != nil {
			return nil, err
		}
		folderIDs = append(folderIDs, descendants...)
	}

	return folderIDs, nil
}

func (s *FileService) isDescendant(db *gorm.DB, ancestorID, descendantID uint) bool {
	var currentID = descendantID
	for currentID != 0 {
		if currentID == ancestorID {
			return true
		}

		var folder models.Folder
		if err := db.Select("parent_id").Where("id = ?", currentID).First(&folder).Error; err != nil {
			break
		}

		if folder.ParentID == nil {
			break
		}
		currentID = *folder.ParentID
	}
	return false
}

//================================================================================
// File/Folder Operations
//================================================================================

func (s *FileService) MoveFile(userID, fileID uint, newFolderID *uint) error {
	db := s.db.GetDB()

	var userFile models.UserFile
	if err := s.ValidateOwnership(&userFile, fileID, userID); err != nil {
		return err
	}

	if newFolderID != nil {
		var newFolder models.Folder
		if err := s.ValidateOwnership(&newFolder, *newFolderID, userID); err != nil {
			return err
		}
	}

	if err := db.Model(&userFile).Update("folder_id", newFolderID).Error; err != nil {
		return apperrors.Wrap(err, apperrors.ErrCodeInternal, "failed to move file")
	}

	return nil
}



//================================================================================
// Filter Struct
//================================================================================

type FileFilter struct {
	Filename       *string
	MimeType       *string
	MinSize        *int64
	MaxSize        *int64
	DateFrom       *interface{}
	DateTo         *interface{}
	IncludeTrashed *bool
	FolderID       *string
}
