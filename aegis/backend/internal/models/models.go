package models

import (
	"time"

	"gorm.io/gorm"
)

// User represents a user in the system
type User struct {
	ID                   uint           `gorm:"primaryKey" json:"id"`
	Username             string         `gorm:"uniqueIndex;not null" json:"username"`
	Email                string         `gorm:"uniqueIndex;not null" json:"email"`
	PasswordHash         string         `gorm:"not null" json:"-"`
	StorageQuota         int64          `gorm:"default:10485760" json:"storage_quota"` // 10MB default
	UsedStorage          int64          `gorm:"default:0" json:"used_storage"`
	IsAdmin              bool           `json:"is_admin"`
	EnvelopeKey          string         `gorm:"not null;default:''" json:"-"` // Encrypted envelope key
	EnvelopeKeyVersion   int            `gorm:"not null;default:1;index" json:"envelope_key_version"`
	EnvelopeKeySalt      string         `gorm:"not null;default:''" json:"-"` // Salt for envelope key encryption
	EnvelopeKeyIV        string         `gorm:"not null;default:''" json:"-"` // IV for envelope key encryption
	EnvelopeKeyCreatedAt time.Time      `json:"envelope_key_created_at"`
	EnvelopeKeyUpdatedAt time.Time      `json:"envelope_key_updated_at"`
	CreatedAt            time.Time      `json:"created_at"`
	UpdatedAt            time.Time      `json:"updated_at"`
	DeletedAt            gorm.DeletedAt `gorm:"index" json:"-"`
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
	IsShared      bool           `gorm:"default:false" json:"is_shared"`
	IsStarred     bool           `gorm:"default:false" json:"is_starred"`
	ShareCount    int            `gorm:"default:0" json:"share_count"`
	CreatedAt     time.Time      `json:"created_at"`
	UpdatedAt     time.Time      `json:"updated_at"`
	DeletedAt     gorm.DeletedAt `gorm:"index" json:"-"`

	// Associations
	User   User    `gorm:"foreignKey:UserID" json:"user,omitempty"`
	File   File    `gorm:"foreignKey:FileID" json:"file,omitempty"`
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
	Creator User          `gorm:"foreignKey:CreatorID" json:"creator,omitempty"`
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
	IsStarred bool           `gorm:"default:false" json:"is_starred"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	// Associations
	User     User        `gorm:"foreignKey:UserID" json:"user,omitempty"`
	Parent   *Folder     `gorm:"foreignKey:ParentID" json:"parent,omitempty"`
	Children []*Folder   `gorm:"foreignKey:ParentID" json:"children,omitempty"`
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

// FileShare represents a password-protected file share
type FileShare struct {
	ID           uint   `gorm:"primaryKey" json:"id"`
	UserFileID   uint   `gorm:"not null;index" json:"user_file_id"`
	ShareToken   string `gorm:"uniqueIndex;not null" json:"share_token"`
	EncryptedKey string `gorm:"not null" json:"encrypted_key"` // Encrypted file encryption key
	Salt         string `gorm:"not null" json:"salt"`          // Salt used for PBKDF2
	IV           string `gorm:"not null" json:"iv"`            // Initialization vector for AES-GCM

	// Envelope Key fields for advanced encryption
	EnvelopeKey  string `gorm:"not null" json:"envelope_key"`  // Encrypted envelope key (encrypted with password)
	EnvelopeSalt string `gorm:"not null" json:"envelope_salt"` // Salt for envelope key encryption
	EnvelopeIV   string `gorm:"not null" json:"envelope_iv"`   // IV for envelope key encryption

	EncryptedPassword string `json:"encrypted_password"`  // Encrypted share password
	PasswordIV        string `json:"password_iv"`         // IV for password encryption
	PlainTextPassword string `json:"plain_text_password"` // Plain text password for display

	MaxDownloads  int        `gorm:"default:-1" json:"max_downloads"` // -1 means unlimited
	DownloadCount int        `gorm:"default:0" json:"download_count"`
	ExpiresAt     *time.Time `gorm:"index" json:"expires_at"`
	AllowedEmails string     `gorm:"type:text;not null;default:'[]'" json:"allowed_emails"`
	CreatedAt     time.Time  `json:"created_at"`
	UpdatedAt     time.Time  `json:"updated_at"`

	// Associations
	UserFile UserFile `gorm:"foreignKey:UserFileID" json:"user_file,omitempty"`
}

// ShareAccessLog tracks access attempts to shared files
type ShareAccessLog struct {
	ID            uint      `gorm:"primaryKey" json:"id"`
	FileShareID   uint      `gorm:"not null;index" json:"file_share_id"`
	IPAddress     string    `json:"ip_address"`
	UserAgent     string    `json:"user_agent"`
	AttemptedAt   time.Time `json:"attempted_at"`
	Success       bool      `gorm:"default:false" json:"success"`
	FailureReason string    `json:"failure_reason"`

	// Associations
	FileShare FileShare `gorm:"foreignKey:FileShareID" json:"file_share,omitempty"`
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

func (FileShare) TableName() string {
	return "file_shares"
}

func (ShareAccessLog) TableName() string {
	return "share_access_logs"
}

// SharedFileAccess tracks which users have successfully accessed shared files
type SharedFileAccess struct {
	ID            uint      `gorm:"primaryKey" json:"id"`
	UserID        *uint     `gorm:"index" json:"user_id"` // NULL for anonymous access
	FileShareID   uint      `gorm:"not null;index" json:"file_share_id"`
	ShareToken    string    `gorm:"not null" json:"share_token"`
	FirstAccessAt time.Time `json:"first_access_at"`
	LastAccessAt  time.Time `json:"last_access_at"`
	AccessCount   int       `gorm:"default:1" json:"access_count"`
	IPAddress     string    `json:"ip_address"`
	UserAgent     string    `json:"user_agent"`

	// Associations
	User      *User     `gorm:"foreignKey:UserID" json:"user,omitempty"`
	FileShare FileShare `gorm:"foreignKey:FileShareID" json:"file_share,omitempty"`
}

// ShareRateLimit tracks rate limiting for password attempts
type ShareRateLimit struct {
	ID             uint       `gorm:"primaryKey" json:"id"`
	Identifier     string     `gorm:"uniqueIndex;not null" json:"identifier"` // IP address or token+IP combo
	AttemptCount   int        `gorm:"default:1" json:"attempt_count"`
	FirstAttemptAt time.Time  `json:"first_attempt_at"`
	LastAttemptAt  time.Time  `json:"last_attempt_at"`
	BlockedUntil   *time.Time `gorm:"index" json:"blocked_until"`
}

func (SharedFileAccess) TableName() string {
	return "shared_file_access"
}

func (ShareRateLimit) TableName() string {
	return "share_rate_limits"
}

// KeyRotation represents an envelope key rotation operation
type KeyRotation struct {
	ID                    uint       `gorm:"primaryKey" json:"id"`
	UserID                uint       `gorm:"not null;index" json:"user_id"`
	RotationID            string     `gorm:"uniqueIndex;not null" json:"rotation_id"` // UUID for tracking
	Status                string     `gorm:"not null" json:"status"`                  // PENDING, IN_PROGRESS, COMPLETED, FAILED, ROLLED_BACK
	OldEnvelopeKeyVersion int        `gorm:"not null" json:"old_envelope_key_version"`
	NewEnvelopeKeyVersion int        `gorm:"not null" json:"new_envelope_key_version"`
	TotalFilesAffected    int        `gorm:"not null;default:0" json:"total_files_affected"`
	FilesProcessed        int        `gorm:"not null;default:0" json:"files_processed"`
	StartedAt             time.Time  `json:"started_at"`
	CompletedAt           *time.Time `json:"completed_at"`
	FailedAt              *time.Time `json:"failed_at"`
	ErrorMessage          string     `json:"error_message"`
	CreatedAt             time.Time  `json:"created_at"`
	UpdatedAt             time.Time  `json:"updated_at"`

	// Associations
	User User `gorm:"foreignKey:UserID" json:"user,omitempty"`
}

// KeyRotationBackup stores backup data for rollback operations
type KeyRotationBackup struct {
	ID               uint      `gorm:"primaryKey" json:"id"`
	RotationID       string    `gorm:"not null;index" json:"rotation_id"`
	UserFileID       uint      `gorm:"not null;index" json:"user_file_id"`
	OldEncryptionKey string    `gorm:"not null" json:"old_encryption_key"` // Backup of old encrypted file key
	OldKeyIV         string    `gorm:"not null" json:"old_key_iv"`         // Backup of old IV
	BackupCreatedAt  time.Time `json:"backup_created_at"`
	CreatedAt        time.Time `json:"created_at"`

	// Associations
	UserFile UserFile `gorm:"foreignKey:UserFileID" json:"user_file,omitempty"`
}

// TableName overrides for GORM
func (KeyRotation) TableName() string {
	return "key_rotations"
}

func (KeyRotationBackup) TableName() string {
	return "key_rotation_backups"
}
