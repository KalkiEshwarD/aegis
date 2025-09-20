package services_test

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/suite"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"

	"github.com/balkanid/aegis-backend/internal/database"
	"github.com/balkanid/aegis-backend/internal/models"
	"github.com/balkanid/aegis-backend/internal/services"
)

type PasswordShareServiceTestSuite struct {
	suite.Suite
	db                   *gorm.DB
	passwordShareService *services.PasswordShareService
	testUser             models.User
	testFile             models.File
	testUserFile         models.UserFile
}

func (suite *PasswordShareServiceTestSuite) SetupSuite() {
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
		&models.FileShare{},
		&models.ShareAccessLog{},
	)
	suite.Require().NoError(err)

	// Create database service
	dbService := database.NewDB(db)

	suite.passwordShareService = services.NewPasswordShareService(dbService)
}

func (suite *PasswordShareServiceTestSuite) TearDownSuite() {
	if suite.db != nil {
		sqlDB, _ := suite.db.DB()
		sqlDB.Close()
	}
}

func (suite *PasswordShareServiceTestSuite) SetupTest() {
	// Clean database before each test
	suite.db.Exec("DELETE FROM share_access_logs")
	suite.db.Exec("DELETE FROM file_shares")
	suite.db.Exec("DELETE FROM user_files")
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
		EncryptionKey: "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef12", // 64 hex chars = 32 bytes
	}
	err = suite.db.Create(&suite.testUserFile).Error
	suite.Require().NoError(err)
}

func (suite *PasswordShareServiceTestSuite) TestNewPasswordShareService() {
	dbService := database.NewDB(suite.db)
	service := services.NewPasswordShareService(dbService)
	assert.NotNil(suite.T(), service)
}

func (suite *PasswordShareServiceTestSuite) TestCreateShare_Success() {
	masterPassword := "StrongPassword123!"
	maxDownloads := 5
	expiresAt := time.Now().Add(24 * time.Hour)

	fileShare, err := suite.passwordShareService.CreateShare(suite.testUserFile.ID, masterPassword, maxDownloads, &expiresAt)

	assert.NoError(suite.T(), err)
	assert.NotNil(suite.T(), fileShare)
	assert.Equal(suite.T(), suite.testUserFile.ID, fileShare.UserFileID)
	assert.Equal(suite.T(), maxDownloads, fileShare.MaxDownloads)
	assert.Equal(suite.T(), 0, fileShare.DownloadCount)
	assert.NotEmpty(suite.T(), fileShare.ShareToken)
	assert.NotEmpty(suite.T(), fileShare.EncryptedKey)
	assert.NotEmpty(suite.T(), fileShare.Salt)
	assert.NotEmpty(suite.T(), fileShare.IV)
	assert.True(suite.T(), expiresAt.Equal(*fileShare.ExpiresAt))

	// Verify user file was updated
	var updatedUserFile models.UserFile
	err = suite.db.First(&updatedUserFile, suite.testUserFile.ID).Error
	assert.NoError(suite.T(), err)
	assert.True(suite.T(), updatedUserFile.IsShared)
	assert.Equal(suite.T(), 1, updatedUserFile.ShareCount)
}

func (suite *PasswordShareServiceTestSuite) TestCreateShare_WeakPassword() {
	weakPassword := "123"

	fileShare, err := suite.passwordShareService.CreateShare(suite.testUserFile.ID, weakPassword, 5, nil)

	assert.Error(suite.T(), err)
	assert.Nil(suite.T(), fileShare)
	assert.Contains(suite.T(), err.Error(), "password does not meet security requirements")
}

func (suite *PasswordShareServiceTestSuite) TestCreateShare_FileNotFound() {
	masterPassword := "StrongPassword123!"

	fileShare, err := suite.passwordShareService.CreateShare(99999, masterPassword, 5, nil)

	assert.Error(suite.T(), err)
	assert.Nil(suite.T(), fileShare)
	assert.Contains(suite.T(), err.Error(), "file not found")
}

func (suite *PasswordShareServiceTestSuite) TestCreateShare_InvalidEncryptionKey() {
	// Create user file with invalid encryption key
	invalidUserFile := models.UserFile{
		UserID:        suite.testUser.ID,
		FileID:        suite.testFile.ID,
		Filename:      "invalid_key.txt",
		MimeType:      "text/plain",
		EncryptionKey: "invalid", // Invalid hex
	}
	err := suite.db.Create(&invalidUserFile).Error
	suite.Require().NoError(err)

	masterPassword := "StrongPassword123!"

	fileShare, err := suite.passwordShareService.CreateShare(invalidUserFile.ID, masterPassword, 5, nil)

	assert.Error(suite.T(), err)
	assert.Nil(suite.T(), fileShare)
	assert.Contains(suite.T(), err.Error(), "invalid file encryption key")
}

func (suite *PasswordShareServiceTestSuite) TestCreateShare_UnlimitedDownloads() {
	masterPassword := "StrongPassword123!"

	fileShare, err := suite.passwordShareService.CreateShare(suite.testUserFile.ID, masterPassword, -1, nil)

	assert.NoError(suite.T(), err)
	assert.NotNil(suite.T(), fileShare)
	assert.Equal(suite.T(), -1, fileShare.MaxDownloads)
}

