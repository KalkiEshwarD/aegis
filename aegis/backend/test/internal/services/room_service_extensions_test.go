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

type RoomServiceExtensionsTestSuite struct {
	suite.Suite
	db                     *gorm.DB
	roomServiceExtensions *services.RoomServiceExtensions
	testUser              models.User
	testFile              models.File
	testUserFile          models.UserFile
	testFolder            models.Folder
	testRoom              models.Room
	testRoomMember        models.RoomMember
}

func (suite *RoomServiceExtensionsTestSuite) SetupSuite() {
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
		&models.Room{},
		&models.RoomMember{},
		&models.RoomFile{},
		&models.RoomFolder{},
	)
	suite.Require().NoError(err)

	suite.roomServiceExtensions = services.NewRoomServiceExtensions(database.NewDB(db))
}

func (suite *RoomServiceExtensionsTestSuite) TearDownSuite() {
	if suite.db != nil {
		sqlDB, _ := suite.db.DB()
		sqlDB.Close()
	}
}

func (suite *RoomServiceExtensionsTestSuite) SetupTest() {
	// Clean database before each test
	suite.db.Exec("DELETE FROM room_folders")
	suite.db.Exec("DELETE FROM room_files")
	suite.db.Exec("DELETE FROM room_members")
	suite.db.Exec("DELETE FROM rooms")
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

	// Create test room
	suite.testRoom = models.Room{
		Name:      "Test Room",
		CreatorID: suite.testUser.ID,
	}
	err = suite.db.Create(&suite.testRoom).Error
	suite.Require().NoError(err)

	// Create test room member
	suite.testRoomMember = models.RoomMember{
		RoomID: suite.testRoom.ID,
		UserID: suite.testUser.ID,
		Role:   models.RoomRoleAdmin,
	}
	err = suite.db.Create(&suite.testRoomMember).Error
	suite.Require().NoError(err)
}

func (suite *RoomServiceExtensionsTestSuite) TestNewRoomServiceExtensions() {
	db := database.NewDB(suite.db)
	service := services.NewRoomServiceExtensions(db)
	assert.NotNil(suite.T(), service)
}

func (suite *RoomServiceExtensionsTestSuite) TestShareEntityToRoom_Success_File() {
	entity := services.UserFileEntity{UserFile: &suite.testUserFile}
	err := suite.roomServiceExtensions.ShareEntityToRoom(entity, services.EntityTypeFile, suite.testRoom.ID, suite.testUser.ID, false)

	assert.NoError(suite.T(), err)

	// Verify room file was created
	var roomFile models.RoomFile
	err = suite.db.Where("room_id = ? AND user_file_id = ?", suite.testRoom.ID, suite.testUserFile.ID).First(&roomFile).Error
	assert.NoError(suite.T(), err)
	assert.Equal(suite.T(), suite.testRoom.ID, roomFile.RoomID)
	assert.Equal(suite.T(), suite.testUserFile.ID, roomFile.UserFileID)
}

func (suite *RoomServiceExtensionsTestSuite) TestShareEntityToRoom_Success_Folder() {
	entity := services.FolderEntity{Folder: &suite.testFolder}
	err := suite.roomServiceExtensions.ShareEntityToRoom(entity, services.EntityTypeFolder, suite.testRoom.ID, suite.testUser.ID, false)

	assert.NoError(suite.T(), err)

	// Verify room folder was created
	var roomFolder models.RoomFolder
	err = suite.db.Where("room_id = ? AND folder_id = ?", suite.testRoom.ID, suite.testFolder.ID).First(&roomFolder).Error
	assert.NoError(suite.T(), err)
	assert.Equal(suite.T(), suite.testRoom.ID, roomFolder.RoomID)
	assert.Equal(suite.T(), suite.testFolder.ID, roomFolder.FolderID)
}

func (suite *RoomServiceExtensionsTestSuite) TestShareEntityToRoom_EntityNotOwned() {
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

	entity := services.UserFileEntity{UserFile: &suite.testUserFile}
	err = suite.roomServiceExtensions.ShareEntityToRoom(entity, services.EntityTypeFile, suite.testRoom.ID, otherUser.ID, false)

	assert.Error(suite.T(), err)
	assert.Contains(suite.T(), err.Error(), "not found or access denied")
}

