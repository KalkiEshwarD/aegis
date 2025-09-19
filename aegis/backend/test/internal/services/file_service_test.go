package services_test

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"log"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/suite"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"

	"github.com/balkanid/aegis-backend/internal/config"
	"github.com/balkanid/aegis-backend/internal/database"
	"github.com/balkanid/aegis-backend/internal/models"
	"github.com/balkanid/aegis-backend/internal/services"
)

type StorageServiceTestSuite struct {
	suite.Suite
	db             *gorm.DB
	storageService *services.StorageService
	testUser       models.User
	testFile       models.File
	testUserFile   models.UserFile
}

func (suite *StorageServiceTestSuite) SetupSuite() {
	// Create in-memory SQLite database for testing
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	suite.Require().NoError(err)

	suite.db = db

	// Set the database connection for the database package
	database.SetDB(db)

	// Run migrations
	err = db.AutoMigrate(
		&models.User{},
		&models.File{},
		&models.UserFile{},
		&models.Room{},
		&models.RoomMember{},
		&models.RoomFile{},
		&models.DownloadLog{},
	)
	suite.Require().NoError(err)

	// Create test configuration (without MinIO for unit tests)
	cfg := &config.Config{
		BaseURL:        "http://localhost:8080",
		MinIOEndpoint:  "", // Empty to disable MinIO
		MinIOAccessKey: "",
		MinIOSecretKey: "",
		MinIOBucket:    "",
	}

	// Create database service
	dbService := database.NewDB(db)

	// Create file storage service (will be nil/disabled for tests)
	fileStorageService := services.NewFileStorageService(nil, "")

	suite.storageService = services.NewStorageService(cfg, dbService, fileStorageService)
}

func (suite *StorageServiceTestSuite) TearDownSuite() {
	if suite.db != nil {
		sqlDB, _ := suite.db.DB()
		sqlDB.Close()
	}
}

func (suite *StorageServiceTestSuite) SetupTest() {
	// Clean database before each test
	suite.db.Exec("DELETE FROM download_logs")
	suite.db.Exec("DELETE FROM room_files")
	suite.db.Exec("DELETE FROM room_members")
	suite.db.Exec("DELETE FROM user_files")
	suite.db.Exec("DELETE FROM rooms")
	suite.db.Exec("DELETE FROM files")
	suite.db.Exec("DELETE FROM users")

	// Create test user
	suite.testUser = models.User{
		Username:     "testuser",
		Email:        "test@example.com",
		PasswordHash: "hash",
		StorageQuota: 10485760, // 10MB
		UsedStorage:  0,
		IsAdmin:      false,
	}
	err := suite.db.Create(&suite.testUser).Error
	suite.Require().NoError(err)

	// Create test file
	suite.testFile = models.File{
		ContentHash: "test_hash_123",
		SizeBytes:   1024,
		StoragePath: "/mock/path/test_file.txt",
	}
	err = suite.db.Create(&suite.testFile).Error
	suite.Require().NoError(err)

	// Create test user file
	suite.testUserFile = models.UserFile{
		UserID:        suite.testUser.ID,
		FileID:        suite.testFile.ID,
		Filename:      "test_file.txt",
		MimeType:      "text/plain",
		EncryptionKey: "test_encryption_key",
	}
	err = suite.db.Create(&suite.testUserFile).Error
	suite.Require().NoError(err)
}

func (suite *StorageServiceTestSuite) TestNewFileService() {
	cfg := &config.Config{}
	service := services.NewStorageService(cfg, database.NewDB(suite.db), services.NewFileStorageService(nil, ""))
	assert.NotNil(suite.T(), service)
}

func (suite *StorageServiceTestSuite) TestNewFileService_WithMinIO() {
	cfg := &config.Config{
		MinIOEndpoint:  "localhost:9000",
		MinIOAccessKey: "test_key",
		MinIOSecretKey: "test_secret",
		MinIOBucket:    "test_bucket",
	}
	// Skip this test as MinIO connection will fail in test environment
	suite.T().Skip("Skipping MinIO test - MinIO not available in test environment")
	service := services.NewStorageService(cfg, database.NewDB(suite.db), services.NewFileStorageService(nil, ""))
	assert.NotNil(suite.T(), service)
}

func (suite *StorageServiceTestSuite) TestUploadFileFromMap_Success() {
	data := map[string]interface{}{
		"filename":      "test_upload.txt",
		"mime_type":     "text/plain",
		"size_bytes":    float64(512),
		"content_hash":  "unique_hash_456",
		"encrypted_key": "encryption_key_123",
		"file_data":     []byte("test file content"),
	}

	userFile, err := suite.storageService.UploadFileFromMap(suite.testUser.ID, data)

	assert.NoError(suite.T(), err)
	assert.NotNil(suite.T(), userFile)
	assert.Equal(suite.T(), "test_upload.txt", userFile.Filename)
	assert.Equal(suite.T(), "text/plain", userFile.MimeType)
	assert.Equal(suite.T(), int64(512), userFile.File.SizeBytes)
}

