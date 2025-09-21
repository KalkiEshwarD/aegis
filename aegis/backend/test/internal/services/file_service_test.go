package services_test

import (
	"testing"

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
	db           *gorm.DB
	fileService *services.FileService
	testUser     models.User
	testFile     models.File
	testUserFile models.UserFile
	testFolder   models.Folder
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
		&models.Folder{},
	)
	suite.Require().NoError(err)

	cfg := &config.Config{}
	dbService := database.NewDB(db)
	fileStorageService := services.NewFileStorageService(nil, "")
	authService := services.NewAuthService(cfg)
	suite.fileService = services.NewFileService(cfg, dbService, fileStorageService, authService)
}

func (suite *FileServiceTestSuite) TearDownSuite() {
	if suite.db != nil {
		sqlDB, _ := suite.db.DB()
		sqlDB.Close()
	}
}

func (suite *FileServiceTestSuite) SetupTest() {
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
		Filename:      "test_file.txt",
		MimeType:      "text/plain",
		EncryptionKey: "test_encryption_key",
	}
	err = suite.db.Create(&suite.testUserFile).Error
	suite.Require().NoError(err)
}

func (suite *FileServiceTestSuite) TestNewFileService() {
	cfg := &config.Config{}
	db := database.NewDB(suite.db)
	fileStorageService := services.NewFileStorageService(nil, "")
	authService := services.NewAuthService(cfg)
	service := services.NewFileService(cfg, db, fileStorageService, authService)
	assert.NotNil(suite.T(), service)
}

func (suite *FileServiceTestSuite) TestMoveFile_Success_MoveToFolder() {
	err := suite.fileService.MoveFile(suite.testUser.ID, suite.testUserFile.ID, &suite.testFolder.ID)

	assert.NoError(suite.T(), err)

	// Verify the file was moved
	var updatedUserFile models.UserFile
	err = suite.db.First(&updatedUserFile, suite.testUserFile.ID).Error
	assert.NoError(suite.T(), err)
	assert.Equal(suite.T(), suite.testFolder.ID, *updatedUserFile.FolderID)
}

func (suite *FileServiceTestSuite) TestMoveFile_Success_MoveToRoot() {
	// First move to folder
	err := suite.fileService.MoveFile(suite.testUser.ID, suite.testUserFile.ID, &suite.testFolder.ID)
	assert.NoError(suite.T(), err)

	// Then move to root (nil folder)
	err = suite.fileService.MoveFile(suite.testUser.ID, suite.testUserFile.ID, nil)
	assert.NoError(suite.T(), err)

	// Verify the file was moved to root
	var updatedUserFile models.UserFile
	err = suite.db.First(&updatedUserFile, suite.testUserFile.ID).Error
	assert.NoError(suite.T(), err)
	assert.Nil(suite.T(), updatedUserFile.FolderID)
}

func (suite *FileServiceTestSuite) TestMoveFile_FileNotFound() {
	err := suite.fileService.MoveFile(suite.testUser.ID, 99999, &suite.testFolder.ID)

	assert.Error(suite.T(), err)
	assert.Contains(suite.T(), err.Error(), "not found or access denied")
}

func (suite *FileServiceTestSuite) TestMoveFile_WrongUser() {
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

	err = suite.fileService.MoveFile(otherUser.ID, suite.testUserFile.ID, &suite.testFolder.ID)

	assert.Error(suite.T(), err)
	assert.Contains(suite.T(), err.Error(), "not found or access denied")
}

func (suite *FileServiceTestSuite) TestMoveFile_FolderNotFound() {
	nonExistentFolderID := uint(99999)
	err := suite.fileService.MoveFile(suite.testUser.ID, suite.testUserFile.ID, &nonExistentFolderID)

	assert.Error(suite.T(), err)
	assert.Contains(suite.T(), err.Error(), "not found or access denied")
}

func (suite *FileServiceTestSuite) TestMoveFile_FolderWrongUser() {
	// Create another user and folder
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

	otherFolder := models.Folder{
		UserID: otherUser.ID,
		Name:   "Other Folder",
	}
	err = suite.db.Create(&otherFolder).Error
	suite.Require().NoError(err)

	err = suite.fileService.MoveFile(suite.testUser.ID, suite.testUserFile.ID, &otherFolder.ID)

	assert.Error(suite.T(), err)
	assert.Contains(suite.T(), err.Error(), "not found or access denied")
}

func (suite *FileServiceTestSuite) TestMoveFile_DatabaseError() {
	// Close the database connection to simulate database error
	sqlDB, _ := suite.db.DB()
	sqlDB.Close()

	err := suite.fileService.MoveFile(suite.testUser.ID, suite.testUserFile.ID, &suite.testFolder.ID)

	assert.Error(suite.T(), err)
	assert.Contains(suite.T(), err.Error(), "database error")
}

