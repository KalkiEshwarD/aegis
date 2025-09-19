package repositories_test

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/suite"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"

	"github.com/balkanid/aegis-backend/internal/database"
	"github.com/balkanid/aegis-backend/internal/models"
	"github.com/balkanid/aegis-backend/internal/repositories"
)

type UserResourceRepositoryTestSuite struct {
	suite.Suite
	db                      *gorm.DB
	userResourceRepository *repositories.UserResourceRepository
	testUser               models.User
	testFile               models.File
	testUserFile           models.UserFile
	testFolder             models.Folder
}

func (suite *UserResourceRepositoryTestSuite) SetupSuite() {
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

	suite.userResourceRepository = repositories.NewUserResourceRepository(database.NewDB(db))
}

func (suite *UserResourceRepositoryTestSuite) TearDownSuite() {
	if suite.db != nil {
		sqlDB, _ := suite.db.DB()
		sqlDB.Close()
	}
}

func (suite *UserResourceRepositoryTestSuite) SetupTest() {
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

	// Create test file
	suite.testFile = models.File{
		ContentHash: "test_hash_123",
		SizeBytes:   1024,
		StoragePath: "/mock/path/test_file.txt",
	}
	err = suite.db.Create(&suite.testFile).Error
	suite.Require().NoError(err)

	// Create test folder
	suite.testFolder = models.Folder{
		UserID: suite.testUser.ID,
		Name:   "Test Folder",
	}
	err = suite.db.Create(&suite.testFolder).Error
	suite.Require().NoError(err)

	// Create test user file
	suite.testUserFile = models.UserFile{
		UserID:        suite.testUser.ID,
		FileID:        suite.testFile.ID,
		FolderID:      &suite.testFolder.ID,
		Filename:      "test_file.txt",
		MimeType:      "text/plain",
		EncryptionKey: "test_encryption_key",
	}
	err = suite.db.Create(&suite.testUserFile).Error
	suite.Require().NoError(err)
}

func (suite *UserResourceRepositoryTestSuite) TestNewUserResourceRepository() {
	db := database.NewDB(suite.db)
	repo := repositories.NewUserResourceRepository(db)
	assert.NotNil(suite.T(), repo)
}

func (suite *UserResourceRepositoryTestSuite) TestGetUserFiles_Success() {
	files, err := suite.userResourceRepository.GetUserFiles(suite.testUser.ID, false)

	assert.NoError(suite.T(), err)
	assert.Len(suite.T(), files, 1)
	assert.Equal(suite.T(), suite.testUserFile.ID, files[0].ID)
	assert.Equal(suite.T(), suite.testUserFile.Filename, files[0].Filename)
}

func (suite *UserResourceRepositoryTestSuite) TestGetUserFiles_IncludeTrashed() {
	// Soft delete the file
	err := suite.db.Delete(&suite.testUserFile).Error
	suite.Require().NoError(err)

	files, err := suite.userResourceRepository.GetUserFiles(suite.testUser.ID, true)

	assert.NoError(suite.T(), err)
	assert.Len(suite.T(), files, 1)
	assert.Equal(suite.T(), suite.testUserFile.ID, files[0].ID)
}

func (suite *UserResourceRepositoryTestSuite) TestGetUserFiles_ExcludeTrashed() {
	// Soft delete the file
	err := suite.db.Delete(&suite.testUserFile).Error
	suite.Require().NoError(err)

	files, err := suite.userResourceRepository.GetUserFiles(suite.testUser.ID, false)

	assert.NoError(suite.T(), err)
	assert.Empty(suite.T(), files)
}

func (suite *UserResourceRepositoryTestSuite) TestGetUserFileByID_Success() {
	file, err := suite.userResourceRepository.GetUserFileByID(suite.testUser.ID, suite.testUserFile.ID, false)

	assert.NoError(suite.T(), err)
	assert.NotNil(suite.T(), file)
	assert.Equal(suite.T(), suite.testUserFile.ID, file.ID)
	assert.Equal(suite.T(), suite.testUserFile.Filename, file.Filename)
}

func (suite *UserResourceRepositoryTestSuite) TestGetUserFileByID_NotFound() {
	file, err := suite.userResourceRepository.GetUserFileByID(suite.testUser.ID, 99999, false)

	assert.Error(suite.T(), err)
	assert.Nil(suite.T(), file)
	assert.Contains(suite.T(), err.Error(), "file not found")
}

