package services

import (
	"errors"
	"fmt"

	apperrors "github.com/balkanid/aegis-backend/internal/errors"
	"gorm.io/gorm"

	"github.com/balkanid/aegis-backend/internal/database"
	"github.com/balkanid/aegis-backend/internal/models"
)

// EntityType represents the type of entity being shared
type EntityType string

const (
	EntityTypeFile   EntityType = "file"
	EntityTypeFolder EntityType = "folder"
)

// ShareableEntity interface for entities that can be shared to rooms
type ShareableEntity interface {
	GetID() uint
	GetUserID() uint
	GetTableName() string
}

// UserFileEntity wraps UserFile to implement ShareableEntity
type UserFileEntity struct {
	*models.UserFile
}

func (u UserFileEntity) GetID() uint {
	return u.ID
}

func (u UserFileEntity) GetUserID() uint {
	return u.UserID
}

func (u UserFileEntity) GetTableName() string {
	return "user_files"
}

// FolderEntity wraps Folder to implement ShareableEntity
type FolderEntity struct {
	*models.Folder
}

func (f FolderEntity) GetID() uint {
	return f.ID
}

func (f FolderEntity) GetUserID() uint {
	return f.UserID
}

func (f FolderEntity) GetTableName() string {
	return "folders"
}

// RoomServiceExtensions provides generic methods for sharing entities to rooms
type RoomServiceExtensions struct {
	*BaseService
}

// NewRoomServiceExtensions creates a new RoomServiceExtensions instance
func NewRoomServiceExtensions(db *database.DB) *RoomServiceExtensions {
	return &RoomServiceExtensions{
		BaseService: NewBaseService(db),
	}
}

// ShareEntityToRoom shares a file or folder to a room with proper validation
func (rse *RoomServiceExtensions) ShareEntityToRoom(entity ShareableEntity, entityType EntityType, roomID, userID uint, requireFilePermission bool) error {
	// Validate entity ownership
	if err := rse.ValidateOwnership(entity, entity.GetID(), userID); err != nil {
		return err
	}

	// Check room membership and permissions
	if requireFilePermission {
		if err := rse.requireRoomFilePermission(roomID, userID); err != nil {
			return err
		}
	} else {
		if err := rse.requireRoomMembership(roomID, userID); err != nil {
			return err
		}
	}

	// Check if entity is already shared to the room
	if err := rse.checkEntityAlreadyShared(entityType, entity.GetID(), roomID); err != nil {
		return err
	}

	// Create the room association
	if err := rse.createRoomAssociation(entityType, entity.GetID(), roomID); err != nil {
		return err
	}

	return nil
}

// RemoveEntityFromRoom removes a file or folder from a room
func (rse *RoomServiceExtensions) RemoveEntityFromRoom(entity ShareableEntity, entityType EntityType, roomID, userID uint, requireFilePermission bool) error {
	// Validate entity ownership
	if err := rse.ValidateOwnership(entity, entity.GetID(), userID); err != nil {
		return err
	}

	// Check room membership and permissions
	if requireFilePermission {
		if err := rse.requireRoomFilePermission(roomID, userID); err != nil {
			return err
		}
	} else {
		if err := rse.requireRoomMembership(roomID, userID); err != nil {
			return err
		}
	}

	// Remove the room association
	if err := rse.deleteRoomAssociation(entityType, entity.GetID(), roomID); err != nil {
		return err
	}

	return nil
}

// requireRoomMembership checks if user is a member of the room
func (rse *RoomServiceExtensions) requireRoomMembership(roomID, userID uint) error {
	db := rse.db.GetDB()

	var member models.RoomMember
	if err := db.Where("room_id = ? AND user_id = ?", roomID, userID).First(&member).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return apperrors.New(apperrors.ErrCodeForbidden, "access denied: user is not a member of this room")
		}
		return apperrors.Wrap(err, apperrors.ErrCodeInternal, "database error")
	}

	return nil
}

// requireRoomFilePermission checks if user can share/remove files in the room
func (rse *RoomServiceExtensions) requireRoomFilePermission(roomID, userID uint) error {
	db := rse.db.GetDB()

	var member models.RoomMember
	if err := db.Where("room_id = ? AND user_id = ?", roomID, userID).First(&member).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return apperrors.New(apperrors.ErrCodeForbidden, "access denied: user is not a member of this room")
		}
		return apperrors.Wrap(err, apperrors.ErrCodeInternal, "database error")
	}

	// Allow admin, content creator, and content editor to share/remove files
	allowedRoles := []models.RoomRole{
		models.RoomRoleAdmin,
		models.RoomRoleContentCreator,
		models.RoomRoleContentEditor,
	}

	for _, role := range allowedRoles {
		if member.Role == role {
			return nil
		}
	}

	return apperrors.New(apperrors.ErrCodeForbidden, "access denied: insufficient permissions to manage files")
}

// checkEntityAlreadyShared checks if the entity is already shared to the room
func (rse *RoomServiceExtensions) checkEntityAlreadyShared(entityType EntityType, entityID, roomID uint) error {
	db := rse.db.GetDB()

	var count int64
	var err error

	switch entityType {
	case EntityTypeFile:
		err = db.Model(&models.RoomFile{}).Where("room_id = ? AND user_file_id = ?", roomID, entityID).Count(&count).Error
	case EntityTypeFolder:
		err = db.Model(&models.RoomFolder{}).Where("room_id = ? AND folder_id = ?", roomID, entityID).Count(&count).Error
	default:
		return apperrors.New(apperrors.ErrCodeInvalidArgument, "invalid entity type")
	}

	if err != nil {
		return apperrors.Wrap(err, apperrors.ErrCodeInternal, "database error")
	}

	if count > 0 {
		return apperrors.New(apperrors.ErrCodeConflict, fmt.Sprintf("%s is already shared to this room", entityType))
	}

	return nil
}

// createRoomAssociation creates the appropriate room association
func (rse *RoomServiceExtensions) createRoomAssociation(entityType EntityType, entityID, roomID uint) error {
	db := rse.db.GetDB()

	switch entityType {
	case EntityTypeFile:
		roomFile := &models.RoomFile{
			RoomID:     roomID,
			UserFileID: entityID,
		}
		if err := db.Create(roomFile).Error; err != nil {
			return apperrors.Wrap(err, apperrors.ErrCodeInternal, "failed to share file to room")
		}
	case EntityTypeFolder:
		roomFolder := &models.RoomFolder{
			RoomID:   roomID,
			FolderID: entityID,
		}
		if err := db.Create(roomFolder).Error; err != nil {
			return apperrors.Wrap(err, apperrors.ErrCodeInternal, "failed to share folder to room")
		}
	default:
		return apperrors.New(apperrors.ErrCodeInvalidArgument, "invalid entity type")
	}

	return nil
}

// deleteRoomAssociation removes the appropriate room association
func (rse *RoomServiceExtensions) deleteRoomAssociation(entityType EntityType, entityID, roomID uint) error {
	db := rse.db.GetDB()

	var err error

	switch entityType {
	case EntityTypeFile:
		err = db.Where("room_id = ? AND user_file_id = ?", roomID, entityID).Delete(&models.RoomFile{}).Error
	case EntityTypeFolder:
		err = db.Where("room_id = ? AND folder_id = ?", roomID, entityID).Delete(&models.RoomFolder{}).Error
	default:
		return apperrors.New(apperrors.ErrCodeInvalidArgument, "invalid entity type")
	}

	if err != nil {
		return apperrors.Wrap(err, apperrors.ErrCodeInternal, fmt.Sprintf("failed to remove %s from room", entityType))
	}

	return nil
}