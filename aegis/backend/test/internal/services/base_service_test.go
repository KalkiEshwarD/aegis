package services_test

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/suite"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"

	"github.com/balkanid/aegis-backend/internal/database"
	"github.com/balkanid/aegis-backend/internal/models"
	"github.com/balkanid/aegis-backend/internal/services"
)

type BaseServiceTestSuite struct {
	suite.Suite
	db           *gorm.DB
	baseService  *services.BaseService
	testUser     models.User
	testFile     models.File
	testUserFile models.UserFile
}

func (suite *BaseServiceTestSuite) SetupSuite() {
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
	)
	suite.Require().NoError(err)

	suite.baseService = services.NewBaseService(database.NewDB(db))
}

func (suite *BaseServiceTestSuite) TearDownSuite() {
	if suite.db != nil {
		sqlDB, _ := suite.db.DB()
		sqlDB.Close()
	}
}

func (suite *BaseServiceTestSuite) SetupTest() {
	// Clean database before each test
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
		EncryptionKey: "test_encryption_key",
	}
	err = suite.db.Create(&suite.testUserFile).Error
	suite.Require().NoError(err)
}

func (suite *BaseServiceTestSuite) TestNewBaseService() {
	db := database.NewDB(suite.db)
	service := services.NewBaseService(db)
	assert.NotNil(suite.T(), service)
}

func (suite *BaseServiceTestSuite) TestValidateOwnership_Success() {
	var result models.UserFile
	err := suite.baseService.ValidateOwnership(&result, suite.testUserFile.ID, suite.testUser.ID)

	assert.NoError(suite.T(), err)
	assert.Equal(suite.T(), suite.testUserFile.ID, result.ID)
	assert.Equal(suite.T(), suite.testUser.ID, result.UserID)
}

func (suite *BaseServiceTestSuite) TestValidateOwnership_RecordNotFound() {
	var result models.UserFile
	err := suite.baseService.ValidateOwnership(&result, 99999, suite.testUser.ID)

	assert.Error(suite.T(), err)
	assert.Contains(suite.T(), err.Error(), "not found or access denied")
}

func (suite *BaseServiceTestSuite) TestValidateOwnership_WrongUser() {
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

	var result models.UserFile
	err = suite.baseService.ValidateOwnership(&result, suite.testUserFile.ID, otherUser.ID)

	assert.Error(suite.T(), err)
	assert.Contains(suite.T(), err.Error(), "not found or access denied")
}

func (suite *BaseServiceTestSuite) TestValidateOwnership_DatabaseError() {
	// Close the database connection to simulate database error
	sqlDB, _ := suite.db.DB()
	sqlDB.Close()

	var result models.UserFile
	err := suite.baseService.ValidateOwnership(&result, suite.testUserFile.ID, suite.testUser.ID)

	assert.Error(suite.T(), err)
	assert.Contains(suite.T(), err.Error(), "database error")
}

func TestBaseServiceSuite(t *testing.T) {
	suite.Run(t, new(BaseServiceTestSuite))
}
