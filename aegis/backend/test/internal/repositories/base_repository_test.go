package repositories_test

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/suite"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"

	"github.com/balkanid/aegis-backend/internal/database"
	"github.com/balkanid/aegis-backend/internal/models"
	"github.com/balkanid/aegis-backend/internal/repositories"
)

type BaseRepositoryTestSuite struct {
	suite.Suite
	db             *gorm.DB
	baseRepository *repositories.BaseRepository
	testUser       models.User
	testFile       models.File
	testUserFile   models.UserFile
}

func (suite *BaseRepositoryTestSuite) SetupSuite() {
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

	suite.baseRepository = repositories.NewBaseRepository(database.NewDB(db))
}

func (suite *BaseRepositoryTestSuite) TearDownSuite() {
	if suite.db != nil {
		sqlDB, _ := suite.db.DB()
		sqlDB.Close()
	}
}

func (suite *BaseRepositoryTestSuite) SetupTest() {
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

func (suite *BaseRepositoryTestSuite) TestNewBaseRepository() {
	db := database.NewDB(suite.db)
	repo := repositories.NewBaseRepository(db)
	assert.NotNil(suite.T(), repo)
}

func (suite *BaseRepositoryTestSuite) TestValidateOwnership_Success() {
	var result models.UserFile
	err := suite.baseRepository.ValidateOwnership(&result, suite.testUserFile.ID, suite.testUser.ID)

	assert.NoError(suite.T(), err)
	assert.Equal(suite.T(), suite.testUserFile.ID, result.ID)
	assert.Equal(suite.T(), suite.testUser.ID, result.UserID)
}

func (suite *BaseRepositoryTestSuite) TestValidateOwnership_RecordNotFound() {
	var result models.UserFile
	err := suite.baseRepository.ValidateOwnership(&result, 99999, suite.testUser.ID)

	assert.Error(suite.T(), err)
	assert.Contains(suite.T(), err.Error(), "not found or access denied")
}

func (suite *BaseRepositoryTestSuite) TestValidateOwnership_WrongUser() {
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
	err = suite.baseRepository.ValidateOwnership(&result, suite.testUserFile.ID, otherUser.ID)

	assert.Error(suite.T(), err)
	assert.Contains(suite.T(), err.Error(), "not found or access denied")
}

func (suite *BaseRepositoryTestSuite) TestValidateOwnership_DatabaseError() {
	// Close the database connection to simulate database error
	sqlDB, _ := suite.db.DB()
	sqlDB.Close()

	var result models.UserFile
	err := suite.baseRepository.ValidateOwnership(&result, suite.testUserFile.ID, suite.testUser.ID)

	assert.Error(suite.T(), err)
	assert.Contains(suite.T(), err.Error(), "database error")
}

func (suite *BaseRepositoryTestSuite) TestGetDB() {
	db := suite.baseRepository.GetDB()
	assert.NotNil(suite.T(), db)
}

func TestBaseRepositorySuite(t *testing.T) {
	suite.Run(t, new(BaseRepositoryTestSuite))
}