func (suite *StorageServiceTestSuite) TestUploadFileFromMap_InvalidData() {
	// Test with missing required fields
	data := map[string]interface{}{
		"filename": "test.txt",
		// Missing other required fields
	}

	userFile, err := suite.storageService.UploadFileFromMap(suite.testUser.ID, data)

	assert.Error(suite.T(), err)
	assert.Nil(suite.T(), userFile)
	assert.Contains(suite.T(), err.Error(), "file data is required")
}

func (suite *StorageServiceTestSuite) TestUploadFileFromMap_TypeMismatch() {
	data := map[string]interface{}{
		"id":            123,            // Should be string
		"size":          "not-a-number", // Should be number
		"filename":      nil,            // Should be string
		"mime_type":     "text/plain",
		"content_hash":  "hash",
		"encrypted_key": "key",
		"file_data":     []byte("content"),
	}

	userFile, err := suite.storageService.UploadFileFromMap(suite.testUser.ID, data)

	// The service doesn't validate filename being nil, so it should succeed
	assert.NoError(suite.T(), err)
	assert.NotNil(suite.T(), userFile)
}

func (suite *StorageServiceTestSuite) TestUploadFile_Success() {
	fileContent := "test file content for upload"
	reader := strings.NewReader(fileContent)

	userFile, err := suite.storageService.UploadFile(
		suite.testUser.ID,
		"new_file.txt",
		"text/plain",
		"new_unique_hash",
		"new_encryption_key",
		reader,
		int64(len(fileContent)),
		nil, // folderID
	)

	assert.NoError(suite.T(), err)
	assert.NotNil(suite.T(), userFile)
	assert.Equal(suite.T(), "new_file.txt", userFile.Filename)
	assert.Equal(suite.T(), "text/plain", userFile.MimeType)
	assert.Equal(suite.T(), int64(len(fileContent)), userFile.File.SizeBytes)
}

func (suite *StorageServiceTestSuite) TestUploadFile_ReuploadAfterDelete() {
	// First upload
	fileContent := "content for reupload test"
	reader1 := strings.NewReader(fileContent)

	userFile1, err := suite.storageService.UploadFile(
		suite.testUser.ID,
		"reupload_test.txt",
		"text/plain",
		"reupload_hash",
		"key1",
		reader1,
		int64(len(fileContent)),
		nil, // folderID
	)
	assert.NoError(suite.T(), err)

	// Delete the file
	err = suite.storageService.DeleteFile(suite.testUser.ID, userFile1.ID)
	assert.NoError(suite.T(), err)

	// Verify user file is soft-deleted (not the file record itself)
	var deletedUserFile models.UserFile
	err = suite.db.Unscoped().Where("id = ?", userFile1.ID).First(&deletedUserFile).Error
	assert.NoError(suite.T(), err)
	assert.True(suite.T(), deletedUserFile.DeletedAt.Valid)

	// Verify file record still exists (not soft deleted)
	var file models.File
	err = suite.db.Where("id = ?", userFile1.FileID).First(&file).Error
	assert.NoError(suite.T(), err)
	assert.False(suite.T(), file.DeletedAt.Valid)

	// Try to upload the same file again
	reader2 := strings.NewReader(fileContent)
	userFile2, err := suite.storageService.UploadFile(
		suite.testUser.ID,
		"reupload_test_v2.txt", // Different filename
		"text/plain",
		"reupload_hash", // Same hash
		"key2",
		reader2,
		int64(len(fileContent)),
		nil, // folderID
	)
	assert.NoError(suite.T(), err)

	// Should reuse the same FileID (deduplication)
	assert.Equal(suite.T(), userFile1.FileID, userFile2.FileID)
	assert.NotEqual(suite.T(), userFile1.ID, userFile2.ID)
	assert.Equal(suite.T(), "reupload_test_v2.txt", userFile2.Filename)

	// Verify file is restored (not soft-deleted anymore)
	var restoredFile models.File
	err = suite.db.Where("id = ?", userFile1.FileID).First(&restoredFile).Error
	assert.NoError(suite.T(), err)
	assert.False(suite.T(), restoredFile.DeletedAt.Valid)
}

func (suite *StorageServiceTestSuite) TestUploadFile_EmptyFile() {
	reader := strings.NewReader("")

	userFile, err := suite.storageService.UploadFile(
		suite.testUser.ID,
		"empty.txt",
		"text/plain",
		"empty_hash",
		"key",
		reader,
		0,
		nil, // folderID
	)

	assert.NoError(suite.T(), err)
	assert.NotNil(suite.T(), userFile)
	assert.Equal(suite.T(), int64(0), userFile.File.SizeBytes)
}

func (suite *StorageServiceTestSuite) TestUploadFile_SpecialCharactersInFilename() {
	specialFilename := "file with spaces & special chars (test).txt"
	reader := strings.NewReader("content")

	userFile, err := suite.storageService.UploadFile(
		suite.testUser.ID,
		specialFilename,
		"text/plain",
		"special_hash",
		"key",
		reader,
		int64(len("content")),
		nil, // folderID
	)

	assert.NoError(suite.T(), err)
	assert.NotNil(suite.T(), userFile)
	assert.Equal(suite.T(), specialFilename, userFile.Filename)
}

