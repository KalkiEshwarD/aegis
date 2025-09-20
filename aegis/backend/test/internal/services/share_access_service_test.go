package services_test

import (
	"strings"
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

type ShareAccessServiceTestSuite struct {
	suite.Suite
	db                  *gorm.DB
	shareAccessService  *services.ShareAccessService
	testUser            models.User
	testFile            models.File
	testUserFile        models.UserFile
	testFileShare       models.FileShare
}

func (suite *ShareAccessServiceTestSuite) SetupSuite() {
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

	suite.shareAccessService = services.NewShareAccessService(dbService)
}

func (suite *ShareAccessServiceTestSuite) TearDownSuite() {
	if suite.db != nil {
		sqlDB, _ := suite.db.DB()
		sqlDB.Close()
	}
}

func (suite *ShareAccessServiceTestSuite) SetupTest() {
	// Ensure tables exist (in case SetupSuite didn't create them properly)
	err := suite.db.AutoMigrate(
		&models.User{},
		&models.File{},
		&models.UserFile{},
		&models.FileShare{},
		&models.ShareAccessLog{},
	)
	suite.Require().NoError(err)

	// Reset rate limiter for each test
	suite.shareAccessService.ResetRateLimiter()

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
	err = suite.db.Create(&suite.testUser).Error
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

func (suite *ShareAccessServiceTestSuite) TestNewShareAccessService() {
	dbService := database.NewDB(suite.db)
	service := services.NewShareAccessService(dbService)
	assert.NotNil(suite.T(), service)
	assert.NotNil(suite.T(), service)
}

func (suite *ShareAccessServiceTestSuite) TestValidateAccess_Success() {
	attempt := &services.AccessAttempt{
		IPAddress:   "192.168.1.100",
		UserAgent:   "Mozilla/5.0 Test Browser",
		Token:       suite.testFileShare.ShareToken,
		Success:     false,
	}

	fileShare, err := suite.shareAccessService.ValidateAccess(attempt)

	assert.NoError(suite.T(), err)
	assert.NotNil(suite.T(), fileShare)
	assert.Equal(suite.T(), suite.testFileShare.ID, fileShare.ID)

	// Verify access log was created
	var accessLog models.ShareAccessLog
	err = suite.db.Where("file_share_id = ?", suite.testFileShare.ID).First(&accessLog).Error
	assert.NoError(suite.T(), err)
	assert.Equal(suite.T(), "192.168.1.100", accessLog.IPAddress)
	assert.Equal(suite.T(), "Mozilla/5.0 Test Browser", accessLog.UserAgent)
	assert.True(suite.T(), accessLog.Success)
}

func (suite *ShareAccessServiceTestSuite) TestValidateAccess_ShareNotFound() {
	attempt := &services.AccessAttempt{
		IPAddress: "192.168.1.100",
		UserAgent: "Test Browser",
		Token:     "nonexistent_token_123456789012345678901234567890123456789012345678901234567890",
	}

	fileShare, err := suite.shareAccessService.ValidateAccess(attempt)

	assert.Error(suite.T(), err)
	assert.Nil(suite.T(), fileShare)
	assert.Contains(suite.T(), err.Error(), "share not found")

	// Verify failed access log was created
	var accessLog models.ShareAccessLog
	err = suite.db.Where("ip_address = ?", "192.168.1.100").First(&accessLog).Error
	assert.NoError(suite.T(), err)
	assert.False(suite.T(), accessLog.Success)
	assert.Equal(suite.T(), "share not found", accessLog.FailureReason)
}

func (suite *ShareAccessServiceTestSuite) TestValidateAccess_Expired() {
	// Update share to be expired
	pastTime := time.Now().Add(-1 * time.Hour)
	suite.db.Model(&suite.testFileShare).Update("expires_at", pastTime)

	attempt := &services.AccessAttempt{
		IPAddress: "192.168.1.100",
		UserAgent: "Test Browser",
		Token:     suite.testFileShare.ShareToken,
	}

	fileShare, err := suite.shareAccessService.ValidateAccess(attempt)

	assert.Error(suite.T(), err)
	assert.Nil(suite.T(), fileShare)
	assert.Contains(suite.T(), err.Error(), "share has expired")
}

func (suite *ShareAccessServiceTestSuite) TestValidateAccess_DownloadLimitExceeded() {
	// Update share download count to exceed limit
	suite.db.Model(&suite.testFileShare).Update("download_count", 5)

	attempt := &services.AccessAttempt{
		IPAddress: "192.168.1.100",
		UserAgent: "Test Browser",
		Token:     suite.testFileShare.ShareToken,
	}

	fileShare, err := suite.shareAccessService.ValidateAccess(attempt)

	assert.Error(suite.T(), err)
	assert.Nil(suite.T(), fileShare)
	assert.Contains(suite.T(), err.Error(), "download limit exceeded")
}

func (suite *ShareAccessServiceTestSuite) TestValidateAccess_RateLimited() {
	// Make multiple rapid requests to trigger rate limiting
	attempt := &services.AccessAttempt{
		IPAddress: "192.168.1.100",
		UserAgent: "Test Browser",
		Token:     suite.testFileShare.ShareToken,
	}

	// First request should succeed
	fileShare, err := suite.shareAccessService.ValidateAccess(attempt)
	assert.NoError(suite.T(), err)
	assert.NotNil(suite.T(), fileShare)

	// Make 10 more requests rapidly (rate limit is 10 per minute)
	for i := 0; i < 10; i++ {
		fileShare, err = suite.shareAccessService.ValidateAccess(attempt)
		if i < 9 { // First 9 should succeed
			assert.NoError(suite.T(), err)
			assert.NotNil(suite.T(), fileShare)
		}
	}

	// 11th request should be rate limited
	fileShare, err = suite.shareAccessService.ValidateAccess(attempt)
	assert.Error(suite.T(), err)
	assert.Nil(suite.T(), fileShare)
	assert.Contains(suite.T(), err.Error(), "rate limit exceeded")
}

func (suite *ShareAccessServiceTestSuite) TestLogSuccessfulDownload() {
	attempt := &services.AccessAttempt{
		IPAddress:   "192.168.1.100",
		UserAgent:   "Test Browser",
		Success:     true,
	}

	err := suite.shareAccessService.LogSuccessfulDownload(suite.testFileShare.ID, attempt)

	assert.NoError(suite.T(), err)

	// Verify download count was incremented
	var updatedShare models.FileShare
	err = suite.db.First(&updatedShare, suite.testFileShare.ID).Error
	assert.NoError(suite.T(), err)
	assert.Equal(suite.T(), 1, updatedShare.DownloadCount)

	// Verify success log was created
	var accessLog models.ShareAccessLog
	err = suite.db.Where("file_share_id = ? AND success = true", suite.testFileShare.ID).First(&accessLog).Error
	assert.NoError(suite.T(), err)
	assert.Equal(suite.T(), "192.168.1.100", accessLog.IPAddress)
	assert.Empty(suite.T(), accessLog.FailureReason)
}

func (suite *ShareAccessServiceTestSuite) TestLogFailedDownload() {
	attempt := &services.AccessAttempt{
		IPAddress: "192.168.1.100",
		UserAgent: "Test Browser",
		Success:   false,
	}

	suite.shareAccessService.LogFailedDownload(suite.testFileShare.ID, attempt, "invalid password")

	// Verify failed download log was created
	var accessLog models.ShareAccessLog
	err := suite.db.Where("file_share_id = ? AND success = false", suite.testFileShare.ID).First(&accessLog).Error
	assert.NoError(suite.T(), err)
	assert.Equal(suite.T(), "192.168.1.100", accessLog.IPAddress)
	assert.Equal(suite.T(), "invalid password", accessLog.FailureReason)
}

func (suite *ShareAccessServiceTestSuite) TestIsRateLimited() {
	ipAddress := "192.168.1.100"
	token := suite.testFileShare.ShareToken

	// Initially should not be rate limited
	assert.False(suite.T(), suite.shareAccessService.IsRateLimited(ipAddress, token))

	// Make requests up to the limit
	for i := 0; i < 9; i++ {
		assert.False(suite.T(), suite.shareAccessService.IsRateLimited(ipAddress, token))
	}

	// Next request should be rate limited
	assert.True(suite.T(), suite.shareAccessService.IsRateLimited(ipAddress, token))
}

func (suite *ShareAccessServiceTestSuite) TestGetAccessStats_Success() {
	// Create some access logs
	accessLogs := []models.ShareAccessLog{
		{
			FileShareID:  suite.testFileShare.ID,
			IPAddress:    "192.168.1.100",
			UserAgent:    "Browser1",
			AttemptedAt:  time.Now(),
			Success:      true,
		},
		{
			FileShareID:  suite.testFileShare.ID,
			IPAddress:    "192.168.1.101",
			UserAgent:    "Browser2",
			AttemptedAt:  time.Now(),
			Success:      false,
		},
		{
			FileShareID:  suite.testFileShare.ID,
			IPAddress:    "192.168.1.100",
			UserAgent:    "Browser1",
			AttemptedAt:  time.Now().Add(-30 * time.Minute), // Recent
			Success:      true,
		},
	}

	for _, log := range accessLogs {
		err := suite.db.Create(&log).Error
		suite.Require().NoError(err)
	}

	stats, err := suite.shareAccessService.GetAccessStats(suite.testFileShare.ID)

	assert.NoError(suite.T(), err)
	assert.NotNil(suite.T(), stats)
	assert.Equal(suite.T(), int64(3), stats.TotalAttempts)
	assert.Equal(suite.T(), int64(2), stats.SuccessfulAttempts)
	assert.Equal(suite.T(), int64(1), stats.FailedAttempts)
	assert.Equal(suite.T(), int64(3), stats.RecentAttempts) // 3 attempts in last 24 hours
	assert.Equal(suite.T(), int64(2), stats.UniqueIPs)      // 2 unique IPs
}

func (suite *ShareAccessServiceTestSuite) TestGetAccessStats_NoLogs() {
	stats, err := suite.shareAccessService.GetAccessStats(suite.testFileShare.ID)

	assert.NoError(suite.T(), err)
	assert.NotNil(suite.T(), stats)
	assert.Equal(suite.T(), int64(0), stats.TotalAttempts)
	assert.Equal(suite.T(), int64(0), stats.SuccessfulAttempts)
	assert.Equal(suite.T(), int64(0), stats.FailedAttempts)
	assert.Equal(suite.T(), int64(0), stats.RecentAttempts)
	assert.Equal(suite.T(), int64(0), stats.UniqueIPs)
}

func (suite *ShareAccessServiceTestSuite) TestCleanOldLogs() {
	// Create old and new logs
	oldTime := time.Now().Add(-48 * time.Hour) // Older than 24 hours
	newTime := time.Now().Add(-1 * time.Hour)  // Within 24 hours

	oldLog := models.ShareAccessLog{
		FileShareID: suite.testFileShare.ID,
		IPAddress:   "192.168.1.100",
		UserAgent:   "Old Browser",
		AttemptedAt: oldTime,
		Success:     true,
	}

	newLog := models.ShareAccessLog{
		FileShareID: suite.testFileShare.ID,
		IPAddress:   "192.168.1.101",
		UserAgent:   "New Browser",
		AttemptedAt: newTime,
		Success:     true,
	}

	err := suite.db.Create(&oldLog).Error
	suite.Require().NoError(err)
	err = suite.db.Create(&newLog).Error
	suite.Require().NoError(err)

	// Clean logs older than 24 hours
	err = suite.shareAccessService.CleanOldLogs(24 * time.Hour)

	assert.NoError(suite.T(), err)

	// Verify old log was deleted
	var remainingLogs []models.ShareAccessLog
	err = suite.db.Find(&remainingLogs).Error
	assert.NoError(suite.T(), err)
	assert.Len(suite.T(), remainingLogs, 1)
	assert.Equal(suite.T(), "192.168.1.101", remainingLogs[0].IPAddress)
}

func (suite *ShareAccessServiceTestSuite) TestBlockIP() {
	// This is a placeholder test since BlockIP is not fully implemented
	err := suite.shareAccessService.BlockIP("192.168.1.100", "suspicious activity", 1*time.Hour)

	// Should not error (placeholder implementation)
	assert.NoError(suite.T(), err)
}

func (suite *ShareAccessServiceTestSuite) TestIsIPBlocked() {
	// This is a placeholder test since IsIPBlocked is not fully implemented
	assert.False(suite.T(), suite.shareAccessService.IsIPBlocked("192.168.1.100"))
}

func (suite *ShareAccessServiceTestSuite) TestSanitizeIPAddress_Valid() {
	// Test through ValidateAccess which calls sanitizeIPAddress internally
	attempt := &services.AccessAttempt{
		IPAddress:   "192.168.1.100",
		UserAgent:   "Test Browser",
		Token:       suite.testFileShare.ShareToken,
	}

	_, err := suite.shareAccessService.ValidateAccess(attempt)
	assert.NoError(suite.T(), err)

	// Verify IP was sanitized in log
	var accessLog models.ShareAccessLog
	err = suite.db.Where("file_share_id = ?", suite.testFileShare.ID).First(&accessLog).Error
	assert.NoError(suite.T(), err)
	assert.Equal(suite.T(), "192.168.1.100", accessLog.IPAddress)
}

func (suite *ShareAccessServiceTestSuite) TestSanitizeIPAddress_Invalid() {
	// Test through ValidateAccess which calls sanitizeIPAddress internally
	attempt := &services.AccessAttempt{
		IPAddress:   "invalid-ip",
		UserAgent:   "Test Browser",
		Token:       suite.testFileShare.ShareToken,
	}

	_, err := suite.shareAccessService.ValidateAccess(attempt)
	assert.NoError(suite.T(), err)

	// Verify invalid IP was sanitized to "invalid"
	var accessLog models.ShareAccessLog
	err = suite.db.Where("file_share_id = ?", suite.testFileShare.ID).First(&accessLog).Error
	assert.NoError(suite.T(), err)
	assert.Equal(suite.T(), "invalid", accessLog.IPAddress)
}

func (suite *ShareAccessServiceTestSuite) TestSanitizeUserAgent_Valid() {
	attempt := &services.AccessAttempt{
		IPAddress:   "192.168.1.100",
		UserAgent:   "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
		Token:       suite.testFileShare.ShareToken,
	}

	_, err := suite.shareAccessService.ValidateAccess(attempt)
	assert.NoError(suite.T(), err)

	// Verify user agent was stored
	var accessLog models.ShareAccessLog
	err = suite.db.Where("file_share_id = ?", suite.testFileShare.ID).First(&accessLog).Error
	assert.NoError(suite.T(), err)
	assert.Equal(suite.T(), "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36", accessLog.UserAgent)
}

func (suite *ShareAccessServiceTestSuite) TestSanitizeUserAgent_Empty() {
	attempt := &services.AccessAttempt{
		IPAddress:   "192.168.1.100",
		UserAgent:   "",
		Token:       suite.testFileShare.ShareToken,
	}

	_, err := suite.shareAccessService.ValidateAccess(attempt)
	assert.NoError(suite.T(), err)

	// Verify empty user agent was set to "unknown"
	var accessLog models.ShareAccessLog
	err = suite.db.Where("file_share_id = ?", suite.testFileShare.ID).First(&accessLog).Error
	assert.NoError(suite.T(), err)
	assert.Equal(suite.T(), "unknown", accessLog.UserAgent)
}

func (suite *ShareAccessServiceTestSuite) TestSanitizeUserAgent_Long() {
	longUserAgent := strings.Repeat("a", 600) // Longer than 500 chars
	attempt := &services.AccessAttempt{
		IPAddress:   "192.168.1.100",
		UserAgent:   longUserAgent,
		Token:       suite.testFileShare.ShareToken,
	}

	_, err := suite.shareAccessService.ValidateAccess(attempt)
	assert.NoError(suite.T(), err)

	// Verify long user agent was truncated
	var accessLog models.ShareAccessLog
	err = suite.db.Where("file_share_id = ?", suite.testFileShare.ID).First(&accessLog).Error
	assert.NoError(suite.T(), err)
	assert.Len(suite.T(), accessLog.UserAgent, 500)
}

func TestShareAccessServiceSuite(t *testing.T) {
	suite.Run(t, new(ShareAccessServiceTestSuite))
}