func (suite *FileServiceTestSuite) TestStarFile_Success() {
	err := suite.fileService.StarFile(suite.testUser.ID, suite.testUserFile.ID)

	assert.NoError(suite.T(), err)

	// Verify the file was starred
	var updatedUserFile models.UserFile
	err = suite.db.First(&updatedUserFile, suite.testUserFile.ID).Error
	assert.NoError(suite.T(), err)
	assert.True(suite.T(), updatedUserFile.IsStarred)
}

func (suite *FileServiceTestSuite) TestStarFile_FileNotFound() {
	err := suite.fileService.StarFile(suite.testUser.ID, 99999)

	assert.Error(suite.T(), err)
	assert.Contains(suite.T(), err.Error(), "not found or access denied")
}

func (suite *FileServiceTestSuite) TestStarFile_WrongUser() {
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

	err = suite.fileService.StarFile(otherUser.ID, suite.testUserFile.ID)

	assert.Error(suite.T(), err)
	assert.Contains(suite.T(), err.Error(), "not found or access denied")
}

func (suite *FileServiceTestSuite) TestUnstarFile_Success() {
	// First star the file
	err := suite.fileService.StarFile(suite.testUser.ID, suite.testUserFile.ID)
	assert.NoError(suite.T(), err)

	// Then unstar it
	err = suite.fileService.UnstarFile(suite.testUser.ID, suite.testUserFile.ID)
	assert.NoError(suite.T(), err)

	// Verify the file was unstarred
	var updatedUserFile models.UserFile
	err = suite.db.First(&updatedUserFile, suite.testUserFile.ID).Error
	assert.NoError(suite.T(), err)
	assert.False(suite.T(), updatedUserFile.IsStarred)
}

func (suite *FileServiceTestSuite) TestUnstarFile_FileNotFound() {
	err := suite.fileService.UnstarFile(suite.testUser.ID, 99999)

	assert.Error(suite.T(), err)
	assert.Contains(suite.T(), err.Error(), "not found or access denied")
}

func (suite *FileServiceTestSuite) TestUnstarFile_WrongUser() {
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

	err = suite.fileService.UnstarFile(otherUser.ID, suite.testUserFile.ID)

	assert.Error(suite.T(), err)
	assert.Contains(suite.T(), err.Error(), "not found or access denied")
}

func (suite *FileServiceTestSuite) TestStarFolder_Success() {
	err := suite.fileService.StarFolder(suite.testUser.ID, suite.testFolder.ID)

	assert.NoError(suite.T(), err)

	// Verify the folder was starred
	var updatedFolder models.Folder
	err = suite.db.First(&updatedFolder, suite.testFolder.ID).Error
	assert.NoError(suite.T(), err)
	assert.True(suite.T(), updatedFolder.IsStarred)
}

func (suite *FileServiceTestSuite) TestStarFolder_FolderNotFound() {
	err := suite.fileService.StarFolder(suite.testUser.ID, 99999)

	assert.Error(suite.T(), err)
	assert.Contains(suite.T(), err.Error(), "not found or access denied")
}

func (suite *FileServiceTestSuite) TestStarFolder_WrongUser() {
	// Create another user and folder
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

	otherFolder := models.Folder{
		UserID: otherUser.ID,
		Name:   "Other Folder",
	}
	err = suite.db.Create(&otherFolder).Error
	suite.Require().NoError(err)

	err = suite.fileService.StarFolder(suite.testUser.ID, otherFolder.ID)

	assert.Error(suite.T(), err)
	assert.Contains(suite.T(), err.Error(), "not found or access denied")
}

func (suite *FileServiceTestSuite) TestUnstarFolder_Success() {
	// First star the folder
	err := suite.fileService.StarFolder(suite.testUser.ID, suite.testFolder.ID)
	assert.NoError(suite.T(), err)

	// Then unstar it
	err = suite.fileService.UnstarFolder(suite.testUser.ID, suite.testFolder.ID)
	assert.NoError(suite.T(), err)

	// Verify the folder was unstarred
	var updatedFolder models.Folder
	err = suite.db.First(&updatedFolder, suite.testFolder.ID).Error
	assert.NoError(suite.T(), err)
	assert.False(suite.T(), updatedFolder.IsStarred)
}

func (suite *FileServiceTestSuite) TestUnstarFolder_FolderNotFound() {
	err := suite.fileService.UnstarFolder(suite.testUser.ID, 99999)

	assert.Error(suite.T(), err)
	assert.Contains(suite.T(), err.Error(), "not found or access denied")
}