func (suite *StorageServiceTestSuite) TestUploadFile_InvalidUserID() {
	reader := strings.NewReader("content")

	userFile, err := suite.storageService.UploadFile(
		99999, // Non-existent user ID
		"test.txt",
		"text/plain",
		"hash",
		"key",
		reader,
		int64(len("content")),
		nil, // folderID
	)

	// This should still succeed as we don't validate user existence in upload
	// User validation should happen at the handler level
	assert.NoError(suite.T(), err)
	assert.NotNil(suite.T(), userFile)
}

func (suite *StorageServiceTestSuite) TestGetUserFiles_NoFiles() {
	// Create a new user with no files
	newUser := models.User{
		Username:     "emptyuser",
		Email:        "empty@example.com",
		PasswordHash: "hash",
		StorageQuota: 10485760,
		UsedStorage:  0,
		IsAdmin:      false,
	}
	err := suite.db.Create(&newUser).Error
	suite.Require().NoError(err)

	files, err := suite.storageService.GetUserFiles(newUser.ID, nil)

	assert.NoError(suite.T(), err)
	assert.Empty(suite.T(), files)
}

func (suite *StorageServiceTestSuite) TestGetUserFiles_WithFiles() {
	files, err := suite.storageService.GetUserFiles(suite.testUser.ID, nil)

	assert.NoError(suite.T(), err)
	assert.Len(suite.T(), files, 1)
	assert.Equal(suite.T(), suite.testUserFile.Filename, files[0].Filename)
	assert.Equal(suite.T(), suite.testUserFile.MimeType, files[0].MimeType)
}

func (suite *StorageServiceTestSuite) TestGetUserFiles_WithFilenameFilter() {
	filter := &services.FileFilter{
		Filename: stringPtr("test_file"),
	}

	files, err := suite.storageService.GetUserFiles(suite.testUser.ID, filter)

	assert.NoError(suite.T(), err)
	assert.Len(suite.T(), files, 1)
	assert.Equal(suite.T(), suite.testUserFile.Filename, files[0].Filename)
}

func (suite *StorageServiceTestSuite) TestGetUserFiles_WithMimeTypeFilter() {
	filter := &services.FileFilter{
		MimeType: stringPtr("text/plain"),
	}

	files, err := suite.storageService.GetUserFiles(suite.testUser.ID, filter)

	assert.NoError(suite.T(), err)
	assert.Len(suite.T(), files, 1)
	assert.Equal(suite.T(), suite.testUserFile.MimeType, files[0].MimeType)
}

func (suite *StorageServiceTestSuite) TestGetUserFiles_WithSizeFilter() {
	filter := &services.FileFilter{
		MinSize: int64Ptr(512),
		MaxSize: int64Ptr(2048),
	}

	files, err := suite.storageService.GetUserFiles(suite.testUser.ID, filter)

	assert.NoError(suite.T(), err)
	assert.Len(suite.T(), files, 1)
	assert.Equal(suite.T(), suite.testFile.SizeBytes, files[0].File.SizeBytes)
}

func (suite *StorageServiceTestSuite) TestGetUserFiles_WithDateFilter() {
	now := time.Now()
	dateFrom := interface{}(now.Add(-time.Hour))
	dateTo := interface{}(now.Add(time.Hour))
	filter := &services.FileFilter{
		DateFrom: &dateFrom,
		DateTo:   &dateTo,
	}

	files, err := suite.storageService.GetUserFiles(suite.testUser.ID, filter)

	assert.NoError(suite.T(), err)
	assert.Len(suite.T(), files, 1)
}

func (suite *StorageServiceTestSuite) TestGetUserFiles_FilterNoMatches() {
	filter := &services.FileFilter{
		Filename: stringPtr("nonexistent"),
	}

	files, err := suite.storageService.GetUserFiles(suite.testUser.ID, filter)

	assert.NoError(suite.T(), err)
	assert.Empty(suite.T(), files)
}

func (suite *StorageServiceTestSuite) TestDeleteFile_Success() {
	err := suite.storageService.DeleteFile(suite.testUser.ID, suite.testUserFile.ID)

	assert.NoError(suite.T(), err)

	// Verify user file is deleted
	var deletedUserFile models.UserFile
	err = suite.db.Where("id = ?", suite.testUserFile.ID).First(&deletedUserFile).Error
	assert.Error(suite.T(), err)
	assert.True(suite.T(), errors.Is(err, gorm.ErrRecordNotFound))
}

func (suite *StorageServiceTestSuite) TestDeleteFile_FileNotFound() {
	err := suite.storageService.DeleteFile(suite.testUser.ID, 99999)

	assert.Error(suite.T(), err)
	assert.Contains(suite.T(), err.Error(), "file not found")
}

