package integration

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"time"

	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"

	"github.com/balkanid/aegis-backend/internal/models"
)

// CreateTestUser creates a test user with the given parameters
func CreateTestUser(db *gorm.DB, email, password string, isAdmin bool) (*models.User, error) {
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return nil, fmt.Errorf("failed to hash password: %w", err)
	}

	user := &models.User{
		Email:        email,
		PasswordHash: string(hashedPassword),
		StorageQuota: 104857600, // 100MB for tests
		UsedStorage:  0,
		IsAdmin:      isAdmin,
		CreatedAt:    time.Now(),
		UpdatedAt:    time.Now(),
	}

	if err := db.Create(user).Error; err != nil {
		return nil, fmt.Errorf("failed to create test user: %w", err)
	}

	// Ensure IsAdmin is set correctly after creation
	user.IsAdmin = isAdmin

	return user, nil
}

// CreateTestFile creates a test file with the given content hash and size
func CreateTestFile(db *gorm.DB, contentHash string, sizeBytes int64, storagePath string) (*models.File, error) {
	file := &models.File{
		ContentHash: contentHash,
		SizeBytes:   sizeBytes,
		StoragePath: storagePath,
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}

	if err := db.Create(file).Error; err != nil {
		return nil, fmt.Errorf("failed to create test file: %w", err)
	}

	return file, nil
}

// CreateTestUserFile creates a test user file linking a user to a file
func CreateTestUserFile(db *gorm.DB, userID, fileID uint, filename, mimeType, encryptionKey string) (*models.UserFile, error) {
	userFile := &models.UserFile{
		UserID:        userID,
		FileID:        fileID,
		Filename:      filename,
		MimeType:      mimeType,
		EncryptionKey: encryptionKey,
		CreatedAt:     time.Now(),
		UpdatedAt:     time.Now(),
	}

	if err := db.Create(userFile).Error; err != nil {
		return nil, fmt.Errorf("failed to create test user file: %w", err)
	}

	return userFile, nil
}

// CreateTestRoom creates a test room
func CreateTestRoom(db *gorm.DB, name string, creatorID uint) (*models.Room, error) {
	room := &models.Room{
		Name:      name,
		CreatorID: creatorID,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	if err := db.Create(room).Error; err != nil {
		return nil, fmt.Errorf("failed to create test room: %w", err)
	}

	return room, nil
}

// CreateTestRoomMember creates a test room member
func CreateTestRoomMember(db *gorm.DB, roomID, userID uint, role models.RoomRole) (*models.RoomMember, error) {
	roomMember := &models.RoomMember{
		RoomID:    roomID,
		UserID:    userID,
		Role:      role,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	if err := db.Create(roomMember).Error; err != nil {
		return nil, fmt.Errorf("failed to create test room member: %w", err)
	}

	return roomMember, nil
}

// CreateTestRoomFile creates a test room file
func CreateTestRoomFile(db *gorm.DB, roomID, userFileID uint) (*models.RoomFile, error) {
	roomFile := &models.RoomFile{
		RoomID:     roomID,
		UserFileID: userFileID,
		CreatedAt:  time.Now(),
	}

	if err := db.Create(roomFile).Error; err != nil {
		return nil, fmt.Errorf("failed to create test room file: %w", err)
	}

	return roomFile, nil
}

// CreateTestDownloadLog creates a test download log entry
func CreateTestDownloadLog(db *gorm.DB, userFileID, downloaderUserID uint) (*models.DownloadLog, error) {
	downloadLog := &models.DownloadLog{
		UserFileID:       userFileID,
		DownloaderUserID: downloaderUserID,
		Timestamp:        time.Now(),
	}

	if err := db.Create(downloadLog).Error; err != nil {
		return nil, fmt.Errorf("failed to create test download log: %w", err)
	}

	return downloadLog, nil
}

// GenerateTestContentHash generates a SHA-256 hash for test content
func GenerateTestContentHash(content string) string {
	hash := sha256.Sum256([]byte(content))
	return hex.EncodeToString(hash[:])
}

// SetupBasicTestData creates a basic set of test data for integration tests
func SetupBasicTestData(db *gorm.DB) (*TestData, error) {
	// Create test users
	adminUser, err := CreateTestUser(db, "admin@test.com", "password123", true)
	if err != nil {
		return nil, fmt.Errorf("failed to create admin user: %w", err)
	}

	regularUser, err := CreateTestUser(db, "user@test.com", "password123", false)
	if err != nil {
		return nil, fmt.Errorf("failed to create regular user: %w", err)
	}

	anotherUser, err := CreateTestUser(db, "user2@test.com", "password123", false)
	if err != nil {
		return nil, fmt.Errorf("failed to create another user: %w", err)
	}

	// Create test files
	testContent := "This is test file content"
	contentHash := GenerateTestContentHash(testContent)

	file1, err := CreateTestFile(db, contentHash, int64(len(testContent)), "/test/path/file1.txt")
	if err != nil {
		return nil, fmt.Errorf("failed to create test file 1: %w", err)
	}

	file2, err := CreateTestFile(db, GenerateTestContentHash("Different content"), 100, "/test/path/file2.txt")
	if err != nil {
		return nil, fmt.Errorf("failed to create test file 2: %w", err)
	}

	// Create user files
	userFile1, err := CreateTestUserFile(db, regularUser.ID, file1.ID, "testfile.txt", "text/plain", "encrypted_key_1")
	if err != nil {
		return nil, fmt.Errorf("failed to create user file 1: %w", err)
	}

	userFile2, err := CreateTestUserFile(db, regularUser.ID, file2.ID, "document.pdf", "application/pdf", "encrypted_key_2")
	if err != nil {
		return nil, fmt.Errorf("failed to create user file 2: %w", err)
	}

	// Create test room
	room, err := CreateTestRoom(db, "Test Room", adminUser.ID)
	if err != nil {
		return nil, fmt.Errorf("failed to create test room: %w", err)
	}

	// Add room members
	_, err = CreateTestRoomMember(db, room.ID, adminUser.ID, models.RoomRoleAdmin)
	if err != nil {
		return nil, fmt.Errorf("failed to create admin room member: %w", err)
	}

	_, err = CreateTestRoomMember(db, room.ID, regularUser.ID, models.RoomRoleContentCreator)
	if err != nil {
		return nil, fmt.Errorf("failed to create regular user room member: %w", err)
	}

	// Add file to room
	_, err = CreateTestRoomFile(db, room.ID, userFile1.ID)
	if err != nil {
		return nil, fmt.Errorf("failed to create room file: %w", err)
	}

	return &TestData{
		AdminUser:    adminUser,
		RegularUser:  regularUser,
		AnotherUser:  anotherUser,
		File1:        file1,
		File2:        file2,
		UserFile1:    userFile1,
		UserFile2:    userFile2,
		Room:         room,
	}, nil
}

// TestData holds references to all created test data
type TestData struct {
	AdminUser    *models.User
	RegularUser  *models.User
	AnotherUser  *models.User
	File1        *models.File
	File2        *models.File
	UserFile1    *models.UserFile
	UserFile2    *models.UserFile
	Room         *models.Room
}