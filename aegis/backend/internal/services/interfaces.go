package services

import (
	"context"
	"io"

	"github.com/balkanid/aegis-backend/internal/models"
	"github.com/minio/minio-go/v7"
)

// AuthServiceInterface defines the contract for authentication services
type AuthServiceInterface interface {
	GenerateToken(user *models.User) (string, error)
	ParseToken(tokenString string) (*Claims, error)
}

// UserServiceInterface defines the contract for user management services
type UserServiceInterface interface {
	Register(username, email, password string) (*models.User, string, error)
	Login(identifier, password string) (*models.User, string, error)
	GetUserStats(userID uint) (*UserStats, error)
	UpdateStorageUsage(userID uint, deltaBytes int64) error
	CheckStorageQuota(userID uint, additionalBytes int64) error
	PromoteToAdmin(userID uint) error
	DeleteUser(userID uint) error
	GetAllUsers() ([]*models.User, error)
}

// RoomServiceInterface defines the contract for room management services
type RoomServiceInterface interface {
	CreateRoom(creatorID uint, name string) (*models.Room, error)
	GetUserRooms(userID uint) ([]*models.Room, error)
	GetRoom(roomID, userID uint) (*models.Room, error)
	AddRoomMember(roomID, userID, requesterID uint, role models.RoomRole) error
	RemoveRoomMember(roomID, userID, requesterID uint) error
	ShareFileToRoom(userFileID, roomID, userID uint) error
	RemoveFileFromRoom(userFileID, roomID, userID uint) error
	GetRoomFiles(roomID, userID uint) ([]*models.UserFile, error)
}

// FolderServiceInterface defines the contract for folder management services
type FolderServiceInterface interface {
	CreateFolder(userID uint, name string, parentID *uint) (*models.Folder, error)
	GetUserFolders(userID uint) ([]*models.Folder, error)
	GetFolder(userID, folderID uint) (*models.Folder, error)
	RenameFolder(userID, folderID uint, newName string) error
	MoveFolder(userID, folderID uint, newParentID *uint) error
	DeleteFolder(userID, folderID uint) error
	MoveFile(userID, fileID uint, newFolderID *uint) error
	ShareFolderToRoom(userID, folderID, roomID uint) error
	RemoveFolderFromRoom(userID, folderID, roomID uint) error
}

// FileServiceInterface defines the contract for file operations and storage services
type FileServiceInterface interface {
	// File Operations
	MoveFile(userID, fileID uint, newFolderID *uint) error

	// File Storage
	UploadFile(ctx context.Context, objectName string, reader io.Reader, objectSize int64, contentType string) error
	DownloadFile(ctx context.Context, objectName string) (*minio.Object, error)
	DeleteFile(ctx context.Context, objectName string) error
}