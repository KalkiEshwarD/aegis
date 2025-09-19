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

type ValidationServiceTestSuite struct {
	suite.Suite
	db               *gorm.DB
	validationService *services.ValidationService
	testUser         models.User
	testFolder       models.Folder
	testUserFile     models.UserFile
}

func (suite *ValidationServiceTestSuite) SetupSuite() {
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
		&models.Folder{},
	)
	suite.Require().NoError(err)

	suite.validationService = services.NewValidationService(database.NewDB(db))
}

func (suite *ValidationServiceTestSuite) TearDownSuite() {
	if suite.db != nil {
		sqlDB, _ := suite.db.DB()
		sqlDB.Close()
	}
}

func (suite *ValidationServiceTestSuite) SetupTest() {
	// Clean database before each test
	suite.db.Exec("DELETE FROM user_files")
	suite.db.Exec("DELETE FROM files")
	suite.db.Exec("DELETE FROM folders")
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

	// Create test folder
	suite.testFolder = models.Folder{
		UserID: suite.testUser.ID,
		Name:   "Test Folder",
	}
	err = suite.db.Create(&suite.testFolder).Error
	suite.Require().NoError(err)

	// Create test file
	testFile := models.File{
		ContentHash: "test_hash_123",
		SizeBytes:   1024,
		StoragePath: "/mock/path/test_file.txt",
	}
	err = suite.db.Create(&testFile).Error
	suite.Require().NoError(err)

	// Create test user file
	suite.testUserFile = models.UserFile{
		UserID:        suite.testUser.ID,
		FileID:        testFile.ID,
		FolderID:      &suite.testFolder.ID,
		Filename:      "test_file.txt",
		MimeType:      "text/plain",
		EncryptionKey: "test_encryption_key",
	}
	err = suite.db.Create(&suite.testUserFile).Error
	suite.Require().NoError(err)
}

func (suite *ValidationServiceTestSuite) TestNewValidationService() {
	db := database.NewDB(suite.db)
	service := services.NewValidationService(db)
	assert.NotNil(suite.T(), service)
}

func (suite *ValidationServiceTestSuite) TestCheckDuplicateName_NoDuplicate_RootLevel() {
	err := suite.validationService.CheckDuplicateName("folders", "name", "parent_id", suite.testUser.ID, "New Folder", nil, nil)

	assert.NoError(suite.T(), err)
}

func (suite *ValidationServiceTestSuite) TestCheckDuplicateName_NoDuplicate_InFolder() {
	folderID := suite.testFolder.ID
	err := suite.validationService.CheckDuplicateName("user_files", "filename", "folder_id", suite.testUser.ID, "new_file.txt", &folderID, nil)

	assert.NoError(suite.T(), err)
}

func (suite *ValidationServiceTestSuite) TestCheckDuplicateName_Duplicate_RootLevel() {
	// Try to create folder with same name as existing
	err := suite.validationService.CheckDuplicateName("folders", "name", "parent_id", suite.testUser.ID, "Test Folder", nil, nil)

	assert.Error(suite.T(), err)
	assert.Contains(suite.T(), err.Error(), "name with this name already exists in the specified location")
}

func (suite *ValidationServiceTestSuite) TestCheckDuplicateName_Duplicate_InFolder() {
	// Try to create file with same name in same folder
	folderID := suite.testFolder.ID
	err := suite.validationService.CheckDuplicateName("user_files", "filename", "folder_id", suite.testUser.ID, "test_file.txt", &folderID, nil)

	assert.Error(suite.T(), err)
	assert.Contains(suite.T(), err.Error(), "filename with this name already exists in the specified location")
}

func (suite *ValidationServiceTestSuite) TestCheckDuplicateName_WithExcludeID() {
	// Should allow "renaming" to same name (exclude self)
	folderID := suite.testFolder.ID
	err := suite.validationService.CheckDuplicateName("user_files", "filename", "folder_id", suite.testUser.ID, "test_file.txt", &folderID, &suite.testUserFile.ID)

	assert.NoError(suite.T(), err)
}

func (suite *ValidationServiceTestSuite) TestCheckDuplicateName_SameNameDifferentLocation() {
	// Same name in root should be allowed (different location)
	err := suite.validationService.CheckDuplicateName("user_files", "filename", "folder_id", suite.testUser.ID, "test_file.txt", nil, nil)

	assert.NoError(suite.T(), err)
}

func (suite *ValidationServiceTestSuite) TestCheckDuplicateName_DatabaseError() {
	// Close the database connection to simulate database error
	sqlDB, _ := suite.db.DB()
	sqlDB.Close()

	err := suite.validationService.CheckDuplicateName("folders", "name", "parent_id", suite.testUser.ID, "New Folder", nil, nil)

	assert.Error(suite.T(), err)
	assert.Contains(suite.T(), err.Error(), "database error")
}

func TestValidationServiceSuite(t *testing.T) {
	suite.Run(t, new(ValidationServiceTestSuite))
}