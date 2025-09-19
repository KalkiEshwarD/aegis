package repositories

import (
	"errors"
	"log"

	apperrors "github.com/balkanid/aegis-backend/internal/errors"
	"gorm.io/gorm"

	"github.com/balkanid/aegis-backend/internal/database"
	"github.com/balkanid/aegis-backend/internal/models"
)

// UserResourceRepository handles queries for user-owned resources (files, folders)
type UserResourceRepository struct {
	*BaseRepository
}

// NewUserResourceRepository creates a new user resource repository
func NewUserResourceRepository(db *database.DB) *UserResourceRepository {
	return &UserResourceRepository{
		BaseRepository: NewBaseRepository(db),
	}
}

// GetUserFiles returns user files with optional filtering and preloads
func (urr *UserResourceRepository) GetUserFiles(userID uint, includeTrashed bool, preloads ...string) ([]*models.UserFile, error) {
	db := urr.GetDB()

	query := db.Where("user_id = ?", userID)

	// Apply preloads
	for _, preload := range preloads {
		query = query.Preload(preload)
	}

	// Handle soft deletes
	if includeTrashed {
		query = query.Unscoped()
	} else {
		query = query.Where("deleted_at IS NULL")
	}

	var userFiles []*models.UserFile
	err := query.Find(&userFiles).Error
	return userFiles, err
}

// GetUserFileByID returns a specific user file with ownership validation and preloads
func (urr *UserResourceRepository) GetUserFileByID(userID, fileID uint, includeTrashed bool, preloads ...string) (*models.UserFile, error) {
	db := urr.GetDB()

	query := db.Where("id = ? AND user_id = ?", fileID, userID)

	// Apply preloads
	for _, preload := range preloads {
		query = query.Preload(preload)
	}

	// Handle soft deletes
	if includeTrashed {
		query = query.Unscoped()
	} else {
		query = query.Where("deleted_at IS NULL")
	}

	var userFile models.UserFile
	err := query.First(&userFile).Error

	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, apperrors.New(apperrors.ErrCodeNotFound, "file not found")
	}

	return &userFile, err
}

// GetUserFolders returns user folders with preloads
func (urr *UserResourceRepository) GetUserFolders(userID uint, preloads ...string) ([]*models.Folder, error) {
	db := urr.GetDB()

	query := db.Where("user_id = ? AND deleted_at IS NULL", userID)

	// Apply preloads
	for _, preload := range preloads {
		query = query.Preload(preload)
	}

	var folders []*models.Folder
	err := query.Find(&folders).Error
	return folders, err
}

// GetUserFolderByID returns a specific user folder with ownership validation and preloads
func (urr *UserResourceRepository) GetUserFolderByID(userID, folderID uint, preloads ...string) (*models.Folder, error) {
	db := urr.GetDB()

	query := db.Where("id = ? AND user_id = ? AND deleted_at IS NULL", folderID, userID)

	// Apply preloads
	for _, preload := range preloads {
		query = query.Preload(preload)
	}

	var folder models.Folder
	err := query.First(&folder).Error

	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, apperrors.New(apperrors.ErrCodeNotFound, "folder not found")
	}

	return &folder, err
}

// FindUserFilesWithFilters returns user files with complex filtering (joins, size filters, etc.)
func (urr *UserResourceRepository) FindUserFilesWithFilters(userID uint, filters map[string]interface{}, preloads ...string) ([]*models.UserFile, error) {
	db := urr.GetDB()

	query := db.Where("user_files.user_id = ?", userID)

	// Apply preloads
	for _, preload := range preloads {
		query = query.Preload(preload)
	}

	// Apply filters
	if filename, ok := filters["filename"].(*string); ok && filename != nil {
		query = query.Where("user_files.filename LIKE ?", "%"+*filename+"%")
	}

	if mimeType, ok := filters["mime_type"].(*string); ok && mimeType != nil {
		query = query.Where("user_files.mime_type = ?", *mimeType)
	}

	if minSize, ok := filters["min_size"].(*int64); ok && minSize != nil {
		query = query.Joins("JOIN files ON user_files.file_id = files.id")
		query = query.Where("files.size_bytes >= ?", *minSize)
	}

	if maxSize, ok := filters["max_size"].(*int64); ok && maxSize != nil {
		query = query.Joins("JOIN files ON user_files.file_id = files.id")
		query = query.Where("files.size_bytes <= ?", *maxSize)
	}

	if dateFrom, ok := filters["date_from"].(interface{}); ok && dateFrom != nil {
		query = query.Where("user_files.created_at >= ?", dateFrom)
	}

	if dateTo, ok := filters["date_to"].(interface{}); ok && dateTo != nil {
		query = query.Where("user_files.created_at <= ?", dateTo)
	}

	if folderID, ok := filters["folder_id"].(*string); ok && folderID != nil {
		if *folderID == "" {
			// Empty string means root folder (null folder_id)
			query = query.Where("user_files.folder_id IS NULL")
		} else {
			query = query.Where("user_files.folder_id = ?", *folderID)
		}
	}

	if includeTrashed, ok := filters["include_trashed"].(*bool); ok && includeTrashed != nil && *includeTrashed {
		// Include trashed files - use Unscoped() to include soft-deleted records
		log.Printf("DEBUG: Including trashed files for user %d", userID)
		query = query.Unscoped()
	} else {
		// Exclude trashed files (default behavior)
		log.Printf("DEBUG: Excluding trashed files for user %d, includeTrashed: %v", userID, includeTrashed)
		query = query.Where("user_files.deleted_at IS NULL")
	}

	var userFiles []*models.UserFile
	err := query.Find(&userFiles).Error
	return userFiles, err
}