func (suite *StorageServiceTestSuite) TestDeleteFile_WrongUser() {
	// Create another user
	otherUser := models.User{
		Username:     "otheruser",
		Email:        "other@example.com",
		PasswordHash: "hash",
		StorageQuota: 10485760,
		UsedStorage:  0,
		IsAdmin:      false,
	}
	err := suite.db.Create(&otherUser).Error
	suite.Require().NoError(err)

	// Try to delete testUser's file as otherUser
	err = suite.storageService.DeleteFile(otherUser.ID, suite.testUserFile.ID)

	assert.Error(suite.T(), err)
	assert.Contains(suite.T(), err.Error(), "file not found")
}

func (suite *StorageServiceTestSuite) TestDeleteFile_LastReference() {
	// Create a file that only this user references
	uniqueFile := models.File{
		ContentHash: "unique_hash",
		SizeBytes:   512,
		StoragePath: "/mock/path/unique.txt",
	}
	err := suite.db.Create(&uniqueFile).Error
	suite.Require().NoError(err)

	uniqueUserFile := models.UserFile{
		UserID:        suite.testUser.ID,
		FileID:        uniqueFile.ID,
		Filename:      "unique.txt",
		MimeType:      "text/plain",
		EncryptionKey: "key",
	}
	err = suite.db.Create(&uniqueUserFile).Error
	suite.Require().NoError(err)

	// Delete the user file
	err = suite.storageService.DeleteFile(suite.testUser.ID, uniqueUserFile.ID)
	assert.NoError(suite.T(), err)

	// Verify user file is soft-deleted
	var deletedUserFile models.UserFile
	err = suite.db.Unscoped().Where("id = ?", uniqueUserFile.ID).First(&deletedUserFile).Error
	assert.NoError(suite.T(), err)
	assert.True(suite.T(), deletedUserFile.DeletedAt.Valid)

	// Verify file record still exists (DeleteFile only soft deletes user file, doesn't delete file record)
	var existingFile models.File
	err = suite.db.Where("id = ?", uniqueFile.ID).First(&existingFile).Error
	assert.NoError(suite.T(), err)
	assert.False(suite.T(), existingFile.DeletedAt.Valid) // File record should not be soft deleted
}

func (suite *StorageServiceTestSuite) TestGetFileDownloadURL_Success() {
	url, err := suite.storageService.GetFileDownloadURL(context.Background(), &suite.testUser, suite.testUserFile.ID)

	assert.NoError(suite.T(), err)
	assert.Contains(suite.T(), url, "http://localhost:8080/api/files")
	assert.Contains(suite.T(), url, fmt.Sprintf("%d/download", suite.testUserFile.ID))
}

func (suite *StorageServiceTestSuite) TestGetFileDownloadURL_FileNotFound() {
	url, err := suite.storageService.GetFileDownloadURL(context.Background(), &suite.testUser, 99999)

	assert.Error(suite.T(), err)
	assert.Empty(suite.T(), url)
	assert.Contains(suite.T(), err.Error(), "file not found")
}

func (suite *StorageServiceTestSuite) TestGetFileDownloadURL_WrongUser() {
	otherUser := models.User{
		Username:     "otheruser3",
		Email:        "other@example.com",
		PasswordHash: "hash",
		StorageQuota: 10485760,
		UsedStorage:  0,
		IsAdmin:      false,
	}
	err := suite.db.Create(&otherUser).Error
	suite.Require().NoError(err)

	url, err := suite.storageService.GetFileDownloadURL(context.Background(), &otherUser, suite.testUserFile.ID)

	assert.Error(suite.T(), err)
	assert.Empty(suite.T(), url)
	assert.Contains(suite.T(), err.Error(), "file not found")
}

func (suite *StorageServiceTestSuite) TestGetFile_Success() {
	content, mimeType, err := suite.storageService.GetFile(suite.testUser.ID, suite.testUserFile.ID)

	assert.NoError(suite.T(), err)
	assert.Equal(suite.T(), suite.testUserFile.MimeType, mimeType)
	assert.Contains(suite.T(), string(content), "Mock file content")
	assert.Contains(suite.T(), string(content), suite.testUserFile.Filename)
}

func (suite *StorageServiceTestSuite) TestGetFile_FileNotFound() {
	content, mimeType, err := suite.storageService.GetFile(suite.testUser.ID, 99999)

	assert.Error(suite.T(), err)
	assert.Empty(suite.T(), content)
	assert.Empty(suite.T(), mimeType)
	assert.Contains(suite.T(), err.Error(), "file not found")
}

func (suite *StorageServiceTestSuite) TestGetFile_WrongUser() {
	otherUser := models.User{
		Username:     "otheruser2",
		Email:        "other@example.com",
		PasswordHash: "hash",
		StorageQuota: 10485760,
		UsedStorage:  0,
		IsAdmin:      false,
	}
	err := suite.db.Create(&otherUser).Error
	suite.Require().NoError(err)

	content, mimeType, err := suite.storageService.GetFile(otherUser.ID, suite.testUserFile.ID)

	assert.Error(suite.T(), err)
	assert.Empty(suite.T(), content)
	assert.Empty(suite.T(), mimeType)
	assert.Contains(suite.T(), err.Error(), "file not found")
}

