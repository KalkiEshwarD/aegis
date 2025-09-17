package services_test

import (
	"errors"
	"fmt"
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

type FileServiceTestSuite struct {
	suite.Suite
	db          *gorm.DB
	fileService *services.FileService
	testUser    models.User
	testFile    models.File
	testUserFile models.UserFile
}

func (suite *FileServiceTestSuite) SetupSuite() {
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
		MinIOEndpoint:  "", // Empty to disable MinIO
		MinIOAccessKey: "",
		MinIOSecretKey: "",
		MinIOBucket:    "",
	}

	suite.fileService = services.NewFileService(cfg)
}

func (suite *FileServiceTestSuite) TearDownSuite() {
	if suite.db != nil {
		sqlDB, _ := suite.db.DB()
		sqlDB.Close()
	}
}

func (suite *FileServiceTestSuite) SetupTest() {
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

func (suite *FileServiceTestSuite) TestNewFileService() {
	cfg := &config.Config{}
	service := services.NewFileService(cfg)
	assert.NotNil(suite.T(), service)
}

func (suite *FileServiceTestSuite) TestNewFileService_WithMinIO() {
	cfg := &config.Config{
		MinIOEndpoint:  "localhost:9000",
		MinIOAccessKey: "test_key",
		MinIOSecretKey: "test_secret",
		MinIOBucket:    "test_bucket",
	}
	// This will attempt to connect to MinIO but should handle the error gracefully
	service := services.NewFileService(cfg)
	assert.NotNil(suite.T(), service)
}

func (suite *FileServiceTestSuite) TestUploadFileFromMap_Success() {
	data := map[string]interface{}{
		"filename":      "test_upload.txt",
		"mime_type":     "text/plain",
		"size_bytes":    float64(512),
		"content_hash":  "unique_hash_456",
		"encrypted_key": "encryption_key_123",
		"file_data":     []byte("test file content"),
	}

	userFile, err := suite.fileService.UploadFileFromMap(suite.testUser.ID, data)

	assert.NoError(suite.T(), err)
	assert.NotNil(suite.T(), userFile)
	assert.Equal(suite.T(), "test_upload.txt", userFile.Filename)
	assert.Equal(suite.T(), "text/plain", userFile.MimeType)
	assert.Equal(suite.T(), int64(512), userFile.File.SizeBytes)
}

func (suite *FileServiceTestSuite) TestUploadFileFromMap_InvalidData() {
	// Test with missing required fields
	data := map[string]interface{}{
		"filename": "test.txt",
		// Missing other required fields
	}

	userFile, err := suite.fileService.UploadFileFromMap(suite.testUser.ID, data)

	assert.Error(suite.T(), err)
	assert.Nil(suite.T(), userFile)
	assert.Contains(suite.T(), err.Error(), "file data is required")
}

func (suite *FileServiceTestSuite) TestUploadFileFromMap_TypeMismatch() {
	data := map[string]interface{}{
		"id":           123, // Should be string
		"size":         "not-a-number", // Should be number
		"filename":     nil, // Should be string
		"mime_type":    "text/plain",
		"content_hash": "hash",
		"encrypted_key": "key",
		"file_data":    []byte("content"),
	}

	userFile, err := suite.fileService.UploadFileFromMap(suite.testUser.ID, data)

	assert.Error(suite.T(), err)
	assert.Nil(suite.T(), userFile)
}

func (suite *FileServiceTestSuite) TestUploadFile_Success() {
	fileContent := "test file content for upload"
	reader := strings.NewReader(fileContent)

	userFile, err := suite.fileService.UploadFile(
		suite.testUser.ID,
		"new_file.txt",
		"text/plain",
		"new_unique_hash",
		"new_encryption_key",
		reader,
		int64(len(fileContent)),
	)

	assert.NoError(suite.T(), err)
	assert.NotNil(suite.T(), userFile)
	assert.Equal(suite.T(), "new_file.txt", userFile.Filename)
	assert.Equal(suite.T(), "text/plain", userFile.MimeType)
	assert.Equal(suite.T(), int64(len(fileContent)), userFile.File.SizeBytes)
}

func (suite *FileServiceTestSuite) TestUploadFile_Deduplication() {
	// First upload
	fileContent := "duplicate content"
	reader1 := strings.NewReader(fileContent)

	userFile1, err := suite.fileService.UploadFile(
		suite.testUser.ID,
		"file1.txt",
		"text/plain",
		"duplicate_hash",
		"key1",
		reader1,
		int64(len(fileContent)),
	)
	assert.NoError(suite.T(), err)

	// Second upload with same hash (should reuse existing file)
	reader2 := strings.NewReader(fileContent)
	userFile2, err := suite.fileService.UploadFile(
		suite.testUser.ID,
		"file2.txt", // Different filename
		"text/plain",
		"duplicate_hash", // Same hash
		"key2",
		reader2,
		int64(len(fileContent)),
	)
	assert.NoError(suite.T(), err)

	// Should have same FileID but different UserFile records
	assert.Equal(suite.T(), userFile1.FileID, userFile2.FileID)
	assert.NotEqual(suite.T(), userFile1.ID, userFile2.ID)
	assert.Equal(suite.T(), "file1.txt", userFile1.Filename)
	assert.Equal(suite.T(), "file2.txt", userFile2.Filename)
}

func (suite *FileServiceTestSuite) TestUploadFile_ReuploadAfterDelete() {
	// First upload
	fileContent := "content for reupload test"
	reader1 := strings.NewReader(fileContent)

	userFile1, err := suite.fileService.UploadFile(
		suite.testUser.ID,
		"reupload_test.txt",
		"text/plain",
		"reupload_hash",
		"key1",
		reader1,
		int64(len(fileContent)),
	)
	assert.NoError(suite.T(), err)

	// Delete the file
	err = suite.fileService.DeleteFile(suite.testUser.ID, userFile1.ID)
	assert.NoError(suite.T(), err)

	// Verify file is soft-deleted
	var deletedFile models.File
	err = suite.db.Unscoped().Where("id = ?", userFile1.FileID).First(&deletedFile).Error
	assert.NoError(suite.T(), err)
	assert.True(suite.T(), deletedFile.DeletedAt.Valid)

	// Try to upload the same file again
	reader2 := strings.NewReader(fileContent)
	userFile2, err := suite.fileService.UploadFile(
		suite.testUser.ID,
		"reupload_test_v2.txt", // Different filename
		"text/plain",
		"reupload_hash", // Same hash
		"key2",
		reader2,
		int64(len(fileContent)),
	)
	assert.NoError(suite.T(), err)

	// Should reuse the same FileID (restored from soft-delete)
	assert.Equal(suite.T(), userFile1.FileID, userFile2.FileID)
	assert.NotEqual(suite.T(), userFile1.ID, userFile2.ID)
	assert.Equal(suite.T(), "reupload_test_v2.txt", userFile2.Filename)

	// Verify file is restored (not soft-deleted anymore)
	var restoredFile models.File
	err = suite.db.Where("id = ?", userFile1.FileID).First(&restoredFile).Error
	assert.NoError(suite.T(), err)
	assert.False(suite.T(), restoredFile.DeletedAt.Valid)
}

func (suite *FileServiceTestSuite) TestUploadFile_EmptyFile() {
	reader := strings.NewReader("")

	userFile, err := suite.fileService.UploadFile(
		suite.testUser.ID,
		"empty.txt",
		"text/plain",
		"empty_hash",
		"key",
		reader,
		0,
	)

	assert.NoError(suite.T(), err)
	assert.NotNil(suite.T(), userFile)
	assert.Equal(suite.T(), int64(0), userFile.File.SizeBytes)
}

func (suite *FileServiceTestSuite) TestUploadFile_SpecialCharactersInFilename() {
	specialFilename := "file with spaces & special chars (test).txt"
	reader := strings.NewReader("content")

	userFile, err := suite.fileService.UploadFile(
		suite.testUser.ID,
		specialFilename,
		"text/plain",
		"special_hash",
		"key",
		reader,
		int64(len("content")),
	)

	assert.NoError(suite.T(), err)
	assert.NotNil(suite.T(), userFile)
	assert.Equal(suite.T(), specialFilename, userFile.Filename)
}

func (suite *FileServiceTestSuite) TestUploadFile_InvalidUserID() {
	reader := strings.NewReader("content")

	userFile, err := suite.fileService.UploadFile(
		99999, // Non-existent user ID
		"test.txt",
		"text/plain",
		"hash",
		"key",
		reader,
		int64(len("content")),
	)

	// This should still succeed as we don't validate user existence in upload
	// User validation should happen at the handler level
	assert.NoError(suite.T(), err)
	assert.NotNil(suite.T(), userFile)
}

func (suite *FileServiceTestSuite) TestGetUserFiles_NoFiles() {
	// Create a new user with no files
	newUser := models.User{
		Email:        "empty@example.com",
		PasswordHash: "hash",
		StorageQuota: 10485760,
		UsedStorage:  0,
		IsAdmin:      false,
	}
	err := suite.db.Create(&newUser).Error
	suite.Require().NoError(err)

	files, err := suite.fileService.GetUserFiles(newUser.ID, nil)

	assert.NoError(suite.T(), err)
	assert.Empty(suite.T(), files)
}

func (suite *FileServiceTestSuite) TestGetUserFiles_WithFiles() {
	files, err := suite.fileService.GetUserFiles(suite.testUser.ID, nil)

	assert.NoError(suite.T(), err)
	assert.Len(suite.T(), files, 1)
	assert.Equal(suite.T(), suite.testUserFile.Filename, files[0].Filename)
	assert.Equal(suite.T(), suite.testUserFile.MimeType, files[0].MimeType)
}

func (suite *FileServiceTestSuite) TestGetUserFiles_WithFilenameFilter() {
	filter := &services.FileFilter{
		Filename: stringPtr("test_file"),
	}

	files, err := suite.fileService.GetUserFiles(suite.testUser.ID, filter)

	assert.NoError(suite.T(), err)
	assert.Len(suite.T(), files, 1)
	assert.Equal(suite.T(), suite.testUserFile.Filename, files[0].Filename)
}

func (suite *FileServiceTestSuite) TestGetUserFiles_WithMimeTypeFilter() {
	filter := &services.FileFilter{
		MimeType: stringPtr("text/plain"),
	}

	files, err := suite.fileService.GetUserFiles(suite.testUser.ID, filter)

	assert.NoError(suite.T(), err)
	assert.Len(suite.T(), files, 1)
	assert.Equal(suite.T(), suite.testUserFile.MimeType, files[0].MimeType)
}

func (suite *FileServiceTestSuite) TestGetUserFiles_WithSizeFilter() {
	filter := &services.FileFilter{
		MinSize: int64Ptr(512),
		MaxSize: int64Ptr(2048),
	}

	files, err := suite.fileService.GetUserFiles(suite.testUser.ID, filter)

	assert.NoError(suite.T(), err)
	assert.Len(suite.T(), files, 1)
	assert.Equal(suite.T(), suite.testFile.SizeBytes, files[0].File.SizeBytes)
}

func (suite *FileServiceTestSuite) TestGetUserFiles_WithDateFilter() {
	now := time.Now()
	dateFrom := interface{}(now.Add(-time.Hour))
	dateTo := interface{}(now.Add(time.Hour))
	filter := &services.FileFilter{
		DateFrom: &dateFrom,
		DateTo:   &dateTo,
	}

	files, err := suite.fileService.GetUserFiles(suite.testUser.ID, filter)

	assert.NoError(suite.T(), err)
	assert.Len(suite.T(), files, 1)
}

func (suite *FileServiceTestSuite) TestGetUserFiles_FilterNoMatches() {
	filter := &services.FileFilter{
		Filename: stringPtr("nonexistent"),
	}

	files, err := suite.fileService.GetUserFiles(suite.testUser.ID, filter)

	assert.NoError(suite.T(), err)
	assert.Empty(suite.T(), files)
}

func (suite *FileServiceTestSuite) TestDeleteFile_Success() {
	err := suite.fileService.DeleteFile(suite.testUser.ID, suite.testUserFile.ID)

	assert.NoError(suite.T(), err)

	// Verify user file is deleted
	var deletedUserFile models.UserFile
	err = suite.db.Where("id = ?", suite.testUserFile.ID).First(&deletedUserFile).Error
	assert.Error(suite.T(), err)
	assert.True(suite.T(), errors.Is(err, gorm.ErrRecordNotFound))
}

func (suite *FileServiceTestSuite) TestDeleteFile_FileNotFound() {
	err := suite.fileService.DeleteFile(suite.testUser.ID, 99999)

	assert.Error(suite.T(), err)
	assert.Contains(suite.T(), err.Error(), "file not found")
}

func (suite *FileServiceTestSuite) TestDeleteFile_WrongUser() {
	// Create another user
	otherUser := models.User{
		Email:        "other@example.com",
		PasswordHash: "hash",
		StorageQuota: 10485760,
		UsedStorage:  0,
		IsAdmin:      false,
	}
	err := suite.db.Create(&otherUser).Error
	suite.Require().NoError(err)

	// Try to delete testUser's file as otherUser
	err = suite.fileService.DeleteFile(otherUser.ID, suite.testUserFile.ID)

	assert.Error(suite.T(), err)
	assert.Contains(suite.T(), err.Error(), "file not found")
}

func (suite *FileServiceTestSuite) TestDeleteFile_LastReference() {
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
	err = suite.fileService.DeleteFile(suite.testUser.ID, uniqueUserFile.ID)
	assert.NoError(suite.T(), err)

	// Verify both user file and file are deleted
	var deletedUserFile models.UserFile
	err = suite.db.Where("id = ?", uniqueUserFile.ID).First(&deletedUserFile).Error
	assert.True(suite.T(), errors.Is(err, gorm.ErrRecordNotFound))

	var deletedFile models.File
	err = suite.db.Where("id = ?", uniqueFile.ID).First(&deletedFile).Error
	assert.True(suite.T(), errors.Is(err, gorm.ErrRecordNotFound))
}

func (suite *FileServiceTestSuite) TestDeleteFile_MultipleReferences() {
	// Create another user
	otherUser := models.User{
		Email:        "other@example.com",
		PasswordHash: "hash",
		StorageQuota: 10485760,
		UsedStorage:  0,
		IsAdmin:      false,
	}
	err := suite.db.Create(&otherUser).Error
	suite.Require().NoError(err)

	// Create another user file referencing the same file
	otherUserFile := models.UserFile{
		UserID:        otherUser.ID,
		FileID:        suite.testFile.ID, // Same file as testUserFile
		Filename:      "other_name.txt",
		MimeType:      "text/plain",
		EncryptionKey: "other_key",
	}
	err = suite.db.Create(&otherUserFile).Error
	suite.Require().NoError(err)

	// Delete one user file
	err = suite.fileService.DeleteFile(suite.testUser.ID, suite.testUserFile.ID)
	assert.NoError(suite.T(), err)

	// Verify user file is deleted but file still exists
	var deletedUserFile models.UserFile
	err = suite.db.Where("id = ?", suite.testUserFile.ID).First(&deletedUserFile).Error
	assert.True(suite.T(), errors.Is(err, gorm.ErrRecordNotFound))

	var existingFile models.File
	err = suite.db.Where("id = ?", suite.testFile.ID).First(&existingFile).Error
	assert.NoError(suite.T(), err)
}

func (suite *FileServiceTestSuite) TestGetFileDownloadURL_Success() {
	url, err := suite.fileService.GetFileDownloadURL(suite.testUser.ID, suite.testUserFile.ID)

	assert.NoError(suite.T(), err)
	assert.Contains(suite.T(), url, "mock://download")
	assert.Contains(suite.T(), url, fmt.Sprintf("%d", suite.testUser.ID))
	assert.Contains(suite.T(), url, fmt.Sprintf("%d", suite.testUserFile.ID))
}

func (suite *FileServiceTestSuite) TestGetFileDownloadURL_FileNotFound() {
	url, err := suite.fileService.GetFileDownloadURL(suite.testUser.ID, 99999)

	assert.Error(suite.T(), err)
	assert.Empty(suite.T(), url)
	assert.Contains(suite.T(), err.Error(), "file not found")
}

func (suite *FileServiceTestSuite) TestGetFileDownloadURL_WrongUser() {
	otherUser := models.User{
		Email:        "other@example.com",
		PasswordHash: "hash",
		StorageQuota: 10485760,
		UsedStorage:  0,
		IsAdmin:      false,
	}
	err := suite.db.Create(&otherUser).Error
	suite.Require().NoError(err)

	url, err := suite.fileService.GetFileDownloadURL(otherUser.ID, suite.testUserFile.ID)

	assert.Error(suite.T(), err)
	assert.Empty(suite.T(), url)
	assert.Contains(suite.T(), err.Error(), "file not found")
}

func (suite *FileServiceTestSuite) TestGetFile_Success() {
	content, mimeType, err := suite.fileService.GetFile(suite.testUser.ID, suite.testUserFile.ID)

	assert.NoError(suite.T(), err)
	assert.Equal(suite.T(), suite.testUserFile.MimeType, mimeType)
	assert.Contains(suite.T(), string(content), "Mock file content")
	assert.Contains(suite.T(), string(content), suite.testUserFile.Filename)
}

func (suite *FileServiceTestSuite) TestGetFile_FileNotFound() {
	content, mimeType, err := suite.fileService.GetFile(suite.testUser.ID, 99999)

	assert.Error(suite.T(), err)
	assert.Empty(suite.T(), content)
	assert.Empty(suite.T(), mimeType)
	assert.Contains(suite.T(), err.Error(), "file not found")
}

func (suite *FileServiceTestSuite) TestGetFile_WrongUser() {
	otherUser := models.User{
		Email:        "other@example.com",
		PasswordHash: "hash",
		StorageQuota: 10485760,
		UsedStorage:  0,
		IsAdmin:      false,
	}
	err := suite.db.Create(&otherUser).Error
	suite.Require().NoError(err)

	content, mimeType, err := suite.fileService.GetFile(otherUser.ID, suite.testUserFile.ID)

	assert.Error(suite.T(), err)
	assert.Empty(suite.T(), content)
	assert.Empty(suite.T(), mimeType)
	assert.Contains(suite.T(), err.Error(), "file not found")
}

func (suite *FileServiceTestSuite) TestGetAllFiles() {
	files, err := suite.fileService.GetAllFiles()

	assert.NoError(suite.T(), err)
	assert.Len(suite.T(), files, 1)
	assert.Equal(suite.T(), suite.testUserFile.Filename, files[0].Filename)
}

func (suite *FileServiceTestSuite) TestGetAllFiles_Empty() {
	// Delete existing user file
	suite.db.Delete(&suite.testUserFile)

	files, err := suite.fileService.GetAllFiles()

	assert.NoError(suite.T(), err)
	assert.Empty(suite.T(), files)
}

func (suite *FileServiceTestSuite) TestGetAllFiles_MultipleUsers() {
	// Create another user and file
	otherUser := models.User{
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

	files, err := suite.fileService.GetAllFiles()

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

func TestFileServiceSuite(t *testing.T) {
	suite.Run(t, new(FileServiceTestSuite))
}