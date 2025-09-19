package services

import (
	"errors"
	"fmt"

	"github.com/balkanid/aegis-backend/internal/database"
	"github.com/balkanid/aegis-backend/internal/models"
	"gorm.io/gorm"
)

type FolderService struct{}

func NewFolderService() *FolderService {
	return &FolderService{}
}

// CreateFolder creates a new folder for a user
func (fs *FolderService) CreateFolder(userID uint, name string, parentID *uint) (*models.Folder, error) {
	db := database.GetDB()

	// Validate parent folder ownership if provided
	if parentID != nil {
		var parentFolder models.Folder
		if err := db.Where("id = ? AND user_id = ?", *parentID, userID).First(&parentFolder).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return nil, fmt.Errorf("parent folder not found or access denied")
			}
			return nil, fmt.Errorf("database error: %w", err)
		}
	}

	// Check for duplicate folder name in the same parent
	var existingCount int64
	query := db.Model(&models.Folder{}).Where("user_id = ? AND name = ? AND parent_id IS NULL", userID, name)
	if parentID != nil {
		query = db.Model(&models.Folder{}).Where("user_id = ? AND name = ? AND parent_id = ?", userID, name, *parentID)
	}
	if err := query.Count(&existingCount).Error; err != nil {
		return nil, fmt.Errorf("database error: %w", err)
	}
	if existingCount > 0 {
		return nil, fmt.Errorf("folder with this name already exists in the specified location")
	}

	folder := &models.Folder{
		UserID:   userID,
		Name:     name,
		ParentID: parentID,
	}

	if err := db.Create(folder).Error; err != nil {
		return nil, fmt.Errorf("failed to create folder: %w", err)
	}

	// Load associations
	db.Preload("User").Preload("Parent").First(folder, folder.ID)

	return folder, nil
}

// GetUserFolders returns all folders for a user
func (fs *FolderService) GetUserFolders(userID uint) ([]*models.Folder, error) {
	db := database.GetDB()

	var folders []*models.Folder
	err := db.Where("user_id = ? AND deleted_at IS NULL", userID).
		Preload("Parent").
		Preload("Children", "deleted_at IS NULL").
		Preload("Files", "deleted_at IS NULL").
		Find(&folders).Error

	return folders, err
}

// GetFolder returns a specific folder by ID for a user
func (fs *FolderService) GetFolder(userID, folderID uint) (*models.Folder, error) {
	db := database.GetDB()

	var folder models.Folder
	err := db.Where("id = ? AND user_id = ? AND deleted_at IS NULL", folderID, userID).
		Preload("User").
		Preload("Parent").
		Preload("Children", "deleted_at IS NULL").
		Preload("Files", "deleted_at IS NULL").
		First(&folder).Error

	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, fmt.Errorf("folder not found")
	}

	return &folder, err
}

// RenameFolder renames a folder
func (fs *FolderService) RenameFolder(userID, folderID uint, newName string) error {
	db := database.GetDB()

	// Get the folder to check ownership and get parent_id
	var folder models.Folder
	if err := db.Where("id = ? AND user_id = ?", folderID, userID).First(&folder).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return fmt.Errorf("folder not found or access denied")
		}
		return fmt.Errorf("database error: %w", err)
	}

	// Check for duplicate name in the same parent
	var existingCount int64
	query := db.Model(&models.Folder{}).Where("user_id = ? AND name = ? AND id != ? AND parent_id IS NULL", userID, newName, folderID)
	if folder.ParentID != nil {
		query = db.Model(&models.Folder{}).Where("user_id = ? AND name = ? AND id != ? AND parent_id = ?", userID, newName, folderID, *folder.ParentID)
	}
	if err := query.Count(&existingCount).Error; err != nil {
		return fmt.Errorf("database error: %w", err)
	}
	if existingCount > 0 {
		return fmt.Errorf("folder with this name already exists in the specified location")
	}

	// Update the folder name
	if err := db.Model(&folder).Update("name", newName).Error; err != nil {
		return fmt.Errorf("failed to rename folder: %w", err)
	}

	return nil
}