func (suite *FileServiceTestSuite) TestUnstarFolder_WrongUser() {
	// Create another user and folder
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

	otherFolder := models.Folder{
		UserID: otherUser.ID,
		Name:   "Other Folder",
	}
	err = suite.db.Create(&otherFolder).Error
	suite.Require().NoError(err)

	err = suite.fileService.UnstarFolder(suite.testUser.ID, otherFolder.ID)

	assert.Error(suite.T(), err)
	assert.Contains(suite.T(), err.Error(), "not found or access denied")
}

func (suite *FileServiceTestSuite) TestGetStarredFiles_Success() {
	// Star the test file
	err := suite.fileService.StarFile(suite.testUser.ID, suite.testUserFile.ID)
	assert.NoError(suite.T(), err)

	// Get starred files
	starredFiles, err := suite.fileService.GetStarredFiles(suite.testUser.ID)

	assert.NoError(suite.T(), err)
	assert.Len(suite.T(), starredFiles, 1)
	assert.Equal(suite.T(), suite.testUserFile.ID, starredFiles[0].ID)
	assert.True(suite.T(), starredFiles[0].IsStarred)
}

func (suite *FileServiceTestSuite) TestGetStarredFiles_NoStarredFiles() {
	starredFiles, err := suite.fileService.GetStarredFiles(suite.testUser.ID)

	assert.NoError(suite.T(), err)
	assert.Len(suite.T(), starredFiles, 0)
}

func (suite *FileServiceTestSuite) TestGetStarredFiles_WrongUser() {
	// Star the test file for the original user
	err := suite.fileService.StarFile(suite.testUser.ID, suite.testUserFile.ID)
	assert.NoError(suite.T(), err)

	// Create another user
	otherUser := models.User{
		Username:     "otheruser",
		Email:        "other@example.com",
		PasswordHash: "hash",
		StorageQuota: 10485760,
		UsedStorage:  0,
		IsAdmin:      false,
	}
	err = suite.db.Create(&otherUser).Error
	suite.Require().NoError(err)

	// Get starred files for the other user
	starredFiles, err := suite.fileService.GetStarredFiles(otherUser.ID)

	assert.NoError(suite.T(), err)
	assert.Len(suite.T(), starredFiles, 0)
}

func (suite *FileServiceTestSuite) TestGetStarredFolders_Success() {
	// Star the test folder
	err := suite.fileService.StarFolder(suite.testUser.ID, suite.testFolder.ID)
	assert.NoError(suite.T(), err)

	// Get starred folders
	starredFolders, err := suite.fileService.GetStarredFolders(suite.testUser.ID)

	assert.NoError(suite.T(), err)
	assert.Len(suite.T(), starredFolders, 1)
	assert.Equal(suite.T(), suite.testFolder.ID, starredFolders[0].ID)
	assert.True(suite.T(), starredFolders[0].IsStarred)
}

func (suite *FileServiceTestSuite) TestGetStarredFolders_NoStarredFolders() {
	starredFolders, err := suite.fileService.GetStarredFolders(suite.testUser.ID)

	assert.NoError(suite.T(), err)
	assert.Len(suite.T(), starredFolders, 0)
}

func (suite *FileServiceTestSuite) TestGetStarredFolders_WrongUser() {
	// Star the test folder for the original user
	err := suite.fileService.StarFolder(suite.testUser.ID, suite.testFolder.ID)
	assert.NoError(suite.T(), err)

	// Create another user
	otherUser := models.User{
		Username:     "otheruser",
		Email:        "other@example.com",
		PasswordHash: "hash",
		StorageQuota: 10485760,
		UsedStorage:  0,
		IsAdmin:      false,
	}
	err = suite.db.Create(&otherUser).Error
	suite.Require().NoError(err)

	// Get starred folders for the other user
	starredFolders, err := suite.fileService.GetStarredFolders(otherUser.ID)

	assert.NoError(suite.T(), err)
	assert.Len(suite.T(), starredFolders, 0)
}

func (suite *FileServiceTestSuite) TestGetStarredFiles_DatabaseError() {
	// Close the database connection to simulate database error
	sqlDB, _ := suite.db.DB()
	sqlDB.Close()

	_, err := suite.fileService.GetStarredFiles(suite.testUser.ID)

	assert.Error(suite.T(), err)
	assert.Contains(suite.T(), err.Error(), "database error")
}

func (suite *FileServiceTestSuite) TestGetStarredFolders_DatabaseError() {
	// Close the database connection to simulate database error
	sqlDB, _ := suite.db.DB()
	sqlDB.Close()

	_, err := suite.fileService.GetStarredFolders(suite.testUser.ID)

	assert.Error(suite.T(), err)
	assert.Contains(suite.T(), err.Error(), "database error")
}

func TestFileServiceSuite(t *testing.T) {
	suite.Run(t, new(FileServiceTestSuite))
}
