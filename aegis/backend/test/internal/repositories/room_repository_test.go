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

type RoomRepositoryTestSuite struct {
	suite.Suite
	db             *gorm.DB
	roomRepository *repositories.RoomRepository
	testUser       models.User
	testRoom       models.Room
	testRoomMember models.RoomMember
	testFile       models.File
	testUserFile   models.UserFile
	testFolder     models.Folder
}

func (suite *RoomRepositoryTestSuite) SetupSuite() {
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

	suite.roomRepository = repositories.NewRoomRepository(database.NewDB(db))
}

func (suite *RoomRepositoryTestSuite) TearDownSuite() {
	if suite.db != nil {
		sqlDB, _ := suite.db.DB()
		sqlDB.Close()
	}
}

func (suite *RoomRepositoryTestSuite) SetupTest() {
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

func (suite *RoomRepositoryTestSuite) TestNewRoomRepository() {
	db := database.NewDB(suite.db)
	repo := repositories.NewRoomRepository(db)
	assert.NotNil(suite.T(), repo)
}

func (suite *RoomRepositoryTestSuite) TestGetUserRooms_Success() {
	rooms, err := suite.roomRepository.GetUserRooms(suite.testUser.ID)

	assert.NoError(suite.T(), err)
	assert.Len(suite.T(), rooms, 1)
	assert.Equal(suite.T(), suite.testRoom.ID, rooms[0].ID)
	assert.Equal(suite.T(), suite.testRoom.Name, rooms[0].Name)
}

func (suite *RoomRepositoryTestSuite) TestGetUserRooms_NoRooms() {
	// Create another user with no rooms
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

	rooms, err := suite.roomRepository.GetUserRooms(otherUser.ID)

	assert.NoError(suite.T(), err)
	assert.Empty(suite.T(), rooms)
}

func (suite *RoomRepositoryTestSuite) TestGetRoomByID_Success() {
	room, err := suite.roomRepository.GetRoomByID(suite.testRoom.ID, suite.testUser.ID)

	assert.NoError(suite.T(), err)
	assert.NotNil(suite.T(), room)
	assert.Equal(suite.T(), suite.testRoom.ID, room.ID)
	assert.Equal(suite.T(), suite.testRoom.Name, room.Name)
}

func (suite *RoomRepositoryTestSuite) TestGetRoomByID_NotMember() {
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

	room, err := suite.roomRepository.GetRoomByID(suite.testRoom.ID, otherUser.ID)

	assert.Error(suite.T(), err)
	assert.Nil(suite.T(), room)
	assert.Contains(suite.T(), err.Error(), "access denied: user is not a member of this room")
}

func (suite *RoomRepositoryTestSuite) TestGetRoomByID_RoomNotFound() {
	room, err := suite.roomRepository.GetRoomByID(99999, suite.testUser.ID)

	assert.Error(suite.T(), err)
	assert.Nil(suite.T(), room)
	assert.Contains(suite.T(), err.Error(), "room not found")
}

func (suite *RoomRepositoryTestSuite) TestCheckRoomMembership_Success() {
	err := suite.roomRepository.CheckRoomMembership(suite.testRoom.ID, suite.testUser.ID)

	assert.NoError(suite.T(), err)
}

func (suite *RoomRepositoryTestSuite) TestCheckRoomMembership_NotMember() {
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

	err = suite.roomRepository.CheckRoomMembership(suite.testRoom.ID, otherUser.ID)

	assert.Error(suite.T(), err)
	assert.Contains(suite.T(), err.Error(), "access denied: user is not a member of this room")
}

func (suite *RoomRepositoryTestSuite) TestCheckRoomAdmin_Success() {
	err := suite.roomRepository.CheckRoomAdmin(suite.testRoom.ID, suite.testUser.ID)

	assert.NoError(suite.T(), err)
}

func (suite *RoomRepositoryTestSuite) TestCheckRoomAdmin_NotAdmin() {
	// Change role to viewer
	err := suite.db.Model(&suite.testRoomMember).Update("role", models.RoomRoleContentViewer).Error
	suite.Require().NoError(err)

	err = suite.roomRepository.CheckRoomAdmin(suite.testRoom.ID, suite.testUser.ID)

	assert.Error(suite.T(), err)
	assert.Contains(suite.T(), err.Error(), "access denied: admin privileges required")
}

func (suite *RoomRepositoryTestSuite) TestCheckRoomFilePermission_Success() {
	err := suite.roomRepository.CheckRoomFilePermission(suite.testRoom.ID, suite.testUser.ID)

	assert.NoError(suite.T(), err)
}

func (suite *RoomRepositoryTestSuite) TestCheckRoomFilePermission_InsufficientPermissions() {
	// Change role to viewer
	err := suite.db.Model(&suite.testRoomMember).Update("role", models.RoomRoleContentViewer).Error
	suite.Require().NoError(err)

	err = suite.roomRepository.CheckRoomFilePermission(suite.testRoom.ID, suite.testUser.ID)

	assert.Error(suite.T(), err)
	assert.Contains(suite.T(), err.Error(), "access denied: insufficient permissions to manage files")
}

func (suite *RoomRepositoryTestSuite) TestGetRoomFiles_Success() {
	// Share file to room first
	roomFile := models.RoomFile{
		RoomID:     suite.testRoom.ID,
		UserFileID: suite.testUserFile.ID,
	}
	err := suite.db.Create(&roomFile).Error
	suite.Require().NoError(err)

	files, err := suite.roomRepository.GetRoomFiles(suite.testRoom.ID, suite.testUser.ID)

	assert.NoError(suite.T(), err)
	assert.Len(suite.T(), files, 1)
	assert.Equal(suite.T(), suite.testUserFile.ID, files[0].ID)
}

func (suite *RoomRepositoryTestSuite) TestGetRoomFiles_NotMember() {
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

	files, err := suite.roomRepository.GetRoomFiles(suite.testRoom.ID, otherUser.ID)

	assert.Error(suite.T(), err)
	assert.Nil(suite.T(), files)
	assert.Contains(suite.T(), err.Error(), "access denied: user is not a member of this room")
}

func (suite *RoomRepositoryTestSuite) TestCheckEntityAlreadyShared_File_NotShared() {
	err := suite.roomRepository.CheckEntityAlreadyShared("file", suite.testUserFile.ID, suite.testRoom.ID)

	assert.NoError(suite.T(), err)
}

func (suite *RoomRepositoryTestSuite) TestCheckEntityAlreadyShared_File_AlreadyShared() {
	// Share file first
	roomFile := models.RoomFile{
		RoomID:     suite.testRoom.ID,
		UserFileID: suite.testUserFile.ID,
	}
	err := suite.db.Create(&roomFile).Error
	suite.Require().NoError(err)

	err = suite.roomRepository.CheckEntityAlreadyShared("file", suite.testUserFile.ID, suite.testRoom.ID)

	assert.Error(suite.T(), err)
	assert.Contains(suite.T(), err.Error(), "file is already shared to this room")
}

func (suite *RoomRepositoryTestSuite) TestCheckEntityAlreadyShared_InvalidType() {
	err := suite.roomRepository.CheckEntityAlreadyShared("invalid", suite.testUserFile.ID, suite.testRoom.ID)

	assert.Error(suite.T(), err)
	assert.Contains(suite.T(), err.Error(), "invalid entity type")
}

func (suite *RoomRepositoryTestSuite) TestCreateRoomAssociation_File() {
	err := suite.roomRepository.CreateRoomAssociation("file", suite.testUserFile.ID, suite.testRoom.ID)

	assert.NoError(suite.T(), err)

	// Verify association was created
	var roomFile models.RoomFile
	err = suite.db.Where("room_id = ? AND user_file_id = ?", suite.testRoom.ID, suite.testUserFile.ID).First(&roomFile).Error
	assert.NoError(suite.T(), err)
}

func (suite *RoomRepositoryTestSuite) TestCreateRoomAssociation_Folder() {
	err := suite.roomRepository.CreateRoomAssociation("folder", suite.testFolder.ID, suite.testRoom.ID)

	assert.NoError(suite.T(), err)

	// Verify association was created
	var roomFolder models.RoomFolder
	err = suite.db.Where("room_id = ? AND folder_id = ?", suite.testRoom.ID, suite.testFolder.ID).First(&roomFolder).Error
	assert.NoError(suite.T(), err)
}

func (suite *RoomRepositoryTestSuite) TestDeleteRoomAssociation_File() {
	// Create association first
	roomFile := models.RoomFile{
		RoomID:     suite.testRoom.ID,
		UserFileID: suite.testUserFile.ID,
	}
	err := suite.db.Create(&roomFile).Error
	suite.Require().NoError(err)

	// Delete association
	err = suite.roomRepository.DeleteRoomAssociation("file", suite.testUserFile.ID, suite.testRoom.ID)

	assert.NoError(suite.T(), err)

	// Verify association was deleted
	var count int64
	suite.db.Model(&models.RoomFile{}).Where("room_id = ? AND user_file_id = ?", suite.testRoom.ID, suite.testUserFile.ID).Count(&count)
	assert.Equal(suite.T(), int64(0), count)
}

func TestRoomRepositorySuite(t *testing.T) {
	suite.Run(t, new(RoomRepositoryTestSuite))
}