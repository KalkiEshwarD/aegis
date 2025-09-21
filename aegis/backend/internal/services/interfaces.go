package services

import (
	"context"
	"io"
	"time"

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

// PasswordShareServiceInterface defines the contract for password-based file sharing services
type PasswordShareServiceInterface interface {
	CreateShare(userFileID uint, masterPassword string, maxDownloads int, expiresAt *time.Time) (*models.FileShare, error)
	GetShareByToken(token string) (*models.FileShare, error)
	DecryptFileKey(fileShare *models.FileShare, masterPassword string) ([]byte, error)
	IncrementDownloadCount(shareID uint) error
	DeleteShare(userID, shareID uint) error
	GetUserShares(userID uint) ([]*models.FileShare, error)
}

// ShareLinkServiceInterface defines the contract for share link generation and validation services
type ShareLinkServiceInterface interface {
	GenerateShareLink(fileShare *models.FileShare) (string, error)
	ValidateShareToken(token string) (*models.FileShare, error)
	GetShareMetadata(token string) (*ShareMetadata, error)
	IsExpired(fileShare *models.FileShare) bool
	IsDownloadLimitReached(fileShare *models.FileShare) bool
	GetRemainingDownloads(fileShare *models.FileShare) int
	GetShareExpiryInfo(fileShare *models.FileShare) *ShareExpiryInfo
}

// ShareAccessServiceInterface defines the contract for access control and rate limiting services
type ShareAccessServiceInterface interface {
	ValidateAccess(attempt *AccessAttempt) (*models.FileShare, error)
	LogSuccessfulDownload(fileShareID uint, attempt *AccessAttempt) error
	LogFailedDownload(fileShareID uint, attempt *AccessAttempt, reason string)
	IsRateLimited(ipAddress, token string) bool
	GetAccessStats(shareID uint) (*AccessStats, error)
	CleanOldLogs(maxAge time.Duration) error
	IsIPBlocked(ipAddress string) bool
}
