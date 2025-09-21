package services_test

import (
	"net/url"
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

type ShareLinkServiceTestSuite struct {
	suite.Suite
	db               *gorm.DB
	shareLinkService *services.ShareService
	testUser         models.User
	testFile         models.File
	testUserFile     models.UserFile
	testFileShare    models.FileShare
}

func (suite *ShareLinkServiceTestSuite) SetupSuite() {
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
	)
	suite.Require().NoError(err)

	// Create database service
	dbService := database.NewDB(db)

	// Create encryption service for testing
	keyManagementService := services.NewKeyManagementService()
	encryptionService := services.NewEncryptionService(keyManagementService)

	suite.shareLinkService = services.NewShareService(dbService, "http://localhost:8080", encryptionService)
}

func (suite *ShareLinkServiceTestSuite) TearDownSuite() {
	if suite.db != nil {
		sqlDB, _ := suite.db.DB()
		sqlDB.Close()
	}
}

func (suite *ShareLinkServiceTestSuite) SetupTest() {
	// Clean database before each test
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
		EncryptionKey: "abcdef1234567890abcdef1234567890",
		IsShared:      false,
		ShareCount:    0,
	}
	err = suite.db.Create(&suite.testUserFile).Error
	suite.Require().NoError(err)

	// Create test file share
	expiresAt := time.Now().Add(24 * time.Hour)
	suite.testFileShare = models.FileShare{
		UserFileID:    suite.testUserFile.ID,
		ShareToken:    "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
		EncryptedKey:  "encrypted_key_data",
		Salt:          "salt_data",
		IV:            "iv_data",
		MaxDownloads:  5,
		DownloadCount: 0,
		ExpiresAt:     &expiresAt,
	}
	err = suite.db.Create(&suite.testFileShare).Error
	suite.Require().NoError(err)
}

func (suite *ShareLinkServiceTestSuite) TestNewShareLinkService() {
	dbService := database.NewDB(suite.db)
	keyManagementService := services.NewKeyManagementService()
	encryptionService := services.NewEncryptionService(keyManagementService)
	service := services.NewShareService(dbService, "http://test.com", encryptionService)
	assert.NotNil(suite.T(), service)
}

func (suite *ShareLinkServiceTestSuite) TestGenerateShareLink_Success() {
	shareURL, err := suite.shareLinkService.GenerateShareLink(&suite.testFileShare)

	assert.NoError(suite.T(), err)
	assert.Equal(suite.T(), "http://localhost:8080/v1/share/abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890", shareURL)

	// Verify URL is valid
	parsedURL, err := url.Parse(shareURL)
	assert.NoError(suite.T(), err)
	assert.Equal(suite.T(), "http", parsedURL.Scheme)
	assert.Equal(suite.T(), "localhost:8080", parsedURL.Host)
	assert.Equal(suite.T(), "/v1/share/abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890", parsedURL.Path)
}

func (suite *ShareLinkServiceTestSuite) TestGenerateShareLink_NilFileShare() {
	shareURL, err := suite.shareLinkService.GenerateShareLink(nil)

	assert.Error(suite.T(), err)
	assert.Empty(suite.T(), shareURL)
	assert.Contains(suite.T(), err.Error(), "file share cannot be nil")
}

func (suite *ShareLinkServiceTestSuite) TestValidateShareToken_Success() {
	fileShare, err := suite.shareLinkService.ValidateShareToken(suite.testFileShare.ShareToken)

	assert.NoError(suite.T(), err)
	assert.NotNil(suite.T(), fileShare)
	assert.Equal(suite.T(), suite.testFileShare.ID, fileShare.ID)
	assert.Equal(suite.T(), suite.testFileShare.ShareToken, fileShare.ShareToken)
	assert.NotNil(suite.T(), fileShare.UserFile)
	assert.NotNil(suite.T(), fileShare.UserFile.File)
}

func (suite *ShareLinkServiceTestSuite) TestValidateShareToken_EmptyToken() {
	fileShare, err := suite.shareLinkService.ValidateShareToken("")

	assert.Error(suite.T(), err)
	assert.Nil(suite.T(), fileShare)
	assert.Contains(suite.T(), err.Error(), "share token cannot be empty")
}