func (suite *PasswordShareServiceTestSuite) TestGetShareByToken_Success() {
	// Create a share first
	masterPassword := "StrongPassword123!"
	fileShare, err := suite.passwordShareService.CreateShare(suite.testUserFile.ID, masterPassword, 5, nil)
	suite.Require().NoError(err)

	// Retrieve by token
	retrievedShare, err := suite.passwordShareService.GetShareByToken(fileShare.ShareToken)

	assert.NoError(suite.T(), err)
	assert.NotNil(suite.T(), retrievedShare)
	assert.Equal(suite.T(), fileShare.ID, retrievedShare.ID)
	assert.Equal(suite.T(), fileShare.ShareToken, retrievedShare.ShareToken)
	assert.NotNil(suite.T(), retrievedShare.UserFile)
	assert.NotNil(suite.T(), retrievedShare.UserFile.File)
}

func (suite *PasswordShareServiceTestSuite) TestGetShareByToken_NotFound() {
	retrievedShare, err := suite.passwordShareService.GetShareByToken("nonexistent_token")

	assert.Error(suite.T(), err)
	assert.Nil(suite.T(), retrievedShare)
	assert.Contains(suite.T(), err.Error(), "share not found")
}

func (suite *PasswordShareServiceTestSuite) TestGetShareByToken_Expired() {
	// Create a share with past expiration
	pastTime := time.Now().Add(-1 * time.Hour)
	masterPassword := "StrongPassword123!"
	fileShare, err := suite.passwordShareService.CreateShare(suite.testUserFile.ID, masterPassword, 5, &pastTime)
	suite.Require().NoError(err)

	retrievedShare, err := suite.passwordShareService.GetShareByToken(fileShare.ShareToken)

	assert.Error(suite.T(), err)
	assert.Nil(suite.T(), retrievedShare)
	assert.Contains(suite.T(), err.Error(), "share has expired")
}

func (suite *PasswordShareServiceTestSuite) TestGetShareByToken_DownloadLimitExceeded() {
	// Create a share with download limit reached
	masterPassword := "StrongPassword123!"
	fileShare, err := suite.passwordShareService.CreateShare(suite.testUserFile.ID, masterPassword, 1, nil)
	suite.Require().NoError(err)

	// Manually set download count to limit
	fileShare.DownloadCount = 1
	suite.db.Save(fileShare)

	retrievedShare, err := suite.passwordShareService.GetShareByToken(fileShare.ShareToken)

	assert.Error(suite.T(), err)
	assert.Nil(suite.T(), retrievedShare)
	assert.Contains(suite.T(), err.Error(), "download limit exceeded")
}

func (suite *PasswordShareServiceTestSuite) TestDecryptFileKey_Success() {
	// Create a share
	masterPassword := "StrongPassword123!"
	fileShare, err := suite.passwordShareService.CreateShare(suite.testUserFile.ID, masterPassword, 5, nil)
	suite.Require().NoError(err)

	// Decrypt the key
	decryptedKey, err := suite.passwordShareService.DecryptFileKey(fileShare, masterPassword)

	assert.NoError(suite.T(), err)
	assert.NotEmpty(suite.T(), decryptedKey)
	assert.Greater(suite.T(), len(decryptedKey), 0) // Should return the original key
}

func (suite *PasswordShareServiceTestSuite) TestDecryptFileKey_WrongPassword() {
	// Create a share
	masterPassword := "StrongPassword123!"
	fileShare, err := suite.passwordShareService.CreateShare(suite.testUserFile.ID, masterPassword, 5, nil)
	suite.Require().NoError(err)

	// Try to decrypt with wrong password
	wrongPassword := "WrongPassword123!"
	decryptedKey, err := suite.passwordShareService.DecryptFileKey(fileShare, wrongPassword)

	assert.Error(suite.T(), err)
	assert.Nil(suite.T(), decryptedKey)
}

func (suite *PasswordShareServiceTestSuite) TestIncrementDownloadCount_Success() {
	// Create a share
	masterPassword := "StrongPassword123!"
	fileShare, err := suite.passwordShareService.CreateShare(suite.testUserFile.ID, masterPassword, 5, nil)
	suite.Require().NoError(err)

	// Increment download count
	err = suite.passwordShareService.IncrementDownloadCount(fileShare.ID)

	assert.NoError(suite.T(), err)

	// Verify count was incremented
	var updatedShare models.FileShare
	err = suite.db.First(&updatedShare, fileShare.ID).Error
	assert.NoError(suite.T(), err)
	assert.Equal(suite.T(), 1, updatedShare.DownloadCount)
}

func (suite *PasswordShareServiceTestSuite) TestIncrementDownloadCount_ShareNotFound() {
	// This method doesn't return an error for non-existent shares, it just silently does nothing
	err := suite.passwordShareService.IncrementDownloadCount(99999)

	assert.NoError(suite.T(), err)
}