func (suite *UserResourceRepositoryTestSuite) TestGetUserFileByID_WrongUser() {
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

	file, err := suite.userResourceRepository.GetUserFileByID(otherUser.ID, suite.testUserFile.ID, false)

	assert.Error(suite.T(), err)
	assert.Nil(suite.T(), file)
	assert.Contains(suite.T(), err.Error(), "file not found")
}

func (suite *UserResourceRepositoryTestSuite) TestGetUserFolders_Success() {
	folders, err := suite.userResourceRepository.GetUserFolders(suite.testUser.ID)

	assert.NoError(suite.T(), err)
	assert.Len(suite.T(), folders, 1)
	assert.Equal(suite.T(), suite.testFolder.ID, folders[0].ID)
	assert.Equal(suite.T(), suite.testFolder.Name, folders[0].Name)
}

func (suite *UserResourceRepositoryTestSuite) TestGetUserFolderByID_Success() {
	folder, err := suite.userResourceRepository.GetUserFolderByID(suite.testUser.ID, suite.testFolder.ID)

	assert.NoError(suite.T(), err)
	assert.NotNil(suite.T(), folder)
	assert.Equal(suite.T(), suite.testFolder.ID, folder.ID)
	assert.Equal(suite.T(), suite.testFolder.Name, folder.Name)
}

func (suite *UserResourceRepositoryTestSuite) TestGetUserFolderByID_NotFound() {
	folder, err := suite.userResourceRepository.GetUserFolderByID(suite.testUser.ID, 99999)

	assert.Error(suite.T(), err)
	assert.Nil(suite.T(), folder)
	assert.Contains(suite.T(), err.Error(), "folder not found")
}

func (suite *UserResourceRepositoryTestSuite) TestFindUserFilesWithFilters_Filename() {
	filters := map[string]interface{}{
		"filename": stringPtr("test"),
	}
	files, err := suite.userResourceRepository.FindUserFilesWithFilters(suite.testUser.ID, filters)

	assert.NoError(suite.T(), err)
	assert.Len(suite.T(), files, 1)
	assert.Equal(suite.T(), suite.testUserFile.ID, files[0].ID)
}

func (suite *UserResourceRepositoryTestSuite) TestFindUserFilesWithFilters_MimeType() {
	filters := map[string]interface{}{
		"mime_type": stringPtr("text/plain"),
	}
	files, err := suite.userResourceRepository.FindUserFilesWithFilters(suite.testUser.ID, filters)

	assert.NoError(suite.T(), err)
	assert.Len(suite.T(), files, 1)
	assert.Equal(suite.T(), suite.testUserFile.ID, files[0].ID)
}

func (suite *UserResourceRepositoryTestSuite) TestFindUserFilesWithFilters_SizeRange() {
	minSize := int64Ptr(512)
	maxSize := int64Ptr(2048)
	filters := map[string]interface{}{
		"min_size": minSize,
		"max_size": maxSize,
	}
	files, err := suite.userResourceRepository.FindUserFilesWithFilters(suite.testUser.ID, filters)

	assert.NoError(suite.T(), err)
	assert.Len(suite.T(), files, 1)
	assert.Equal(suite.T(), suite.testUserFile.ID, files[0].ID)
}

func (suite *UserResourceRepositoryTestSuite) TestFindUserFilesWithFilters_DateRange() {
	now := time.Now()
	filters := map[string]interface{}{
		"date_from": now.Add(-time.Hour),
		"date_to":   now.Add(time.Hour),
	}
	files, err := suite.userResourceRepository.FindUserFilesWithFilters(suite.testUser.ID, filters)

	assert.NoError(suite.T(), err)
	assert.Len(suite.T(), files, 1)
	assert.Equal(suite.T(), suite.testUserFile.ID, files[0].ID)
}

func (suite *UserResourceRepositoryTestSuite) TestFindUserFilesWithFilters_NoMatches() {
	filters := map[string]interface{}{
		"filename": stringPtr("nonexistent"),
	}
	files, err := suite.userResourceRepository.FindUserFilesWithFilters(suite.testUser.ID, filters)

	assert.NoError(suite.T(), err)
	assert.Empty(suite.T(), files)
}

// Helper functions
func stringPtr(s string) *string {
	return &s
}

func int64Ptr(i int64) *int64 {
	return &i
}

func TestUserResourceRepositorySuite(t *testing.T) {
	suite.Run(t, new(UserResourceRepositoryTestSuite))
}