func (suite *ShareLinkServiceTestSuite) TestValidateShareToken_InvalidFormat() {
	fileShare, err := suite.shareLinkService.ValidateShareToken("invalid_token")

	assert.Error(suite.T(), err)
	assert.Nil(suite.T(), fileShare)
	assert.Contains(suite.T(), err.Error(), "invalid share token format")
}

func (suite *ShareLinkServiceTestSuite) TestValidateShareToken_InvalidHex() {
	fileShare, err := suite.shareLinkService.ValidateShareToken("gggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggg")

	assert.Error(suite.T(), err)
	assert.Nil(suite.T(), fileShare)
	assert.Contains(suite.T(), err.Error(), "invalid share token format")
}

func (suite *ShareLinkServiceTestSuite) TestValidateShareToken_NotFound() {
	fileShare, err := suite.shareLinkService.ValidateShareToken("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")

	assert.Error(suite.T(), err)
	assert.Nil(suite.T(), fileShare)
	assert.Contains(suite.T(), err.Error(), "share not found")
}

func (suite *ShareLinkServiceTestSuite) TestValidateShareToken_Expired() {
	// Update share to be expired
	pastTime := time.Now().Add(-1 * time.Hour)
	suite.db.Model(&suite.testFileShare).Update("expires_at", pastTime)

	fileShare, err := suite.shareLinkService.ValidateShareToken(suite.testFileShare.ShareToken)

	assert.Error(suite.T(), err)
	assert.Nil(suite.T(), fileShare)
	assert.Contains(suite.T(), err.Error(), "share has expired")
}

func (suite *ShareLinkServiceTestSuite) TestValidateShareToken_DownloadLimitExceeded() {
	// Update share download count to exceed limit
	suite.db.Model(&suite.testFileShare).Update("download_count", 5)

	fileShare, err := suite.shareLinkService.ValidateShareToken(suite.testFileShare.ShareToken)

	assert.Error(suite.T(), err)
	assert.Nil(suite.T(), fileShare)
	assert.Contains(suite.T(), err.Error(), "download limit exceeded")
}

func (suite *ShareLinkServiceTestSuite) TestGetShareMetadata_Success() {
	metadata, err := suite.shareLinkService.GetShareMetadata(suite.testFileShare.ShareToken)

	assert.NoError(suite.T(), err)
	assert.NotNil(suite.T(), metadata)
	assert.Equal(suite.T(), suite.testFileShare.ShareToken, metadata.Token)
	assert.Equal(suite.T(), suite.testUserFile.Filename, metadata.Filename)
	assert.Equal(suite.T(), suite.testUserFile.MimeType, metadata.MimeType)
	assert.Equal(suite.T(), suite.testFile.SizeBytes, metadata.SizeBytes)
	assert.Equal(suite.T(), suite.testFileShare.MaxDownloads, metadata.MaxDownloads)
	assert.Equal(suite.T(), suite.testFileShare.DownloadCount, metadata.DownloadCount)
	assert.True(suite.T(), metadata.ExpiresAt.Equal(*suite.testFileShare.ExpiresAt))
	assert.True(suite.T(), metadata.CreatedAt.Equal(suite.testFileShare.CreatedAt))
}

func (suite *ShareLinkServiceTestSuite) TestGetShareMetadata_InvalidToken() {
	metadata, err := suite.shareLinkService.GetShareMetadata("invalid_token")

	assert.Error(suite.T(), err)
	assert.Nil(suite.T(), metadata)
}

func (suite *ShareLinkServiceTestSuite) TestIsExpired_WithExpiry() {
	expiredShare := suite.testFileShare
	assert.False(suite.T(), suite.shareLinkService.IsExpired(&expiredShare))

	// Set to past time
	pastTime := time.Now().Add(-1 * time.Hour)
	expiredShare.ExpiresAt = &pastTime
	assert.True(suite.T(), suite.shareLinkService.IsExpired(&expiredShare))
}

func (suite *ShareLinkServiceTestSuite) TestIsExpired_NoExpiry() {
	noExpiryShare := models.FileShare{
		ExpiresAt: nil,
	}
	assert.False(suite.T(), suite.shareLinkService.IsExpired(&noExpiryShare))
}

func (suite *ShareLinkServiceTestSuite) TestIsDownloadLimitReached_Unlimited() {
	unlimitedShare := models.FileShare{
		MaxDownloads:  -1,
		DownloadCount: 1000,
	}
	assert.False(suite.T(), suite.shareLinkService.IsDownloadLimitReached(&unlimitedShare))
}

