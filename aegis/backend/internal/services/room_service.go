package services

import (
	"errors"
	"fmt"

	apperrors "github.com/balkanid/aegis-backend/internal/errors"
	"gorm.io/gorm"

	"github.com/balkanid/aegis-backend/internal/database"
	"github.com/balkanid/aegis-backend/internal/models"
	"github.com/balkanid/aegis-backend/internal/repositories"
)

//================================================================================
// Service Definition
//================================================================================

type RoomService struct {
	*BaseService
	roomRepo *repositories.RoomRepository
}

func NewRoomService(db *database.DB) *RoomService {
	return &RoomService{
		BaseService: NewBaseService(db),
		roomRepo:    repositories.NewRoomRepository(db),
	}
}

//================================================================================
// Room Core Methods
//================================================================================

func (s *RoomService) CreateRoom(creatorID uint, name string) (*models.Room, error) {
	room := &models.Room{
		Name:      name,
		CreatorID: creatorID,
	}

	db := s.db.GetDB()
	if err := db.Create(room).Error; err != nil {
		return nil, apperrors.Wrap(err, apperrors.ErrCodeInternal, "failed to create room")
	}

	member := &models.RoomMember{
		RoomID: room.ID,
		UserID: creatorID,
		Role:   models.RoomRoleAdmin,
	}

	if err := db.Create(member).Error; err != nil {
		return nil, apperrors.Wrap(err, apperrors.ErrCodeInternal, "failed to add creator as room member")
	}

	db.Preload("Creator").First(room, room.ID)

	return room, nil
}

func (s *RoomService) GetUserRooms(userID uint) ([]*models.Room, error) {
	return s.roomRepo.GetUserRooms(userID, "Creator")
}

func (s *RoomService) GetRoom(roomID, userID uint) (*models.Room, error) {
	return s.roomRepo.GetRoomByID(roomID, userID, "Creator", "Members.User", "Files.User", "Files.File")
}

func (s *RoomService) AddRoomMember(roomID, userID, requesterID uint, role models.RoomRole) error {
	db := s.db.GetDB()

	if err := s.requireRoomAdmin(roomID, requesterID); err != nil {
		return err
	}

	var existingMember models.RoomMember
	if err := db.Where("room_id = ? AND user_id = ?", roomID, userID).First(&existingMember).Error; err == nil {
		return apperrors.New(apperrors.ErrCodeConflict, "user is already a member of this room")
	}

	member := &models.RoomMember{
		RoomID: roomID,
		UserID: userID,
		Role:   role,
	}

	return db.Create(member).Error
}

func (s *RoomService) RemoveRoomMember(roomID, userID, requesterID uint) error {
	db := s.db.GetDB()

	if err := s.requireRoomAdmin(roomID, requesterID); err != nil {
		return err
	}

	var room models.Room
	if err := db.First(&room, roomID).Error; err != nil {
		return apperrors.Wrap(err, apperrors.ErrCodeNotFound, "room not found")
	}

	if room.CreatorID == userID {
		return apperrors.New(apperrors.ErrCodeForbidden, "cannot remove room creator")
	}

	return db.Where("room_id = ? AND user_id = ?", roomID, userID).Delete(&models.RoomMember{}).Error
}

func (s *RoomService) GetRoomFiles(roomID, userID uint) ([]*models.UserFile, error) {
	return s.roomRepo.GetRoomFiles(roomID, userID, "User", "File")
}

//================================================================================
// Sharing Methods (Merged from Extensions)
//================================================================================

func (s *RoomService) ShareFileToRoom(userFileID, roomID, userID uint) error {
	var userFile models.UserFile
	if err := s.db.GetDB().First(&userFile, userFileID).Error; err != nil {
		return apperrors.Wrap(err, apperrors.ErrCodeNotFound, "file not found")
	}
	entity := UserFileEntity{UserFile: &userFile}
	return s.ShareEntityToRoom(entity, EntityTypeFile, roomID, userID, true)
}

func (s *RoomService) RemoveFileFromRoom(userFileID, roomID, userID uint) error {
	var userFile models.UserFile
	if err := s.db.GetDB().First(&userFile, userFileID).Error; err != nil {
		return apperrors.Wrap(err, apperrors.ErrCodeNotFound, "file not found")
	}
	entity := UserFileEntity{UserFile: &userFile}
	return s.RemoveEntityFromRoom(entity, EntityTypeFile, roomID, userID, true)
}

