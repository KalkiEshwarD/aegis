package models

import (
	"time"

	"gorm.io/gorm"
)

// User represents a user in the system
type User struct {
	ID           uint           `gorm:"primaryKey" json:"id"`
	Email        string         `gorm:"uniqueIndex;not null" json:"email"`
	PasswordHash string         `gorm:"not null" json:"-"`
	StorageQuota int64          `gorm:"default:10485760" json:"storage_quota"` // 10MB default
	UsedStorage  int64          `gorm:"default:0" json:"used_storage"`
	IsAdmin      bool           `json:"is_admin"`
	CreatedAt    time.Time      `json:"created_at"`
	UpdatedAt    time.Time      `json:"updated_at"`
	DeletedAt    gorm.DeletedAt `gorm:"index" json:"-"`
}

// File represents a unique file content (by hash)
type File struct {
	ID          uint           `gorm:"primaryKey" json:"id"`
	ContentHash string         `gorm:"uniqueIndex;not null" json:"content_hash"` // SHA-256
	SizeBytes   int64          `gorm:"not null" json:"size_bytes"`
	StoragePath string         `gorm:"not null" json:"-"` // MinIO object key
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"-"`
}

// UserFile represents a user's file with metadata
type UserFile struct {
	ID            uint           `gorm:"primaryKey" json:"id"`
	UserID        uint           `gorm:"not null;index" json:"user_id"`
	FileID        uint           `gorm:"not null;index" json:"file_id"`
	FolderID      *uint          `gorm:"index" json:"folder_id"` // Nullable folder reference
	Filename      string         `gorm:"not null" json:"filename"`
	MimeType      string         `gorm:"not null" json:"mime_type"`
	EncryptionKey string         `gorm:"not null" json:"-"` // Encrypted symmetric key for E2EE
	CreatedAt     time.Time      `json:"created_at"`
	UpdatedAt     time.Time      `json:"updated_at"`
	DeletedAt     gorm.DeletedAt `gorm:"index" json:"-"`

	// Associations
	User   User   `gorm:"foreignKey:UserID" json:"user,omitempty"`
	File   File   `gorm:"foreignKey:FileID" json:"file,omitempty"`
	Folder *Folder `gorm:"foreignKey:FolderID" json:"folder,omitempty"`
}

// Room represents a collaborative file sharing room
type Room struct {
	ID        uint           `gorm:"primaryKey" json:"id"`
	Name      string         `gorm:"not null" json:"name"`
	CreatorID uint           `gorm:"not null;index" json:"creator_id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	// Associations
	Creator User         `gorm:"foreignKey:CreatorID" json:"creator,omitempty"`
	Members []*RoomMember `gorm:"foreignKey:RoomID" json:"members,omitempty"`
	Files   []*UserFile   `gorm:"many2many:room_files;joinForeignKey:RoomID;joinReferences:UserFileID" json:"files,omitempty"`
}

// RoomMember represents a user's membership and role in a room
type RoomMember struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	RoomID    uint      `gorm:"not null;index" json:"room_id"`
	UserID    uint      `gorm:"not null;index" json:"user_id"`
	Role      RoomRole  `gorm:"not null" json:"role"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`

	// Associations
	Room Room `gorm:"foreignKey:RoomID" json:"room,omitempty"`
	User User `gorm:"foreignKey:UserID" json:"user,omitempty"`
}

// RoomFile represents a file shared within a room
type RoomFile struct {
	ID         uint      `gorm:"primaryKey" json:"id"`
	RoomID     uint      `gorm:"not null;index" json:"room_id"`
	UserFileID uint      `gorm:"not null;index" json:"user_file_id"`
	CreatedAt  time.Time `json:"created_at"`

	// Associations
	Room     Room     `gorm:"foreignKey:RoomID" json:"room,omitempty"`
	UserFile UserFile `gorm:"foreignKey:UserFileID" json:"user_file,omitempty"`
}

// DownloadLog tracks file download events for analytics
type DownloadLog struct {
	ID               uint      `gorm:"primaryKey" json:"id"`
	UserFileID       uint      `gorm:"not null;index" json:"user_file_id"`
	DownloaderUserID uint      `gorm:"not null;index" json:"downloader_user_id"`
	Timestamp        time.Time `gorm:"not null" json:"timestamp"`

	// Associations
	UserFile       UserFile `gorm:"foreignKey:UserFileID" json:"user_file,omitempty"`
	DownloaderUser User     `gorm:"foreignKey:DownloaderUserID" json:"downloader_user,omitempty"`
}

// Folder represents a user's folder for organizing files
type Folder struct {
	ID        uint           `gorm:"primaryKey" json:"id"`
	UserID    uint           `gorm:"not null;index" json:"user_id"`
	Name      string         `gorm:"not null" json:"name"`
	ParentID  *uint          `gorm:"index" json:"parent_id"` // Nullable parent folder
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	// Associations
	User     User      `gorm:"foreignKey:UserID" json:"user,omitempty"`
	Parent   *Folder   `gorm:"foreignKey:ParentID" json:"parent,omitempty"`
	Children []*Folder `gorm:"foreignKey:ParentID" json:"children,omitempty"`
	Files    []*UserFile `gorm:"foreignKey:FolderID" json:"files,omitempty"`
}

// RoomFolder represents a folder shared within a room
type RoomFolder struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	RoomID    uint      `gorm:"not null;index" json:"room_id"`
	FolderID  uint      `gorm:"not null;index" json:"folder_id"`
	CreatedAt time.Time `json:"created_at"`

	// Associations
	Room   Room   `gorm:"foreignKey:RoomID" json:"room,omitempty"`
	Folder Folder `gorm:"foreignKey:FolderID" json:"folder,omitempty"`
}

// RoomRole defines the possible roles in a room
type RoomRole string

const (
	RoomRoleAdmin          RoomRole = "ADMIN"
	RoomRoleContentCreator RoomRole = "CONTENT_CREATOR"
	RoomRoleContentEditor  RoomRole = "CONTENT_EDITOR"
	RoomRoleContentViewer  RoomRole = "CONTENT_VIEWER"
)

func (r RoomRole) String() string {
	return string(r)
}

// TableName overrides for GORM
func (User) TableName() string {
	return "users"
}

func (File) TableName() string {
	return "files"
}

func (UserFile) TableName() string {
	return "user_files"
}

func (Room) TableName() string {
	return "rooms"
}

func (RoomMember) TableName() string {
	return "room_members"
}

func (RoomFile) TableName() string {
	return "room_files"
}

func (DownloadLog) TableName() string {
	return "download_logs"
}

func (Folder) TableName() string {
	return "folders"
}

func (RoomFolder) TableName() string {
	return "room_folders"
}