func (suite *ShareLinkServiceTestSuite) TestIsDownloadLimitReached_Limited() {
	limitedShare := models.FileShare{
		MaxDownloads:  5,
		DownloadCount: 3,
	}
	assert.False(suite.T(), suite.shareLinkService.IsDownloadLimitReached(&limitedShare))

	limitedShare.DownloadCount = 5
	assert.True(suite.T(), suite.shareLinkService.IsDownloadLimitReached(&limitedShare))
}

func (suite *ShareLinkServiceTestSuite) TestGetRemainingDownloads_Unlimited() {
	unlimitedShare := models.FileShare{
		MaxDownloads: -1,
	}
	assert.Equal(suite.T(), -1, suite.shareLinkService.GetRemainingDownloads(&unlimitedShare))
}

func (suite *ShareLinkServiceTestSuite) TestGetRemainingDownloads_Limited() {
	limitedShare := models.FileShare{
		MaxDownloads:  5,
		DownloadCount: 2,
	}
	assert.Equal(suite.T(), 3, suite.shareLinkService.GetRemainingDownloads(&limitedShare))

	limitedShare.DownloadCount = 5
	assert.Equal(suite.T(), 0, suite.shareLinkService.GetRemainingDownloads(&limitedShare))

	limitedShare.DownloadCount = 7 // Over limit
	assert.Equal(suite.T(), 0, suite.shareLinkService.GetRemainingDownloads(&limitedShare))
}

func (suite *ShareLinkServiceTestSuite) TestGetShareExpiryInfo_NoExpiry() {
	noExpiryShare := models.FileShare{
		ExpiresAt: nil,
	}
	expiryInfo := suite.shareLinkService.GetShareExpiryInfo(&noExpiryShare)

	assert.NotNil(suite.T(), expiryInfo)
	assert.False(suite.T(), expiryInfo.Expires)
	assert.False(suite.T(), expiryInfo.Expired)
	assert.Nil(suite.T(), expiryInfo.ExpiresAt)
	assert.Nil(suite.T(), expiryInfo.TimeUntilExpiry)
}

func (suite *ShareLinkServiceTestSuite) TestGetShareExpiryInfo_WithExpiry() {
	futureTime := time.Now().Add(2 * time.Hour)
	expiryShare := models.FileShare{
		ExpiresAt: &futureTime,
	}
	expiryInfo := suite.shareLinkService.GetShareExpiryInfo(&expiryShare)

	assert.NotNil(suite.T(), expiryInfo)
	assert.True(suite.T(), expiryInfo.Expires)
	assert.False(suite.T(), expiryInfo.Expired)
	assert.Equal(suite.T(), futureTime, *expiryInfo.ExpiresAt)
	assert.NotNil(suite.T(), expiryInfo.TimeUntilExpiry)
	assert.True(suite.T(), expiryInfo.TimeUntilExpiry.Minutes() > 115) // Approximately 2 hours
}

func (suite *ShareLinkServiceTestSuite) TestGetShareExpiryInfo_Expired() {
	pastTime := time.Now().Add(-1 * time.Hour)
	expiredShare := models.FileShare{
		ExpiresAt: &pastTime,
	}
	expiryInfo := suite.shareLinkService.GetShareExpiryInfo(&expiredShare)

	assert.NotNil(suite.T(), expiryInfo)
	assert.True(suite.T(), expiryInfo.Expires)
	assert.True(suite.T(), expiryInfo.Expired)
	assert.Equal(suite.T(), pastTime, *expiryInfo.ExpiresAt)
	assert.Nil(suite.T(), expiryInfo.TimeUntilExpiry)
}

func (suite *ShareLinkServiceTestSuite) TestGenerateSecureToken() {
	token1, err := suite.shareLinkService.GenerateSecureToken()
	assert.NoError(suite.T(), err)
	assert.Len(suite.T(), token1, 64) // 32 bytes * 2 hex chars

	token2, err := suite.shareLinkService.GenerateSecureToken()
	assert.NoError(suite.T(), err)
	assert.NotEqual(suite.T(), token1, token2) // Should be unique
}

func (suite *ShareLinkServiceTestSuite) TestValidateShareURL_Valid() {
	validURL := "http://localhost:8080/v1/share/abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890"
	token, err := suite.shareLinkService.ValidateShareURL(validURL)

	assert.NoError(suite.T(), err)
	assert.Equal(suite.T(), "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890", token)
}