func (s *RoomService) ShareFolderToRoom(userID, folderID, roomID uint) error {
	var folder models.Folder
	if err := s.db.GetDB().First(&folder, folderID).Error; err != nil {
		return apperrors.Wrap(err, apperrors.ErrCodeNotFound, "folder not found")
	}
	entity := FolderEntity{Folder: &folder}
	return s.ShareEntityToRoom(entity, EntityTypeFolder, roomID, userID, false)
}

func (s *RoomService) RemoveFolderFromRoom(userID, folderID, roomID uint) error {
	var folder models.Folder
	if err := s.db.GetDB().First(&folder, folderID).Error; err != nil {
		return apperrors.Wrap(err, apperrors.ErrCodeNotFound, "folder not found")
	}
	entity := FolderEntity{Folder: &folder}
	return s.RemoveEntityFromRoom(entity, EntityTypeFolder, roomID, userID, false)
}

func (s *RoomService) ShareEntityToRoom(entity ShareableEntity, entityType EntityType, roomID, userID uint, requireFilePermission bool) error {
	if err := s.ValidateOwnership(entity, entity.GetID(), userID); err != nil {
		return err
	}

	if requireFilePermission {
		if err := s.requireRoomFilePermission(roomID, userID); err != nil {
			return err
		}
	} else {
		if err := s.requireRoomMembership(roomID, userID); err != nil {
			return err
		}
	}

	if err := s.checkEntityAlreadyShared(entityType, entity.GetID(), roomID); err != nil {
		return err
	}

	return s.createRoomAssociation(entityType, entity.GetID(), roomID)
}

func (s *RoomService) RemoveEntityFromRoom(entity ShareableEntity, entityType EntityType, roomID, userID uint, requireFilePermission bool) error {
	if err := s.ValidateOwnership(entity, entity.GetID(), userID); err != nil {
		return err
	}

	if requireFilePermission {
		if err := s.requireRoomFilePermission(roomID, userID); err != nil {
			return err
		}
	} else {
		if err := s.requireRoomMembership(roomID, userID); err != nil {
			return err
		}
	}

	return s.deleteRoomAssociation(entityType, entity.GetID(), roomID)
}

//================================================================================
// Internal Helpers (Merged from Extensions)
//================================================================================

func (s *RoomService) requireRoomAdmin(roomID, userID uint) error {
	return s.roomRepo.CheckRoomAdmin(roomID, userID)
}

func (s *RoomService) requireRoomMembership(roomID, userID uint) error {
	db := s.db.GetDB()
	var member models.RoomMember
	if err := db.Where("room_id = ? AND user_id = ?", roomID, userID).First(&member).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return apperrors.New(apperrors.ErrCodeForbidden, "access denied: user is not a member of this room")
		}
		return apperrors.Wrap(err, apperrors.ErrCodeInternal, "database error")
	}
	return nil
}

func (s *RoomService) requireRoomFilePermission(roomID, userID uint) error {
	db := s.db.GetDB()
	var member models.RoomMember
	if err := db.Where("room_id = ? AND user_id = ?", roomID, userID).First(&member).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return apperrors.New(apperrors.ErrCodeForbidden, "access denied: user is not a member of this room")
		}
		return apperrors.Wrap(err, apperrors.ErrCodeInternal, "database error")
	}

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

func (s *RoomService) checkEntityAlreadyShared(entityType EntityType, entityID, roomID uint) error {
	db := s.db.GetDB()
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

func (s *RoomService) createRoomAssociation(entityType EntityType, entityID, roomID uint) error {
	db := s.db.GetDB()

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

func (s *RoomService) deleteRoomAssociation(entityType EntityType, entityID, roomID uint) error {
	db := s.db.GetDB()
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

//================================================================================
// Shareable Entity Definitions (Moved from Extensions)
//================================================================================

type EntityType string

const (
	EntityTypeFile   EntityType = "file"
	EntityTypeFolder EntityType = "folder"
)

type ShareableEntity interface {
	GetID() uint
	GetUserID() uint
	GetTableName() string
}

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