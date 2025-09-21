package repositories

import (
	"errors"

	apperrors "github.com/balkanid/aegis-backend/internal/errors"
	"gorm.io/gorm"

	"github.com/balkanid/aegis-backend/internal/database"
	"github.com/balkanid/aegis-backend/internal/models"
)

// RoomRepository handles queries for rooms and room associations
type RoomRepository struct {
	*BaseRepository
}

// NewRoomRepository creates a new room repository
func NewRoomRepository(db *database.DB) *RoomRepository {
	return &RoomRepository{
		BaseRepository: NewBaseRepository(db),
	}
}

// GetUserRooms returns rooms where the user is a member with preloads
func (rr *RoomRepository) GetUserRooms(userID uint, preloads ...string) ([]*models.Room, error) {
	db := rr.GetDB()

	query := db.Joins("JOIN room_members ON rooms.id = room_members.room_id").
		Where("room_members.user_id = ?", userID)

	// Apply preloads
	for _, preload := range preloads {
		query = query.Preload(preload)
	}

	var rooms []*models.Room
	err := query.Find(&rooms).Error
	return rooms, err
}

// GetRoomByID returns a room with full details if user has access
func (rr *RoomRepository) GetRoomByID(roomID, userID uint, preloads ...string) (*models.Room, error) {
	db := rr.GetDB()

	// First check if user is a member of the room
	var member models.RoomMember
	if err := db.Where("room_id = ? AND user_id = ?", roomID, userID).First(&member).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, apperrors.New(apperrors.ErrCodeForbidden, "access denied: user is not a member of this room")
		}
		return nil, apperrors.Wrap(err, apperrors.ErrCodeInternal, "database error")
	}

	// Get room with full details
	query := db

	// Apply preloads
	for _, preload := range preloads {
		query = query.Preload(preload)
	}

	var room models.Room
	err := query.First(&room, roomID).Error

	if err != nil {
		return nil, apperrors.Wrap(err, apperrors.ErrCodeNotFound, "room not found")
	}

	return &room, nil
}

// CheckRoomMembership checks if user is a member of the room
func (rr *RoomRepository) CheckRoomMembership(roomID, userID uint) error {
	db := rr.GetDB()

	var member models.RoomMember
	if err := db.Where("room_id = ? AND user_id = ?", roomID, userID).First(&member).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return apperrors.New(apperrors.ErrCodeForbidden, "access denied: user is not a member of this room")
		}
		return apperrors.Wrap(err, apperrors.ErrCodeInternal, "database error")
	}

	return nil
}

// CheckRoomAdmin checks if user has admin privileges in the room
func (rr *RoomRepository) CheckRoomAdmin(roomID, userID uint) error {
	db := rr.GetDB()

	var member models.RoomMember
	if err := db.Where("room_id = ? AND user_id = ?", roomID, userID).First(&member).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return apperrors.New(apperrors.ErrCodeForbidden, "access denied: user is not a member of this room")
		}
		return apperrors.Wrap(err, apperrors.ErrCodeInternal, "database error")
	}

	if member.Role != models.RoomRoleAdmin {
		return apperrors.New(apperrors.ErrCodeForbidden, "access denied: admin privileges required")
	}

	return nil
}

// CheckRoomFilePermission checks if user can share/remove files in the room
func (rr *RoomRepository) CheckRoomFilePermission(roomID, userID uint) error {
	db := rr.GetDB()

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

// GetRoomFiles returns files shared in a room with preloads
func (rr *RoomRepository) GetRoomFiles(roomID, userID uint, preloads ...string) ([]*models.UserFile, error) {
	db := rr.GetDB()

	// Check if user is a member of the room
	if err := rr.CheckRoomMembership(roomID, userID); err != nil {
		return nil, err
	}

	// Get files shared in the room
	query := db.Joins("JOIN room_files ON user_files.id = room_files.user_file_id").
		Where("room_files.room_id = ?", roomID)

	// Apply preloads
	for _, preload := range preloads {
		query = query.Preload(preload)
	}

	var userFiles []*models.UserFile
	err := query.Find(&userFiles).Error

	return userFiles, err
}

// GetRoomFolders returns folders shared in a room with preloads
func (rr *RoomRepository) GetRoomFolders(roomID, userID uint, preloads ...string) ([]*models.Folder, error) {
	db := rr.GetDB()

	// Check if user is a member of the room
	if err := rr.CheckRoomMembership(roomID, userID); err != nil {
		return nil, err
	}

	// Get folders shared in the room
	query := db.Joins("JOIN room_folders ON folders.id = room_folders.folder_id").
		Where("room_folders.room_id = ?", roomID)

	// Apply preloads
	for _, preload := range preloads {
		query = query.Preload(preload)
	}

	var folders []*models.Folder
	err := query.Find(&folders).Error

	return folders, err
}

// CheckEntityAlreadyShared checks if the entity is already shared to the room
func (rr *RoomRepository) CheckEntityAlreadyShared(entityType string, entityID, roomID uint) error {
	db := rr.GetDB()

	var count int64
	var err error

	switch entityType {
	case "file":
		err = db.Model(&models.RoomFile{}).Where("room_id = ? AND user_file_id = ?", roomID, entityID).Count(&count).Error
	case "folder":
		err = db.Model(&models.RoomFolder{}).Where("room_id = ? AND folder_id = ?", roomID, entityID).Count(&count).Error
	default:
		return apperrors.New(apperrors.ErrCodeInvalidArgument, "invalid entity type")
	}

	if err != nil {
		return apperrors.Wrap(err, apperrors.ErrCodeInternal, "database error")
	}

	if count > 0 {
		return apperrors.New(apperrors.ErrCodeConflict, entityType+" is already shared to this room")
	}

	return nil
}

// CreateRoomAssociation creates the appropriate room association
func (rr *RoomRepository) CreateRoomAssociation(entityType string, entityID, roomID uint) error {
	db := rr.GetDB()

	switch entityType {
	case "file":
		roomFile := &models.RoomFile{
			RoomID:     roomID,
			UserFileID: entityID,
		}
		if err := db.Create(roomFile).Error; err != nil {
			return apperrors.Wrap(err, apperrors.ErrCodeInternal, "failed to share file to room")
		}
	case "folder":
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

// DeleteRoomAssociation removes the appropriate room association
func (rr *RoomRepository) DeleteRoomAssociation(entityType string, entityID, roomID uint) error {
	db := rr.GetDB()

	var err error

	switch entityType {
	case "file":
		err = db.Where("room_id = ? AND user_file_id = ?", roomID, entityID).Delete(&models.RoomFile{}).Error
	case "folder":
		err = db.Where("room_id = ? AND folder_id = ?", roomID, entityID).Delete(&models.RoomFolder{}).Error
	default:
		return apperrors.New(apperrors.ErrCodeInvalidArgument, "invalid entity type")
	}

	if err != nil {
		return apperrors.Wrap(err, apperrors.ErrCodeInternal, "failed to remove "+entityType+" from room")
	}

	return nil
}
