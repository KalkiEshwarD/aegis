package services

import (
	apperrors "github.com/balkanid/aegis-backend/internal/errors"
	"gorm.io/gorm"

	"github.com/balkanid/aegis-backend/internal/database"
	"github.com/balkanid/aegis-backend/internal/models"
	"github.com/balkanid/aegis-backend/internal/repositories"
)

type FolderService struct{
	*BaseService
	userResourceRepo     *repositories.UserResourceRepository
	fileOperationsService *FileOperationsService
	extensions           *RoomServiceExtensions
	validationService    *ValidationService
}

func NewFolderService(db *database.DB) *FolderService {
	return &FolderService{
		BaseService:           NewBaseService(db),
		userResourceRepo:     repositories.NewUserResourceRepository(db),
		fileOperationsService: NewFileOperationsService(db),
		extensions:           NewRoomServiceExtensions(db),
		validationService:    NewValidationService(db),
	}
}

// CreateFolder creates a new folder for a user
func (fs *FolderService) CreateFolder(userID uint, name string, parentID *uint) (*models.Folder, error) {
	db := fs.db.GetDB()

	// Validate parent folder ownership if provided
	if parentID != nil {
		var parentFolder models.Folder
		if err := fs.ValidateOwnership(&parentFolder, *parentID, userID); err != nil {
			return nil, err
		}
	}

	// Check for duplicate folder name in the same parent
	if err := fs.validationService.CheckDuplicateName("folders", "name", "parent_id", userID, name, parentID, nil); err != nil {
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

	// Load associations
	db.Preload("User").Preload("Parent").First(folder, folder.ID)

	return folder, nil
}

// GetUserFolders returns all folders for a user
func (fs *FolderService) GetUserFolders(userID uint) ([]*models.Folder, error) {
	return fs.userResourceRepo.GetUserFolders(userID, "Parent", "Children", "Files")
}

// GetFolder returns a specific folder by ID for a user
func (fs *FolderService) GetFolder(userID, folderID uint) (*models.Folder, error) {
	return fs.userResourceRepo.GetUserFolderByID(userID, folderID, "User", "Parent", "Children", "Files")
}

// RenameFolder renames a folder
func (fs *FolderService) RenameFolder(userID, folderID uint, newName string) error {
	db := fs.db.GetDB()

	// Get the folder to check ownership and get parent_id
	var folder models.Folder
	if err := fs.ValidateOwnership(&folder, folderID, userID); err != nil {
		return err
	}

	// Check for duplicate name in the same parent
	if err := fs.validationService.CheckDuplicateName("folders", "name", "parent_id", userID, newName, folder.ParentID, &folderID); err != nil {
		return err
	}

	// Update the folder name
	if err := db.Model(&folder).Update("name", newName).Error; err != nil {
		return apperrors.Wrap(err, apperrors.ErrCodeInternal, "failed to rename folder")
	}

	return nil
}

// MoveFolder moves a folder to a new parent
func (fs *FolderService) MoveFolder(userID, folderID uint, newParentID *uint) error {
	db := fs.db.GetDB()

	// Get the folder to check ownership
	var folder models.Folder
	if err := fs.ValidateOwnership(&folder, folderID, userID); err != nil {
		return err
	}

	// Prevent moving folder into itself or its children
	if newParentID != nil {
		if *newParentID == folderID {
			return apperrors.New(apperrors.ErrCodeInvalidArgument, "cannot move folder into itself")
		}

		// Check if new parent is a descendant of the folder being moved
		if fs.isDescendant(db, folderID, *newParentID) {
			return apperrors.New(apperrors.ErrCodeInvalidArgument, "cannot move folder into its own descendant")
		}

		// Validate new parent ownership
		var newParent models.Folder
		if err := fs.ValidateOwnership(&newParent, *newParentID, userID); err != nil {
			return err
		}
	}

	// Update the parent_id
	if err := db.Model(&folder).Update("parent_id", newParentID).Error; err != nil {
		return apperrors.Wrap(err, apperrors.ErrCodeInternal, "failed to move folder")
	}

	return nil
}

// DeleteFolder soft deletes a folder and all its contents
func (fs *FolderService) DeleteFolder(userID, folderID uint) error {
	db := fs.db.GetDB()

	// Get the folder to check ownership
	var folder models.Folder
	if err := fs.ValidateOwnership(&folder, folderID, userID); err != nil {
		return err
	}

	// Soft delete the folder (this will cascade to files via application logic)
	if err := db.Delete(&folder).Error; err != nil {
		return apperrors.Wrap(err, apperrors.ErrCodeInternal, "failed to delete folder")
	}

	return nil
}

// MoveFile moves a file to a different folder
func (fs *FolderService) MoveFile(userID, fileID uint, newFolderID *uint) error {
	return fs.fileOperationsService.MoveFile(userID, fileID, newFolderID)
}

// ShareFolderToRoom shares a folder to a room
func (fs *FolderService) ShareFolderToRoom(userID, folderID, roomID uint) error {
	folder := &models.Folder{}
	entity := FolderEntity{Folder: folder}

	return fs.extensions.ShareEntityToRoom(entity, EntityTypeFolder, roomID, userID, false)
}

// RemoveFolderFromRoom removes a folder from a room
func (fs *FolderService) RemoveFolderFromRoom(userID, folderID, roomID uint) error {
	folder := &models.Folder{}
	entity := FolderEntity{Folder: folder}

	return fs.extensions.RemoveEntityFromRoom(entity, EntityTypeFolder, roomID, userID, false)
}

// Helper function to check if a folder is a descendant of another folder
func (fs *FolderService) isDescendant(db *gorm.DB, ancestorID, descendantID uint) bool {
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