// MoveFolder moves a folder to a new parent
func (fs *FolderService) MoveFolder(userID, folderID uint, newParentID *uint) error {
	db := database.GetDB()

	// Get the folder to check ownership
	var folder models.Folder
	if err := db.Where("id = ? AND user_id = ?", folderID, userID).First(&folder).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return fmt.Errorf("folder not found or access denied")
		}
		return fmt.Errorf("database error: %w", err)
	}

	// Prevent moving folder into itself or its children
	if newParentID != nil {
		if *newParentID == folderID {
			return fmt.Errorf("cannot move folder into itself")
		}

		// Check if new parent is a descendant of the folder being moved
		if fs.isDescendant(db, folderID, *newParentID) {
			return fmt.Errorf("cannot move folder into its own descendant")
		}

		// Validate new parent ownership
		var newParent models.Folder
		if err := db.Where("id = ? AND user_id = ?", *newParentID, userID).First(&newParent).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return fmt.Errorf("new parent folder not found or access denied")
			}
			return fmt.Errorf("database error: %w", err)
		}
	}

	// Update the parent_id
	if err := db.Model(&folder).Update("parent_id", newParentID).Error; err != nil {
		return fmt.Errorf("failed to move folder: %w", err)
	}

	return nil
}

// DeleteFolder soft deletes a folder and all its contents
func (fs *FolderService) DeleteFolder(userID, folderID uint) error {
	db := database.GetDB()

	// Get the folder to check ownership
	var folder models.Folder
	if err := db.Where("id = ? AND user_id = ?", folderID, userID).First(&folder).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return fmt.Errorf("folder not found or access denied")
		}
		return fmt.Errorf("database error: %w", err)
	}

	// Soft delete the folder (this will cascade to files via application logic)
	if err := db.Delete(&folder).Error; err != nil {
		return fmt.Errorf("failed to delete folder: %w", err)
	}

	return nil
}

// MoveFile moves a file to a different folder
func (fs *FolderService) MoveFile(userID, fileID uint, newFolderID *uint) error {
	db := database.GetDB()

	// Get the file to check ownership
	var userFile models.UserFile
	if err := db.Where("id = ? AND user_id = ?", fileID, userID).First(&userFile).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return fmt.Errorf("file not found or access denied")
		}
		return fmt.Errorf("database error: %w", err)
	}

	// Validate new folder ownership if provided
	if newFolderID != nil {
		var newFolder models.Folder
		if err := db.Where("id = ? AND user_id = ?", *newFolderID, userID).First(&newFolder).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return fmt.Errorf("target folder not found or access denied")
			}
			return fmt.Errorf("database error: %w", err)
		}
	}

	// Update the folder_id
	if err := db.Model(&userFile).Update("folder_id", newFolderID).Error; err != nil {
		return fmt.Errorf("failed to move file: %w", err)
	}

	return nil
}

// ShareFolderToRoom shares a folder to a room
func (fs *FolderService) ShareFolderToRoom(userID, folderID, roomID uint) error {
	db := database.GetDB()

	// Verify user owns the folder
	var folder models.Folder
	if err := db.Where("id = ? AND user_id = ?", folderID, userID).First(&folder).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return fmt.Errorf("folder not found or access denied")
		}
		return fmt.Errorf("database error: %w", err)
	}

	// Verify user has access to the room (is a member)
	var roomMember models.RoomMember
	if err := db.Where("room_id = ? AND user_id = ?", roomID, userID).First(&roomMember).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return fmt.Errorf("room not found or access denied")
		}
		return fmt.Errorf("database error: %w", err)
	}

	// Check if folder is already shared to this room
	var existingCount int64
	if err := db.Model(&models.RoomFolder{}).Where("room_id = ? AND folder_id = ?", roomID, folderID).Count(&existingCount).Error; err != nil {
		return fmt.Errorf("database error: %w", err)
	}
	if existingCount > 0 {
		return fmt.Errorf("folder is already shared to this room")
	}

	// Create the room_folder association
	roomFolder := &models.RoomFolder{
		RoomID:   roomID,
		FolderID: folderID,
	}

	if err := db.Create(roomFolder).Error; err != nil {
		return fmt.Errorf("failed to share folder to room: %w", err)
	}

	return nil
}

// RemoveFolderFromRoom removes a folder from a room
func (fs *FolderService) RemoveFolderFromRoom(userID, folderID, roomID uint) error {
	db := database.GetDB()

	// Verify user owns the folder
	var folder models.Folder
	if err := db.Where("id = ? AND user_id = ?", folderID, userID).First(&folder).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return fmt.Errorf("folder not found or access denied")
		}
		return fmt.Errorf("database error: %w", err)
	}

	// Verify user has access to the room
	var roomMember models.RoomMember
	if err := db.Where("room_id = ? AND user_id = ?", roomID, userID).First(&roomMember).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return fmt.Errorf("room not found or access denied")
		}
		return fmt.Errorf("database error: %w", err)
	}

	// Remove the room_folder association
	if err := db.Where("room_id = ? AND folder_id = ?", roomID, folderID).Delete(&models.RoomFolder{}).Error; err != nil {
		return fmt.Errorf("failed to remove folder from room: %w", err)
	}

	return nil
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