func (suite *ShareLinkServiceTestSuite) TestValidateShareURL_InvalidURL() {
	invalidURL := "not-a-url"
	token, err := suite.shareLinkService.ValidateShareURL(invalidURL)

	assert.Error(suite.T(), err)
	assert.Empty(suite.T(), token)
	assert.Contains(suite.T(), err.Error(), "invalid share URL format")
}

func (suite *ShareLinkServiceTestSuite) TestValidateShareURL_WrongPrefix() {
	wrongURL := "http://localhost:8080/v1/download/abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890"
	token, err := suite.shareLinkService.ValidateShareURL(wrongURL)

	assert.Error(suite.T(), err)
	assert.Empty(suite.T(), token)
	assert.Contains(suite.T(), err.Error(), "invalid share URL format")
}

func (suite *ShareLinkServiceTestSuite) TestValidateShareURL_MissingToken() {
	missingTokenURL := "http://localhost:8080/v1/share/"
	token, err := suite.shareLinkService.ValidateShareURL(missingTokenURL)

	assert.Error(suite.T(), err)
	assert.Empty(suite.T(), token)
	assert.Contains(suite.T(), err.Error(), "share token missing from URL")
}

func (suite *ShareLinkServiceTestSuite) TestCreateShare_WithAllowedUsernames() {
	allowedUsernames := []string{"alice", "bob", "charlie"}
	fileShare, err := suite.shareLinkService.CreateShare(suite.testUserFile.ID, "Password123!", 5, nil, allowedUsernames)

	assert.NoError(suite.T(), err)
	assert.NotNil(suite.T(), fileShare)
	assert.Equal(suite.T(), allowedUsernames, fileShare.AllowedUsernames)
}

func (suite *ShareLinkServiceTestSuite) TestCreateShare_WithEmptyAllowedUsernames() {
	allowedUsernames := []string{}
	fileShare, err := suite.shareLinkService.CreateShare(suite.testUserFile.ID, "Password123!", 5, nil, allowedUsernames)

	assert.NoError(suite.T(), err)
	assert.NotNil(suite.T(), fileShare)
	assert.Equal(suite.T(), allowedUsernames, fileShare.AllowedUsernames)
}

func (suite *ShareLinkServiceTestSuite) TestCreateShare_WithNilAllowedUsernames() {
	fileShare, err := suite.shareLinkService.CreateShare(suite.testUserFile.ID, "Password123!", 5, nil, nil)

	assert.NoError(suite.T(), err)
	assert.NotNil(suite.T(), fileShare)
	assert.Nil(suite.T(), fileShare.AllowedUsernames)
}

func (suite *ShareLinkServiceTestSuite) TestUpdateShare_WithAllowedUsernames() {
	// First create a share without usernames
	fileShare, err := suite.shareLinkService.CreateShare(suite.testUserFile.ID, "Password123!", 5, nil, nil)
	assert.NoError(suite.T(), err)

	// Update with usernames
	newUsernames := []string{"user1", "user2"}
	updatedShare, err := suite.shareLinkService.UpdateShare(suite.testUser.ID, fileShare.ID, nil, nil, nil, &newUsernames)

	assert.NoError(suite.T(), err)
	assert.NotNil(suite.T(), updatedShare)
	assert.Equal(suite.T(), newUsernames, updatedShare.AllowedUsernames)
}

func (suite *ShareLinkServiceTestSuite) TestUpdateShare_RemoveAllowedUsernames() {
	// First create a share with usernames
	allowedUsernames := []string{"alice", "bob"}
	fileShare, err := suite.shareLinkService.CreateShare(suite.testUserFile.ID, "Password123!", 5, nil, allowedUsernames)
	assert.NoError(suite.T(), err)

	// Update to remove usernames
	emptyUsernames := []string{}
	updatedShare, err := suite.shareLinkService.UpdateShare(suite.testUser.ID, fileShare.ID, nil, nil, nil, &emptyUsernames)

	assert.NoError(suite.T(), err)
	assert.NotNil(suite.T(), updatedShare)
	assert.Equal(suite.T(), emptyUsernames, updatedShare.AllowedUsernames)
}

func TestShareLinkServiceSuite(t *testing.T) {
	suite.Run(t, new(ShareLinkServiceTestSuite))
}