func (suite *StorageServiceTestSuite) TestGetAllFiles() {
	files, err := suite.storageService.GetAllFiles()

	assert.NoError(suite.T(), err)
	assert.Len(suite.T(), files, 1)
	assert.Equal(suite.T(), suite.testUserFile.Filename, files[0].Filename)
}

func (suite *StorageServiceTestSuite) TestGetAllFiles_Empty() {
	// Delete existing user file
	suite.db.Delete(&suite.testUserFile)

	files, err := suite.storageService.GetAllFiles()

	assert.NoError(suite.T(), err)
	assert.Empty(suite.T(), files)
}

func (suite *StorageServiceTestSuite) TestGetAllFiles_MultipleUsers() {
	// Create another user and file
	otherUser := models.User{
		Username:     "otheruser4",
		Email:        "other@example.com",
		PasswordHash: "hash",
		StorageQuota: 10485760,
		UsedStorage:  0,
		IsAdmin:      false,
	}
	err := suite.db.Create(&otherUser).Error
	suite.Require().NoError(err)

	otherFile := models.File{
		ContentHash: "other_hash",
		SizeBytes:   2048,
		StoragePath: "/mock/path/other.txt",
	}
	err = suite.db.Create(&otherFile).Error
	suite.Require().NoError(err)

	otherUserFile := models.UserFile{
		UserID:        otherUser.ID,
		FileID:        otherFile.ID,
		Filename:      "other.txt",
		MimeType:      "text/plain",
		EncryptionKey: "other_key",
	}
	err = suite.db.Create(&otherUserFile).Error
	suite.Require().NoError(err)

	files, err := suite.storageService.GetAllFiles()

	assert.NoError(suite.T(), err)
	assert.Len(suite.T(), files, 2)

	// Check that both files are returned
	filenames := make([]string, len(files))
	for i, file := range files {
		filenames[i] = file.Filename
	}
	assert.Contains(suite.T(), filenames, "test_file.txt")
	assert.Contains(suite.T(), filenames, "other.txt")
}

// Helper functions for creating pointers
func stringPtr(s string) *string {
	return &s
}

func int64Ptr(i int64) *int64 {
	return &i
}

func (suite *StorageServiceTestSuite) TestDeleteFile_SoftDelete() {
	// Delete the file (soft delete)
	err := suite.storageService.DeleteFile(suite.testUser.ID, suite.testUserFile.ID)
	assert.NoError(suite.T(), err)

	// Verify user file is soft-deleted (deleted_at is set)
	var deletedUserFile models.UserFile
	err = suite.db.Unscoped().Where("id = ?", suite.testUserFile.ID).First(&deletedUserFile).Error
	assert.NoError(suite.T(), err)
	assert.True(suite.T(), deletedUserFile.DeletedAt.Valid)

	// Verify file record still exists (not hard deleted)
	var file models.File
	err = suite.db.Where("id = ?", suite.testUserFile.FileID).First(&file).Error
	assert.NoError(suite.T(), err)
}

func (suite *StorageServiceTestSuite) TestDeleteFile_SoftDelete_FileNotFound() {
	err := suite.storageService.DeleteFile(suite.testUser.ID, 99999)
	assert.Error(suite.T(), err)
	assert.Contains(suite.T(), err.Error(), "file not found")
}

func (suite *StorageServiceTestSuite) TestDeleteFile_SoftDelete_WrongUser() {
	// Create another user
	otherUser := models.User{
		Username:     "otheruser5",
		Email:        "other@example.com",
		PasswordHash: "hash",
		StorageQuota: 10485760,
		UsedStorage:  0,
		IsAdmin:      false,
	}
	err := suite.db.Create(&otherUser).Error
	suite.Require().NoError(err)

	// Try to delete testUser's file as otherUser
	err = suite.storageService.DeleteFile(otherUser.ID, suite.testUserFile.ID)
	assert.Error(suite.T(), err)
	assert.Contains(suite.T(), err.Error(), "file not found")
}

func (suite *StorageServiceTestSuite) TestDeleteFile_WithRoomFile() {
	// Create a room
	room := models.Room{
		Name:      "Test Room",
		CreatorID: suite.testUser.ID,
	}
	err := suite.db.Create(&room).Error
	suite.Require().NoError(err)

	// Add user to room
	roomMember := models.RoomMember{
		RoomID: room.ID,
		UserID: suite.testUser.ID,
		Role:   models.RoomRoleAdmin,
	}
	err = suite.db.Create(&roomMember).Error
	suite.Require().NoError(err)

	// Add file to room
	roomFile := models.RoomFile{
		RoomID:     room.ID,
		UserFileID: suite.testUserFile.ID,
	}
	err = suite.db.Create(&roomFile).Error
	suite.Require().NoError(err)

	// Delete the file
	err = suite.storageService.DeleteFile(suite.testUser.ID, suite.testUserFile.ID)
	assert.NoError(suite.T(), err)

	// Verify room file is removed
	var deletedRoomFile models.RoomFile
	err = suite.db.Where("room_id = ? AND user_file_id = ?", room.ID, suite.testUserFile.ID).First(&deletedRoomFile).Error
	assert.True(suite.T(), errors.Is(err, gorm.ErrRecordNotFound))
}

