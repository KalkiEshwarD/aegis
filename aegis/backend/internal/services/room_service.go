package services

import (
	"errors"
	"fmt"

	"gorm.io/gorm"

	"github.com/balkanid/aegis-backend/internal/database"
	"github.com/balkanid/aegis-backend/internal/models"
)

type RoomService struct{}

func NewRoomService() *RoomService {
	return &RoomService{}
}

// CreateRoom creates a new collaborative room
func (rs *RoomService) CreateRoom(creatorID uint, name string) (*models.Room, error) {
	room := &models.Room{
		Name:      name,
		CreatorID: creatorID,
	}

	db := database.GetDB()
	if err := db.Create(room).Error; err != nil {
		return nil, fmt.Errorf("failed to create room: %w", err)
	}

	// Add creator as admin member
	member := &models.RoomMember{
		RoomID: room.ID,
		UserID: creatorID,
		Role:   models.RoomRoleAdmin,
	}

	if err := db.Create(member).Error; err != nil {
		return nil, fmt.Errorf("failed to add creator as room member: %w", err)
	}

	// Load associations
	db.Preload("Creator").First(room, room.ID)

	return room, nil
}

// GetUserRooms returns rooms where the user is a member
func (rs *RoomService) GetUserRooms(userID uint) ([]*models.Room, error) {
	db := database.GetDB()

	var rooms []*models.Room
	err := db.Joins("JOIN room_members ON rooms.id = room_members.room_id").
		Where("room_members.user_id = ?", userID).
		Preload("Creator").
		Find(&rooms).Error

	return rooms, err
}

// GetRoom returns a room with full details if user has access
func (rs *RoomService) GetRoom(roomID, userID uint) (*models.Room, error) {
	db := database.GetDB()

	// Check if user is a member of the room
	var member models.RoomMember
	if err := db.Where("room_id = ? AND user_id = ?", roomID, userID).First(&member).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("access denied: user is not a member of this room")
		}
		return nil, fmt.Errorf("database error: %w", err)
	}

	// Get room with full details
	var room models.Room
	err := db.Preload("Creator").
		Preload("Members.User").
		Preload("Files.User").
		Preload("Files.File").
		First(&room, roomID).Error

	if err != nil {
		return nil, fmt.Errorf("room not found: %w", err)
	}

	return &room, nil
}

// AddRoomMember adds a user to a room with a specific role
func (rs *RoomService) AddRoomMember(roomID, userID, requesterID uint, role models.RoomRole) error {
	db := database.GetDB()

	// Check if requester has admin privileges in the room
	if err := rs.requireRoomAdmin(roomID, requesterID); err != nil {
		return err
	}

	// Check if user already exists in the room
	var existingMember models.RoomMember
	if err := db.Where("room_id = ? AND user_id = ?", roomID, userID).First(&existingMember).Error; err == nil {
		return errors.New("user is already a member of this room")
	}

	// Add user to room
	member := &models.RoomMember{
		RoomID: roomID,
		UserID: userID,
		Role:   role,
	}

	return db.Create(member).Error
}

// RemoveRoomMember removes a user from a room
func (rs *RoomService) RemoveRoomMember(roomID, userID, requesterID uint) error {
	db := database.GetDB()

	// Check if requester has admin privileges in the room
	if err := rs.requireRoomAdmin(roomID, requesterID); err != nil {
		return err
	}

	// Don't allow removing the room creator
	var room models.Room
	if err := db.First(&room, roomID).Error; err != nil {
		return fmt.Errorf("room not found: %w", err)
	}

	if room.CreatorID == userID {
		return errors.New("cannot remove room creator")
	}

	// Remove user from room
	return db.Where("room_id = ? AND user_id = ?", roomID, userID).Delete(&models.RoomMember{}).Error
}

// ShareFileToRoom shares a user's file to a room
func (rs *RoomService) ShareFileToRoom(userFileID, roomID, userID uint) error {
	db := database.GetDB()

	// Check if user has permission to share files (admin, creator, or editor)
	if err := rs.requireRoomFilePermission(roomID, userID); err != nil {
		return err
	}

	// Verify user owns the file
	var userFile models.UserFile
	if err := db.Where("id = ? AND user_id = ?", userFileID, userID).First(&userFile).Error; err != nil {
		return fmt.Errorf("file not found or access denied: %w", err)
	}

	// Check if file is already shared to the room
	var existingShare models.RoomFile
	if err := db.Where("room_id = ? AND user_file_id = ?", roomID, userFileID).First(&existingShare).Error; err == nil {
		return errors.New("file is already shared to this room")
	}

	// Share file to room
	roomFile := &models.RoomFile{
		RoomID:     roomID,
		UserFileID: userFileID,
	}

	return db.Create(roomFile).Error
}

// RemoveFileFromRoom removes a file from a room
func (rs *RoomService) RemoveFileFromRoom(userFileID, roomID, userID uint) error {
	db := database.GetDB()

	// Check if user has permission to remove files (admin, creator, or editor)
	if err := rs.requireRoomFilePermission(roomID, userID); err != nil {
		return err
	}

	// Remove file from room
	return db.Where("room_id = ? AND user_file_id = ?", roomID, userFileID).Delete(&models.RoomFile{}).Error
}

// GetRoomFiles returns files shared in a room
func (rs *RoomService) GetRoomFiles(roomID, userID uint) ([]*models.UserFile, error) {
	db := database.GetDB()

	// Check if user is a member of the room
	var member models.RoomMember
	if err := db.Where("room_id = ? AND user_id = ?", roomID, userID).First(&member).Error; err != nil {
		return nil, errors.New("access denied: user is not a member of this room")
	}

	// Get files shared in the room
	var userFiles []*models.UserFile
	err := db.Joins("JOIN room_files ON user_files.id = room_files.user_file_id").
		Where("room_files.room_id = ?", roomID).
		Preload("User").
		Preload("File").
		Find(&userFiles).Error

	return userFiles, err
}

// requireRoomAdmin checks if user has admin privileges in the room
func (rs *RoomService) requireRoomAdmin(roomID, userID uint) error {
	db := database.GetDB()

	var member models.RoomMember
	if err := db.Where("room_id = ? AND user_id = ?", roomID, userID).First(&member).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return errors.New("access denied: user is not a member of this room")
		}
		return fmt.Errorf("database error: %w", err)
	}

	if member.Role != models.RoomRoleAdmin {
		return errors.New("access denied: admin privileges required")
	}

	return nil
}

// requireRoomFilePermission checks if user can share/remove files in the room
func (rs *RoomService) requireRoomFilePermission(roomID, userID uint) error {
	db := database.GetDB()

	var member models.RoomMember
	if err := db.Where("room_id = ? AND user_id = ?", roomID, userID).First(&member).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return errors.New("access denied: user is not a member of this room")
		}
		return fmt.Errorf("database error: %w", err)
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

	return errors.New("access denied: insufficient permissions to manage files")
}