func (suite *RoomServiceExtensionsTestSuite) TestShareEntityToRoom_NotRoomMember() {
	// Create another user not in room
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

	// Create file for other user
	otherFile := models.File{
		ContentHash: "other_hash",
		SizeBytes:   512,
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

	entity := services.UserFileEntity{UserFile: &otherUserFile}
	err = suite.roomServiceExtensions.ShareEntityToRoom(entity, services.EntityTypeFile, suite.testRoom.ID, otherUser.ID, false)

	assert.Error(suite.T(), err)
	assert.Contains(suite.T(), err.Error(), "access denied: user is not a member of this room")
}

func (suite *RoomServiceExtensionsTestSuite) TestShareEntityToRoom_InsufficientFilePermissions() {
	// Change user role to viewer (cannot share files)
	err := suite.db.Model(&suite.testRoomMember).Update("role", models.RoomRoleContentViewer).Error
	suite.Require().NoError(err)

	entity := services.UserFileEntity{UserFile: &suite.testUserFile}
	err = suite.roomServiceExtensions.ShareEntityToRoom(entity, services.EntityTypeFile, suite.testRoom.ID, suite.testUser.ID, true)

	assert.Error(suite.T(), err)
	assert.Contains(suite.T(), err.Error(), "access denied: insufficient permissions to manage files")
}

func (suite *RoomServiceExtensionsTestSuite) TestShareEntityToRoom_AlreadyShared() {
	// First share
	entity := services.UserFileEntity{UserFile: &suite.testUserFile}
	err := suite.roomServiceExtensions.ShareEntityToRoom(entity, services.EntityTypeFile, suite.testRoom.ID, suite.testUser.ID, false)
	assert.NoError(suite.T(), err)

	// Try to share again
	err = suite.roomServiceExtensions.ShareEntityToRoom(entity, services.EntityTypeFile, suite.testRoom.ID, suite.testUser.ID, false)
	assert.Error(suite.T(), err)
	assert.Contains(suite.T(), err.Error(), "file is already shared to this room")
}

func (suite *RoomServiceExtensionsTestSuite) TestShareEntityToRoom_InvalidEntityType() {
	entity := services.UserFileEntity{UserFile: &suite.testUserFile}
	err := suite.roomServiceExtensions.ShareEntityToRoom(entity, "invalid", suite.testRoom.ID, suite.testUser.ID, false)

	assert.Error(suite.T(), err)
	assert.Contains(suite.T(), err.Error(), "invalid entity type")
}

func (suite *RoomServiceExtensionsTestSuite) TestRemoveEntityFromRoom_Success() {
	// First share
	entity := services.UserFileEntity{UserFile: &suite.testUserFile}
	err := suite.roomServiceExtensions.ShareEntityToRoom(entity, services.EntityTypeFile, suite.testRoom.ID, suite.testUser.ID, false)
	assert.NoError(suite.T(), err)

	// Then remove
	err = suite.roomServiceExtensions.RemoveEntityFromRoom(entity, services.EntityTypeFile, suite.testRoom.ID, suite.testUser.ID, false)
	assert.NoError(suite.T(), err)

	// Verify room file was removed
	var count int64
	suite.db.Model(&models.RoomFile{}).Where("room_id = ? AND user_file_id = ?", suite.testRoom.ID, suite.testUserFile.ID).Count(&count)
	assert.Equal(suite.T(), int64(0), count)
}

func (suite *RoomServiceExtensionsTestSuite) TestRemoveEntityFromRoom_NotShared() {
	entity := services.UserFileEntity{UserFile: &suite.testUserFile}
	err := suite.roomServiceExtensions.RemoveEntityFromRoom(entity, services.EntityTypeFile, suite.testRoom.ID, suite.testUser.ID, false)

	// Should succeed even if not shared (idempotent)
	assert.NoError(suite.T(), err)
}

func TestRoomServiceExtensionsSuite(t *testing.T) {
	suite.Run(t, new(RoomServiceExtensionsTestSuite))
}