func (suite *StorageServiceTestSuite) TestRestoreFile_Success() {
	// First soft delete the file
	err := suite.storageService.DeleteFile(suite.testUser.ID, suite.testUserFile.ID)
	assert.NoError(suite.T(), err)

	// Verify it's soft deleted
	var deletedUserFile models.UserFile
	err = suite.db.Unscoped().Where("id = ?", suite.testUserFile.ID).First(&deletedUserFile).Error
	assert.NoError(suite.T(), err)
	assert.True(suite.T(), deletedUserFile.DeletedAt.Valid)

	// Restore the file
	err = suite.storageService.RestoreFile(suite.testUser.ID, suite.testUserFile.ID)
	assert.NoError(suite.T(), err)

	// Verify it's restored (should be found without unscoped)
	var restoredUserFile models.UserFile
	err = suite.db.Where("id = ? AND user_id = ?", suite.testUserFile.ID, suite.testUser.ID).First(&restoredUserFile).Error
	assert.NoError(suite.T(), err)
	assert.False(suite.T(), restoredUserFile.DeletedAt.Valid)

	// Also verify it appears in GetUserFiles (not trashed)
	files, err := suite.storageService.GetUserFiles(suite.testUser.ID, nil)
	assert.NoError(suite.T(), err)
	assert.Len(suite.T(), files, 1)
	assert.Equal(suite.T(), suite.testUserFile.ID, files[0].ID)
}

func (suite *StorageServiceTestSuite) TestRestoreFile_FileNotFound() {
	err := suite.storageService.RestoreFile(suite.testUser.ID, 99999)
	assert.Error(suite.T(), err)
	assert.Contains(suite.T(), err.Error(), "file not found")
}

func (suite *StorageServiceTestSuite) TestRestoreFile_WrongUser() {
	// First soft delete the file
	err := suite.storageService.DeleteFile(suite.testUser.ID, suite.testUserFile.ID)
	assert.NoError(suite.T(), err)

	// Create another user
	otherUser := models.User{
		Username:     "otheruser6",
		Email:        "other@example.com",
		PasswordHash: "hash",
		StorageQuota: 10485760,
		UsedStorage:  0,
		IsAdmin:      false,
	}
	err = suite.db.Create(&otherUser).Error
	suite.Require().NoError(err)

	// Try to restore as other user
	err = suite.storageService.RestoreFile(otherUser.ID, suite.testUserFile.ID)
	assert.Error(suite.T(), err)
	assert.Contains(suite.T(), err.Error(), "file not found")
}

func (suite *StorageServiceTestSuite) TestRestoreFile_NotInTrash() {
	// Try to restore a file that's not in trash
	err := suite.storageService.RestoreFile(suite.testUser.ID, suite.testUserFile.ID)
	assert.Error(suite.T(), err)
	assert.Contains(suite.T(), err.Error(), "file is not in trash")
}

func (suite *StorageServiceTestSuite) TestPermanentlyDeleteFile_Success() {
	// First soft delete the file
	err := suite.storageService.DeleteFile(suite.testUser.ID, suite.testUserFile.ID)
	assert.NoError(suite.T(), err)

	// Permanently delete the file
	err = suite.storageService.PermanentlyDeleteFile(suite.testUser.ID, suite.testUserFile.ID)
	assert.NoError(suite.T(), err)

	// Verify user file is permanently deleted
	var deletedUserFile models.UserFile
	err = suite.db.Unscoped().Where("id = ?", suite.testUserFile.ID).First(&deletedUserFile).Error
	assert.Error(suite.T(), err)
	assert.True(suite.T(), errors.Is(err, gorm.ErrRecordNotFound))

	// Verify file record is also deleted (since no other references)
	var deletedFile models.File
	err = suite.db.Unscoped().Where("id = ?", suite.testUserFile.FileID).First(&deletedFile).Error
	assert.Error(suite.T(), err)
	assert.True(suite.T(), errors.Is(err, gorm.ErrRecordNotFound))
}

func (suite *StorageServiceTestSuite) TestPermanentlyDeleteFile_FileNotFound() {
	err := suite.storageService.PermanentlyDeleteFile(suite.testUser.ID, 99999)
	assert.Error(suite.T(), err)
	assert.Contains(suite.T(), err.Error(), "file not found")
}

func (suite *StorageServiceTestSuite) TestPermanentlyDeleteFile_WrongUser() {
	// First soft delete the file
	err := suite.storageService.DeleteFile(suite.testUser.ID, suite.testUserFile.ID)
	assert.NoError(suite.T(), err)

	// Create another user
	otherUser := models.User{
		Username:     "otheruser7",
		Email:        "other@example.com",
		PasswordHash: "hash",
		StorageQuota: 10485760,
		UsedStorage:  0,
		IsAdmin:      false,
	}
	err = suite.db.Create(&otherUser).Error
	suite.Require().NoError(err)

	// Try to permanently delete as other user
	err = suite.storageService.PermanentlyDeleteFile(otherUser.ID, suite.testUserFile.ID)
	assert.Error(suite.T(), err)
	assert.Contains(suite.T(), err.Error(), "file not found")
}

