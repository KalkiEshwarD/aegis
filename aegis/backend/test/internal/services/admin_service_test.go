package services_test

import (
	"fmt"
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

type AdminServiceTestSuite struct {
	suite.Suite
	db           *gorm.DB
	adminService *services.AdminService
}

func (suite *AdminServiceTestSuite) SetupSuite() {
	// Create in-memory SQLite database for testing
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	suite.Require().NoError(err)

	suite.db = db

	// Set the database connection for the database package
	dbService := database.NewDB(db)
	database.SetDB(dbService)

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

	suite.adminService = services.NewAdminService(dbService)
}

func (suite *AdminServiceTestSuite) TearDownSuite() {
	if suite.db != nil {
		sqlDB, _ := suite.db.DB()
		sqlDB.Close()
	}
}

func (suite *AdminServiceTestSuite) SetupTest() {
	// Clean database before each test
	suite.db.Exec("DELETE FROM download_logs")
	suite.db.Exec("DELETE FROM room_files")
	suite.db.Exec("DELETE FROM room_members")
	suite.db.Exec("DELETE FROM user_files")
	suite.db.Exec("DELETE FROM rooms")
	suite.db.Exec("DELETE FROM files")
	suite.db.Exec("DELETE FROM users")
}

func (suite *AdminServiceTestSuite) TestNewAdminService() {
	service := services.NewAdminService(database.NewDB(suite.db))
	assert.NotNil(suite.T(), service)
}

func (suite *AdminServiceTestSuite) TestGetDashboardStats_EmptyDatabase() {
	stats, err := suite.adminService.GetDashboardStats()

	assert.NoError(suite.T(), err)
	assert.NotNil(suite.T(), stats)
	assert.Equal(suite.T(), 0, stats.TotalUsers)
	assert.Equal(suite.T(), 0, stats.TotalFiles)
	assert.Equal(suite.T(), 0, stats.TotalStorageUsed)
	assert.Empty(suite.T(), stats.RecentUploads)
}

func (suite *AdminServiceTestSuite) TestGetDashboardStats_WithData() {
	// Create test users
	user1 := models.User{
		Email:        "user1@example.com",
		Username:     "user1",
		PasswordHash: "hash1",
		StorageQuota: 10485760,
		UsedStorage:  1024,
		IsAdmin:      false,
	}
	user2 := models.User{
		Email:        "user2@example.com",
		Username:     "user2",
		PasswordHash: "hash2",
		StorageQuota: 10485760,
		UsedStorage:  2048,
		IsAdmin:      true,
	}

	err := suite.db.Create(&user1).Error
	suite.Require().NoError(err)
	err = suite.db.Create(&user2).Error
	suite.Require().NoError(err)

	// Create test files
	file1 := models.File{
		ContentHash: "hash1",
		SizeBytes:   1024,
		StoragePath: "/path/to/file1",
	}
	file2 := models.File{
		ContentHash: "hash2",
		SizeBytes:   2048,
		StoragePath: "/path/to/file2",
	}

	err = suite.db.Create(&file1).Error
	suite.Require().NoError(err)
	err = suite.db.Create(&file2).Error
	suite.Require().NoError(err)

	// Create test user files
	userFile1 := models.UserFile{
		UserID:        user1.ID,
		FileID:        file1.ID,
		Filename:      "file1.txt",
		MimeType:      "text/plain",
		EncryptionKey: "key1",
		CreatedAt:     time.Now().Add(-2 * time.Hour),
	}
	userFile2 := models.UserFile{
		UserID:        user2.ID,
		FileID:        file2.ID,
		Filename:      "file2.txt",
		MimeType:      "text/plain",
		EncryptionKey: "key2",
		CreatedAt:     time.Now().Add(-1 * time.Hour),
	}

	err = suite.db.Create(&userFile1).Error
	suite.Require().NoError(err)
	err = suite.db.Create(&userFile2).Error
	suite.Require().NoError(err)

	// Get dashboard stats
	stats, err := suite.adminService.GetDashboardStats()

	assert.NoError(suite.T(), err)
	assert.NotNil(suite.T(), stats)
	assert.Equal(suite.T(), 2, stats.TotalUsers)
	assert.Equal(suite.T(), 2, stats.TotalFiles)
	assert.Equal(suite.T(), int(user1.UsedStorage+user2.UsedStorage), stats.TotalStorageUsed)
	assert.Len(suite.T(), stats.RecentUploads, 2)

	// Verify recent uploads are ordered by creation time (newest first)
	assert.True(suite.T(), stats.RecentUploads[0].CreatedAt.After(stats.RecentUploads[1].CreatedAt))
}

func (suite *AdminServiceTestSuite) TestGetDashboardStats_RecentUploadsLimit() {
	// Create test user
	user := models.User{
		Email:        "user@example.com",
		Username:     "testuser",
		PasswordHash: "hash",
		StorageQuota: 10485760,
		UsedStorage:  0,
		IsAdmin:      false,
	}
	err := suite.db.Create(&user).Error
	suite.Require().NoError(err)

	// Create 15 files and user files (more than the limit of 10)
	for i := 0; i < 15; i++ {
		file := models.File{
			ContentHash: fmt.Sprintf("hash%d", i),
			SizeBytes:   1024,
			StoragePath: fmt.Sprintf("/path/to/file%d", i),
		}
		err = suite.db.Create(&file).Error
		suite.Require().NoError(err)

		userFile := models.UserFile{
			UserID:        user.ID,
			FileID:        file.ID,
			Filename:      fmt.Sprintf("file%d.txt", i),
			MimeType:      "text/plain",
			EncryptionKey: fmt.Sprintf("key%d", i),
			CreatedAt:     time.Now().Add(time.Duration(-i) * time.Hour),
		}
		err = suite.db.Create(&userFile).Error
		suite.Require().NoError(err)
	}

	// Get dashboard stats
	stats, err := suite.adminService.GetDashboardStats()

	assert.NoError(suite.T(), err)
	assert.NotNil(suite.T(), stats)
	assert.Equal(suite.T(), 1, stats.TotalUsers)
	assert.Equal(suite.T(), 15, stats.TotalFiles)

	// Should only return the 10 most recent uploads
	assert.Len(suite.T(), stats.RecentUploads, 10)

	// Verify uploads are ordered by creation time (newest first)
	for i := 0; i < len(stats.RecentUploads)-1; i++ {
		assert.True(suite.T(),
			stats.RecentUploads[i].CreatedAt.After(stats.RecentUploads[i+1].CreatedAt) ||
				stats.RecentUploads[i].CreatedAt.Equal(stats.RecentUploads[i+1].CreatedAt))
	}
}

func (suite *AdminServiceTestSuite) TestGetDashboardStats_WithPreloadedData() {
	// Create test user
	user := models.User{
		Email:        "user@example.com",
		Username:     "testuser2",
		PasswordHash: "hash",
		StorageQuota: 10485760,
		UsedStorage:  1024,
		IsAdmin:      false,
	}
	err := suite.db.Create(&user).Error
	suite.Require().NoError(err)

	// Create test file
	file := models.File{
		ContentHash: "hash1",
		SizeBytes:   1024,
		StoragePath: "/path/to/file1",
	}
	err = suite.db.Create(&file).Error
	suite.Require().NoError(err)

	// Create test user file
	userFile := models.UserFile{
		UserID:        user.ID,
		FileID:        file.ID,
		Filename:      "file1.txt",
		MimeType:      "text/plain",
		EncryptionKey: "key1",
	}
	err = suite.db.Create(&userFile).Error
	suite.Require().NoError(err)

	// Get dashboard stats
	stats, err := suite.adminService.GetDashboardStats()

	assert.NoError(suite.T(), err)
	assert.NotNil(suite.T(), stats)
	assert.Len(suite.T(), stats.RecentUploads, 1)

	// Verify that User and File associations are preloaded
	recentUpload := stats.RecentUploads[0]
	assert.Equal(suite.T(), user.Email, recentUpload.User.Email)
	assert.Equal(suite.T(), file.ContentHash, recentUpload.File.ContentHash)
}

func (suite *AdminServiceTestSuite) TestGetDashboardStats_NullStorageHandling() {
	// Create user with zero used storage to test COALESCE function
	user := models.User{
		Email:        "user@example.com",
		Username:     "testuser3",
		PasswordHash: "hash",
		StorageQuota: 10485760,
		UsedStorage:  0, // This should be handled by COALESCE
		IsAdmin:      false,
	}
	err := suite.db.Create(&user).Error
	suite.Require().NoError(err)

	// Get dashboard stats
	stats, err := suite.adminService.GetDashboardStats()

	assert.NoError(suite.T(), err)
	assert.NotNil(suite.T(), stats)
	assert.Equal(suite.T(), 1, stats.TotalUsers)
	assert.Equal(suite.T(), 0, stats.TotalStorageUsed) // Should be 0, not nil
}

func TestAdminServiceSuite(t *testing.T) {
	suite.Run(t, new(AdminServiceTestSuite))
}