func (suite *PasswordShareServiceTestSuite) TestDeleteShare_Success() {
	// Create a share
	masterPassword := "StrongPassword123!"
	fileShare, err := suite.passwordShareService.CreateShare(suite.testUserFile.ID, masterPassword, 5, nil)
	suite.Require().NoError(err)

	// Delete the share
	err = suite.passwordShareService.DeleteShare(suite.testUser.ID, fileShare.ID)

	assert.NoError(suite.T(), err)

	// Verify share was deleted
	var deletedShare models.FileShare
	err = suite.db.First(&deletedShare, fileShare.ID).Error
	assert.Error(suite.T(), err) // Should not find the record

	// Verify user file share count was decremented
	var updatedUserFile models.UserFile
	err = suite.db.First(&updatedUserFile, suite.testUserFile.ID).Error
	assert.NoError(suite.T(), err)
	assert.Equal(suite.T(), 0, updatedUserFile.ShareCount)
	assert.False(suite.T(), updatedUserFile.IsShared)
}

func (suite *PasswordShareServiceTestSuite) TestDeleteShare_ShareNotFound() {
	err := suite.passwordShareService.DeleteShare(suite.testUser.ID, 99999)

	assert.Error(suite.T(), err)
	assert.Contains(suite.T(), err.Error(), "share not found")
}

func (suite *PasswordShareServiceTestSuite) TestDeleteShare_WrongUser() {
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

	// Create a share for the original user
	masterPassword := "StrongPassword123!"
	fileShare, err := suite.passwordShareService.CreateShare(suite.testUserFile.ID, masterPassword, 5, nil)
	suite.Require().NoError(err)

	// Try to delete as other user
	err = suite.passwordShareService.DeleteShare(otherUser.ID, fileShare.ID)

	assert.Error(suite.T(), err)
	assert.Contains(suite.T(), err.Error(), "access denied")
}

func (suite *PasswordShareServiceTestSuite) TestDeleteShare_LastShare() {
	// Create a share
	masterPassword := "StrongPassword123!"
	fileShare, err := suite.passwordShareService.CreateShare(suite.testUserFile.ID, masterPassword, 5, nil)
	suite.Require().NoError(err)

	// Delete the share (should set is_shared to false)
	err = suite.passwordShareService.DeleteShare(suite.testUser.ID, fileShare.ID)

	assert.NoError(suite.T(), err)

	// Verify user file is_shared was set to false
	var updatedUserFile models.UserFile
	err = suite.db.First(&updatedUserFile, suite.testUserFile.ID).Error
	assert.NoError(suite.T(), err)
	assert.False(suite.T(), updatedUserFile.IsShared)
}

func (suite *PasswordShareServiceTestSuite) TestGetUserShares_Success() {
	// Create multiple shares for the user
	masterPassword := "StrongPassword123!"
	share1, err := suite.passwordShareService.CreateShare(suite.testUserFile.ID, masterPassword, 5, nil)
	suite.Require().NoError(err)

	// Create another file for the same user
	otherFile := models.File{
		ContentHash: "other_hash",
		SizeBytes:   2048,
		StoragePath: "/mock/path/other.txt",
	}
	err = suite.db.Create(&otherFile).Error
	suite.Require().NoError(err)

	otherUserFile := models.UserFile{
		UserID:        suite.testUser.ID,
		FileID:        otherFile.ID,
		Filename:      "other.txt",
		MimeType:      "text/plain",
		EncryptionKey: "abcdef1234567890abcdef1234567890",
	}
	err = suite.db.Create(&otherUserFile).Error
	suite.Require().NoError(err)

	share2, err := suite.passwordShareService.CreateShare(otherUserFile.ID, masterPassword, 10, nil)
	suite.Require().NoError(err)

	// Get user shares
	shares, err := suite.passwordShareService.GetUserShares(suite.testUser.ID)

	assert.NoError(suite.T(), err)
	assert.Len(suite.T(), shares, 2)

	// Verify shares are returned with proper associations
	shareTokens := make([]string, len(shares))
	for i, share := range shares {
		shareTokens[i] = share.ShareToken
		assert.NotNil(suite.T(), share.UserFile)
		assert.NotNil(suite.T(), share.UserFile.File)
	}
	assert.Contains(suite.T(), shareTokens, share1.ShareToken)
	assert.Contains(suite.T(), shareTokens, share2.ShareToken)
}

func (suite *PasswordShareServiceTestSuite) TestGetUserShares_NoShares() {
	// Create another user with no shares
	otherUser := models.User{
		Username:     "noshareuser",
		Email:        "noshare@example.com",
		PasswordHash: "hash",
		StorageQuota: 10485760,
		UsedStorage:  0,
		IsAdmin:      false,
	}
	err := suite.db.Create(&otherUser).Error
	suite.Require().NoError(err)

	shares, err := suite.passwordShareService.GetUserShares(otherUser.ID)

	assert.NoError(suite.T(), err)
	assert.Empty(suite.T(), shares)
}

func TestPasswordShareServiceSuite(t *testing.T) {
	suite.Run(t, new(PasswordShareServiceTestSuite))
}