func (suite *StorageServiceTestSuite) TestPermanentlyDeleteFile_NotInTrash() {
	// Try to permanently delete a file that's not in trash
	err := suite.storageService.PermanentlyDeleteFile(suite.testUser.ID, suite.testUserFile.ID)
	assert.Error(suite.T(), err)
	assert.Contains(suite.T(), err.Error(), "file is not in trash")
}

func (suite *StorageServiceTestSuite) TestPermanentlyDeleteFile_WithMultipleReferences() {
	// Create another user
	otherUser := models.User{
		Username:     "otheruser8",
		Email:        "other@example.com",
		PasswordHash: "hash",
		StorageQuota: 10485760,
		UsedStorage:  0,
		IsAdmin:      false,
	}
	err := suite.db.Create(&otherUser).Error
	suite.Require().NoError(err)

	// Create another user file pointing to the same file
	otherUserFile := models.UserFile{
		UserID:        otherUser.ID,
		FileID:        suite.testUserFile.FileID,
		Filename:      "shared_file.txt",
		MimeType:      "text/plain",
		EncryptionKey: "other_key",
	}
	err = suite.db.Create(&otherUserFile).Error
	suite.Require().NoError(err)

	// Soft delete the first user's file
	err = suite.storageService.DeleteFile(suite.testUser.ID, suite.testUserFile.ID)
	assert.NoError(suite.T(), err)

	// Permanently delete the first user's file
	err = suite.storageService.PermanentlyDeleteFile(suite.testUser.ID, suite.testUserFile.ID)
	assert.NoError(suite.T(), err)

	// Verify first user file is permanently deleted
	var deletedUserFile models.UserFile
	err = suite.db.Unscoped().Where("id = ?", suite.testUserFile.ID).First(&deletedUserFile).Error
	assert.True(suite.T(), errors.Is(err, gorm.ErrRecordNotFound))

	// Verify file record still exists (because other user still references it)
	var file models.File
	err = suite.db.Where("id = ?", suite.testUserFile.FileID).First(&file).Error
	assert.NoError(suite.T(), err)

	// Verify other user's file still exists
	var existingOtherUserFile models.UserFile
	err = suite.db.Where("id = ?", otherUserFile.ID).First(&existingOtherUserFile).Error
	assert.NoError(suite.T(), err)
}

func (suite *StorageServiceTestSuite) TestGetTrashedFiles_Success() {
	// Create another file for the user
	otherFile := models.File{
		ContentHash: "other_hash",
		SizeBytes:   2048,
		StoragePath: "/mock/path/other.txt",
	}
	err := suite.db.Create(&otherFile).Error
	suite.Require().NoError(err)

	otherUserFile := models.UserFile{
		UserID:        suite.testUser.ID,
		FileID:        otherFile.ID,
		Filename:      "other.txt",
		MimeType:      "text/plain",
		EncryptionKey: "other_key",
	}
	err = suite.db.Create(&otherUserFile).Error
	suite.Require().NoError(err)

	// Soft delete both files
	err = suite.storageService.DeleteFile(suite.testUser.ID, suite.testUserFile.ID)
	assert.NoError(suite.T(), err)

	err = suite.storageService.DeleteFile(suite.testUser.ID, otherUserFile.ID)
	assert.NoError(suite.T(), err)

	// Get trashed files
	trashedFiles, err := suite.storageService.GetTrashedFiles(suite.testUser.ID)
	assert.NoError(suite.T(), err)
	assert.Len(suite.T(), trashedFiles, 2)

	// Verify both files are in the result
	filenames := make([]string, len(trashedFiles))
	for i, file := range trashedFiles {
		filenames[i] = file.Filename
	}
	assert.Contains(suite.T(), filenames, "test_file.txt")
	assert.Contains(suite.T(), filenames, "other.txt")
}

func (suite *StorageServiceTestSuite) TestGetTrashedFiles_NoTrashedFiles() {
	// Create a new user with no trashed files
	newUser := models.User{
		Username:     "newuser",
		Email:        "new@example.com",
		PasswordHash: "hash",
		StorageQuota: 10485760,
		UsedStorage:  0,
		IsAdmin:      false,
	}
	err := suite.db.Create(&newUser).Error
	suite.Require().NoError(err)

	trashedFiles, err := suite.storageService.GetTrashedFiles(newUser.ID)
	assert.NoError(suite.T(), err)
	assert.Empty(suite.T(), trashedFiles)
}

