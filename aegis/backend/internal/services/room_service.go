package services

import (
	apperrors "github.com/balkanid/aegis-backend/internal/errors"

	"github.com/balkanid/aegis-backend/internal/database"
	"github.com/balkanid/aegis-backend/internal/models"
	"github.com/balkanid/aegis-backend/internal/repositories"
)

type RoomService struct{
	*BaseService
	roomRepo   *repositories.RoomRepository
	extensions *RoomServiceExtensions
}

func NewRoomService(db *database.DB) *RoomService {
	return &RoomService{
		BaseService: NewBaseService(db),
		roomRepo:   repositories.NewRoomRepository(db),
		extensions:  NewRoomServiceExtensions(db),
	}
}

// CreateRoom creates a new collaborative room
func (rs *RoomService) CreateRoom(creatorID uint, name string) (*models.Room, error) {
	room := &models.Room{
		Name:      name,
		CreatorID: creatorID,
	}

	db := rs.db.GetDB()
	if err := db.Create(room).Error; err != nil {
		return nil, apperrors.Wrap(err, apperrors.ErrCodeInternal, "failed to create room")
	}

	// Add creator as admin member
	member := &models.RoomMember{
		RoomID: room.ID,
		UserID: creatorID,
		Role:   models.RoomRoleAdmin,
	}

	if err := db.Create(member).Error; err != nil {
		return nil, apperrors.Wrap(err, apperrors.ErrCodeInternal, "failed to add creator as room member")
	}

	// Load associations
	db.Preload("Creator").First(room, room.ID)

	return room, nil
}

// GetUserRooms returns rooms where the user is a member
func (rs *RoomService) GetUserRooms(userID uint) ([]*models.Room, error) {
	return rs.roomRepo.GetUserRooms(userID, "Creator")
}

// GetRoom returns a room with full details if user has access
func (rs *RoomService) GetRoom(roomID, userID uint) (*models.Room, error) {
	return rs.roomRepo.GetRoomByID(roomID, userID, "Creator", "Members.User", "Files.User", "Files.File")
}

// AddRoomMember adds a user to a room with a specific role
func (rs *RoomService) AddRoomMember(roomID, userID, requesterID uint, role models.RoomRole) error {
	db := rs.db.GetDB()

	// Check if requester has admin privileges in the room
	if err := rs.requireRoomAdmin(roomID, requesterID); err != nil {
		return err
	}

	// Check if user already exists in the room
	var existingMember models.RoomMember
	if err := db.Where("room_id = ? AND user_id = ?", roomID, userID).First(&existingMember).Error; err == nil {
		return apperrors.New(apperrors.ErrCodeConflict, "user is already a member of this room")
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
	db := rs.db.GetDB()

	// Check if requester has admin privileges in the room
	if err := rs.requireRoomAdmin(roomID, requesterID); err != nil {
		return err
	}

	// Don't allow removing the room creator
	var room models.Room
	if err := db.First(&room, roomID).Error; err != nil {
		return apperrors.Wrap(err, apperrors.ErrCodeNotFound, "room not found")
	}

	if room.CreatorID == userID {
		return apperrors.New(apperrors.ErrCodeForbidden, "cannot remove room creator")
	}

	// Remove user from room
	return db.Where("room_id = ? AND user_id = ?", roomID, userID).Delete(&models.RoomMember{}).Error
}

// ShareFileToRoom shares a user's file to a room
func (rs *RoomService) ShareFileToRoom(userFileID, roomID, userID uint) error {
	userFile := &models.UserFile{}
	entity := UserFileEntity{UserFile: userFile}

	return rs.extensions.ShareEntityToRoom(entity, EntityTypeFile, roomID, userID, true)
}

// RemoveFileFromRoom removes a file from a room
func (rs *RoomService) RemoveFileFromRoom(userFileID, roomID, userID uint) error {
	userFile := &models.UserFile{}
	entity := UserFileEntity{UserFile: userFile}

	return rs.extensions.RemoveEntityFromRoom(entity, EntityTypeFile, roomID, userID, true)
}

// GetRoomFiles returns files shared in a room
func (rs *RoomService) GetRoomFiles(roomID, userID uint) ([]*models.UserFile, error) {
	return rs.roomRepo.GetRoomFiles(roomID, userID, "User", "File")
}

// requireRoomAdmin checks if user has admin privileges in the room
func (rs *RoomService) requireRoomAdmin(roomID, userID uint) error {
	return rs.roomRepo.CheckRoomAdmin(roomID, userID)
}