func (suite *StorageServiceTestSuite) TestGetUserFiles_ExcludeTrashed() {
	// Create another file
	otherFile := models.File{
		ContentHash: "other_hash",
		SizeBytes:   2048,
		StoragePath: "/mock/path/other.txt",
	}
	err := suite.db.Create(&otherFile).Error
	suite.Require().NoError(err)

	otherUserFile := models.UserFile{
		UserID:        suite.testUser.ID,
		FileID:        otherFile.ID,
		Filename:      "other.txt",
		MimeType:      "text/plain",
		EncryptionKey: "other_key",
	}
	err = suite.db.Create(&otherUserFile).Error
	suite.Require().NoError(err)

	// Soft delete one file
	err = suite.storageService.DeleteFile(suite.testUser.ID, suite.testUserFile.ID)
	assert.NoError(suite.T(), err)

	// Get user files without trashed files
	files, err := suite.storageService.GetUserFiles(suite.testUser.ID, nil)
	assert.NoError(suite.T(), err)
	assert.Len(suite.T(), files, 1)
	assert.Equal(suite.T(), "other.txt", files[0].Filename)
}

func (suite *StorageServiceTestSuite) TestGetUserFiles_IncludeTrashed() {
	// Create another file
	otherFile := models.File{
		ContentHash: "other_hash",
		SizeBytes:   2048,
		StoragePath: "/mock/path/other.txt",
	}
	err := suite.db.Create(&otherFile).Error
	suite.Require().NoError(err)

	otherUserFile := models.UserFile{
		UserID:        suite.testUser.ID,
		FileID:        otherFile.ID,
		Filename:      "other.txt",
		MimeType:      "text/plain",
		EncryptionKey: "other_key",
	}
	err = suite.db.Create(&otherUserFile).Error
	suite.Require().NoError(err)

	// Soft delete one file
	err = suite.storageService.DeleteFile(suite.testUser.ID, suite.testUserFile.ID)
	assert.NoError(suite.T(), err)

	// Get user files including trashed files
	filter := &services.FileFilter{
		IncludeTrashed: boolPtr(true),
	}
	files, err := suite.storageService.GetUserFiles(suite.testUser.ID, filter)
	assert.NoError(suite.T(), err)
	assert.Len(suite.T(), files, 2)

	// Verify both files are returned
	filenames := make([]string, len(files))
	for i, file := range files {
		filenames[i] = file.Filename
	}
	assert.Contains(suite.T(), filenames, "test_file.txt")
	assert.Contains(suite.T(), filenames, "other.txt")
}

func (suite *StorageServiceTestSuite) TestGetUserFiles_FilterTrashedFiles() {
	// Create another file
	otherFile := models.File{
		ContentHash: "other_hash",
		SizeBytes:   2048,
		StoragePath: "/mock/path/other.txt",
	}
	err := suite.db.Create(&otherFile).Error
	suite.Require().NoError(err)

	otherUserFile := models.UserFile{
		UserID:        suite.testUser.ID,
		FileID:        otherFile.ID,
		Filename:      "document.pdf",
		MimeType:      "application/pdf",
		EncryptionKey: "other_key",
	}
	err = suite.db.Create(&otherUserFile).Error
	suite.Require().NoError(err)

	// Soft delete both files
	err = suite.storageService.DeleteFile(suite.testUser.ID, suite.testUserFile.ID)
	assert.NoError(suite.T(), err)

	err = suite.storageService.DeleteFile(suite.testUser.ID, otherUserFile.ID)
	assert.NoError(suite.T(), err)

	// Filter trashed files by filename
	filter := &services.FileFilter{
		Filename:       stringPtr("document"),
		IncludeTrashed: boolPtr(true),
	}
	files, err := suite.storageService.GetUserFiles(suite.testUser.ID, filter)
	assert.NoError(suite.T(), err)
	assert.Len(suite.T(), files, 1)
	assert.Equal(suite.T(), "document.pdf", files[0].Filename)
}

// Helper function for creating boolean pointers
func boolPtr(b bool) *bool {
	return &b
}

func (suite *StorageServiceTestSuite) TestFileService_NoSensitiveDataInLogs() {
	// Capture log output to verify no sensitive data is logged
	var buf bytes.Buffer
	originalLogger := log.Writer()
	log.SetOutput(&buf)
	defer log.SetOutput(originalLogger)

	// Perform a delete operation
	err := suite.storageService.DeleteFile(suite.testUser.ID, suite.testUserFile.ID)

	// Verify operation succeeded
	assert.NoError(suite.T(), err)

	// Verify no sensitive data in logs (user ID, file ID, filename should not be logged)
	logOutput := buf.String()
	assert.NotContains(suite.T(), logOutput, fmt.Sprintf("%d", suite.testUser.ID), "User ID should not be logged")
	assert.NotContains(suite.T(), logOutput, fmt.Sprintf("%d", suite.testUserFile.ID), "File ID should not be logged")
	assert.NotContains(suite.T(), logOutput, suite.testUserFile.Filename, "Filename should not be logged")
	assert.NotContains(suite.T(), logOutput, suite.testUserFile.EncryptionKey, "Encryption key should not be logged")
}

func TestFileServiceSuite(t *testing.T) {
	suite.Run(t, new(StorageServiceTestSuite))
}
