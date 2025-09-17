package services_test

import (
	"errors"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/suite"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"

	"github.com/balkanid/aegis-backend/internal/database"
	"github.com/balkanid/aegis-backend/internal/models"
	"github.com/balkanid/aegis-backend/internal/services"
)

type RoomServiceTestSuite struct {
	suite.Suite
	db           *gorm.DB
	roomService  *services.RoomService
	testUser     models.User
	testUser2    models.User
	testRoom     models.Room
	testMember   models.RoomMember
	testFile     models.File
	testUserFile models.UserFile
}

func (suite *RoomServiceTestSuite) SetupSuite() {
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
		&models.Room{},
		&models.RoomMember{},
		&models.RoomFile{},
		&models.DownloadLog{},
	)
	suite.Require().NoError(err)

	suite.roomService = services.NewRoomService()
}

func (suite *RoomServiceTestSuite) TearDownSuite() {
	if suite.db != nil {
		sqlDB, _ := suite.db.DB()
		sqlDB.Close()
	}
}

func (suite *RoomServiceTestSuite) SetupTest() {
	// Clean database before each test
	suite.db.Exec("DELETE FROM download_logs")
	suite.db.Exec("DELETE FROM room_files")
	suite.db.Exec("DELETE FROM room_members")
	suite.db.Exec("DELETE FROM user_files")
	suite.db.Exec("DELETE FROM rooms")
	suite.db.Exec("DELETE FROM files")
	suite.db.Exec("DELETE FROM users")

	// Create test users
	suite.testUser = models.User{
		Email:        "creator@example.com",
		PasswordHash: "hash",
		StorageQuota: 10485760,
		UsedStorage:  0,
		IsAdmin:      false,
	}
	err := suite.db.Create(&suite.testUser).Error
	suite.Require().NoError(err)

	suite.testUser2 = models.User{
		Email:        "member@example.com",
		PasswordHash: "hash",
		StorageQuota: 10485760,
		UsedStorage:  0,
		IsAdmin:      false,
	}
	err = suite.db.Create(&suite.testUser2).Error
	suite.Require().NoError(err)

	// Create test room
	suite.testRoom = models.Room{
		Name:      "Test Room",
		CreatorID: suite.testUser.ID,
	}
	err = suite.db.Create(&suite.testRoom).Error
	suite.Require().NoError(err)

	// Create test member
	suite.testMember = models.RoomMember{
		RoomID: suite.testRoom.ID,
		UserID: suite.testUser.ID,
		Role:   models.RoomRoleAdmin,
	}
	err = suite.db.Create(&suite.testMember).Error
	suite.Require().NoError(err)

	// Create test file and user file for sharing tests
	suite.testFile = models.File{
		ContentHash: "test_hash",
		SizeBytes:   1024,
		StoragePath: "/mock/path/test.txt",
	}
	err = suite.db.Create(&suite.testFile).Error
	suite.Require().NoError(err)

	suite.testUserFile = models.UserFile{
		UserID:        suite.testUser.ID,
		FileID:        suite.testFile.ID,
		Filename:      "test.txt",
		MimeType:      "text/plain",
		EncryptionKey: "key",
	}
	err = suite.db.Create(&suite.testUserFile).Error
	suite.Require().NoError(err)
}

func (suite *RoomServiceTestSuite) TestNewRoomService() {
	service := services.NewRoomService()
	assert.NotNil(suite.T(), service)
}

func (suite *RoomServiceTestSuite) TestCreateRoom_Success() {
	room, err := suite.roomService.CreateRoom(suite.testUser.ID, "New Test Room")

	assert.NoError(suite.T(), err)
	assert.NotNil(suite.T(), room)
	assert.Equal(suite.T(), "New Test Room", room.Name)
	assert.Equal(suite.T(), suite.testUser.ID, room.CreatorID)

	// Verify creator is added as admin member
	var member models.RoomMember
	err = suite.db.Where("room_id = ? AND user_id = ?", room.ID, suite.testUser.ID).First(&member).Error
	assert.NoError(suite.T(), err)
	assert.Equal(suite.T(), models.RoomRoleAdmin, member.Role)
}

func (suite *RoomServiceTestSuite) TestCreateRoom_InvalidUserID() {
	room, err := suite.roomService.CreateRoom(99999, "Invalid Room")

	// This should still succeed as we don't validate user existence in creation
	// User validation should happen at the handler level
	assert.NoError(suite.T(), err)
	assert.NotNil(suite.T(), room)
	assert.Equal(suite.T(), "Invalid Room", room.Name)
}

func (suite *RoomServiceTestSuite) TestGetUserRooms_NoRooms() {
	// Create a user with no rooms
	newUser := models.User{
		Email:        "noroom@example.com",
		PasswordHash: "hash",
		StorageQuota: 10485760,
		UsedStorage:  0,
		IsAdmin:      false,
	}
	err := suite.db.Create(&newUser).Error
	suite.Require().NoError(err)

	rooms, err := suite.roomService.GetUserRooms(newUser.ID)

	assert.NoError(suite.T(), err)
	assert.Empty(suite.T(), rooms)
}

func (suite *RoomServiceTestSuite) TestGetUserRooms_WithRooms() {
	rooms, err := suite.roomService.GetUserRooms(suite.testUser.ID)

	assert.NoError(suite.T(), err)
	assert.Len(suite.T(), rooms, 1)
	assert.Equal(suite.T(), suite.testRoom.Name, rooms[0].Name)
	assert.Equal(suite.T(), suite.testUser.ID, rooms[0].CreatorID)
}

func (suite *RoomServiceTestSuite) TestGetUserRooms_MultipleRooms() {
	// Create another room for the same user
	room2 := models.Room{
		Name:      "Second Room",
		CreatorID: suite.testUser.ID,
	}
	err := suite.db.Create(&room2).Error
	suite.Require().NoError(err)

	member2 := models.RoomMember{
		RoomID: room2.ID,
		UserID: suite.testUser.ID,
		Role:   models.RoomRoleAdmin,
	}
	err = suite.db.Create(&member2).Error
	suite.Require().NoError(err)

	rooms, err := suite.roomService.GetUserRooms(suite.testUser.ID)

	assert.NoError(suite.T(), err)
	assert.Len(suite.T(), rooms, 2)

	// Check that both rooms are returned
	roomNames := make([]string, len(rooms))
	for i, room := range rooms {
		roomNames[i] = room.Name
	}
	assert.Contains(suite.T(), roomNames, "Test Room")
	assert.Contains(suite.T(), roomNames, "Second Room")
}

func (suite *RoomServiceTestSuite) TestGetRoom_Success() {
	room, err := suite.roomService.GetRoom(suite.testRoom.ID, suite.testUser.ID)

	assert.NoError(suite.T(), err)
	assert.NotNil(suite.T(), room)
	assert.Equal(suite.T(), suite.testRoom.Name, room.Name)
	assert.Equal(suite.T(), suite.testUser.ID, room.CreatorID)
}

func (suite *RoomServiceTestSuite) TestGetRoom_AccessDenied() {
	// Try to access room as non-member
	room, err := suite.roomService.GetRoom(suite.testRoom.ID, suite.testUser2.ID)

	assert.Error(suite.T(), err)
	assert.Nil(suite.T(), room)
	assert.Contains(suite.T(), err.Error(), "access denied")
}

func (suite *RoomServiceTestSuite) TestGetRoom_RoomNotFound() {
	room, err := suite.roomService.GetRoom(99999, suite.testUser.ID)

	assert.Error(suite.T(), err)
	assert.Nil(suite.T(), room)
	assert.Contains(suite.T(), err.Error(), "room not found")
}

func (suite *RoomServiceTestSuite) TestAddRoomMember_Success() {
	err := suite.roomService.AddRoomMember(suite.testRoom.ID, suite.testUser2.ID, suite.testUser.ID, models.RoomRoleContentViewer)

	assert.NoError(suite.T(), err)

	// Verify member was added
	var member models.RoomMember
	err = suite.db.Where("room_id = ? AND user_id = ?", suite.testRoom.ID, suite.testUser2.ID).First(&member).Error
	assert.NoError(suite.T(), err)
	assert.Equal(suite.T(), models.RoomRoleContentViewer, member.Role)
}

func (suite *RoomServiceTestSuite) TestAddRoomMember_AccessDenied() {
	// Try to add member as non-admin
	err := suite.roomService.AddRoomMember(suite.testRoom.ID, suite.testUser2.ID, suite.testUser2.ID, models.RoomRoleContentViewer)

	assert.Error(suite.T(), err)
	assert.Contains(suite.T(), err.Error(), "access denied")
}

func (suite *RoomServiceTestSuite) TestAddRoomMember_AlreadyMember() {
	// Add user as member first
	err := suite.roomService.AddRoomMember(suite.testRoom.ID, suite.testUser2.ID, suite.testUser.ID, models.RoomRoleContentViewer)
	suite.Require().NoError(err)

	// Try to add the same user again
	err = suite.roomService.AddRoomMember(suite.testRoom.ID, suite.testUser2.ID, suite.testUser.ID, models.RoomRoleContentEditor)

	assert.Error(suite.T(), err)
	assert.Contains(suite.T(), err.Error(), "already a member")
}

func (suite *RoomServiceTestSuite) TestAddRoomMember_RoomNotFound() {
	err := suite.roomService.AddRoomMember(99999, suite.testUser2.ID, suite.testUser.ID, models.RoomRoleContentViewer)

	assert.Error(suite.T(), err)
	assert.Contains(suite.T(), err.Error(), "access denied") // Because requireRoomAdmin fails first
}

func (suite *RoomServiceTestSuite) TestRemoveRoomMember_Success() {
	// First add a member
	err := suite.roomService.AddRoomMember(suite.testRoom.ID, suite.testUser2.ID, suite.testUser.ID, models.RoomRoleContentViewer)
	suite.Require().NoError(err)

	// Now remove the member
	err = suite.roomService.RemoveRoomMember(suite.testRoom.ID, suite.testUser2.ID, suite.testUser.ID)

	assert.NoError(suite.T(), err)

	// Verify member was removed
	var member models.RoomMember
	err = suite.db.Where("room_id = ? AND user_id = ?", suite.testRoom.ID, suite.testUser2.ID).First(&member).Error
	assert.Error(suite.T(), err)
	assert.True(suite.T(), errors.Is(err, gorm.ErrRecordNotFound))
}

func (suite *RoomServiceTestSuite) TestRemoveRoomMember_Creator() {
	// Try to remove the room creator
	err := suite.roomService.RemoveRoomMember(suite.testRoom.ID, suite.testUser.ID, suite.testUser.ID)

	assert.Error(suite.T(), err)
	assert.Contains(suite.T(), err.Error(), "cannot remove room creator")
}

func (suite *RoomServiceTestSuite) TestRemoveRoomMember_AccessDenied() {
	// First add a member
	err := suite.roomService.AddRoomMember(suite.testRoom.ID, suite.testUser2.ID, suite.testUser.ID, models.RoomRoleContentViewer)
	suite.Require().NoError(err)

	// Try to remove as non-admin
	err = suite.roomService.RemoveRoomMember(suite.testRoom.ID, suite.testUser2.ID, suite.testUser2.ID)

	assert.Error(suite.T(), err)
	assert.Contains(suite.T(), err.Error(), "access denied")
}

func (suite *RoomServiceTestSuite) TestRemoveRoomMember_NotMember() {
	err := suite.roomService.RemoveRoomMember(suite.testRoom.ID, suite.testUser2.ID, suite.testUser.ID)

	assert.NoError(suite.T(), err) // Should succeed even if user is not a member
}

func (suite *RoomServiceTestSuite) TestShareFileToRoom_Success() {
	err := suite.roomService.ShareFileToRoom(suite.testUserFile.ID, suite.testRoom.ID, suite.testUser.ID)

	assert.NoError(suite.T(), err)

	// Verify file was shared
	var roomFile models.RoomFile
	err = suite.db.Where("room_id = ? AND user_file_id = ?", suite.testRoom.ID, suite.testUserFile.ID).First(&roomFile).Error
	assert.NoError(suite.T(), err)
}

func (suite *RoomServiceTestSuite) TestShareFileToRoom_AccessDenied() {
	// Add user2 as viewer (no file sharing permission)
	err := suite.roomService.AddRoomMember(suite.testRoom.ID, suite.testUser2.ID, suite.testUser.ID, models.RoomRoleContentViewer)
	suite.Require().NoError(err)

	// Try to share file as viewer
	err = suite.roomService.ShareFileToRoom(suite.testUserFile.ID, suite.testRoom.ID, suite.testUser2.ID)

	assert.Error(suite.T(), err)
	assert.Contains(suite.T(), err.Error(), "access denied")
}

func (suite *RoomServiceTestSuite) TestShareFileToRoom_FileNotOwned() {
	// Create a file owned by user2
	user2File := models.UserFile{
		UserID:        suite.testUser2.ID,
		FileID:        suite.testFile.ID,
		Filename:      "user2_file.txt",
		MimeType:      "text/plain",
		EncryptionKey: "key2",
	}
	err := suite.db.Create(&user2File).Error
	suite.Require().NoError(err)

	// Try to share user2's file as user1
	err = suite.roomService.ShareFileToRoom(user2File.ID, suite.testRoom.ID, suite.testUser.ID)

	assert.Error(suite.T(), err)
	assert.Contains(suite.T(), err.Error(), "file not found or access denied")
}

func (suite *RoomServiceTestSuite) TestShareFileToRoom_AlreadyShared() {
	// Share file first time
	err := suite.roomService.ShareFileToRoom(suite.testUserFile.ID, suite.testRoom.ID, suite.testUser.ID)
	suite.Require().NoError(err)

	// Try to share the same file again
	err = suite.roomService.ShareFileToRoom(suite.testUserFile.ID, suite.testRoom.ID, suite.testUser.ID)

	assert.Error(suite.T(), err)
	assert.Contains(suite.T(), err.Error(), "already shared")
}

func (suite *RoomServiceTestSuite) TestRemoveFileFromRoom_Success() {
	// First share a file
	err := suite.roomService.ShareFileToRoom(suite.testUserFile.ID, suite.testRoom.ID, suite.testUser.ID)
	suite.Require().NoError(err)

	// Now remove it
	err = suite.roomService.RemoveFileFromRoom(suite.testUserFile.ID, suite.testRoom.ID, suite.testUser.ID)

	assert.NoError(suite.T(), err)

	// Verify file was removed from room
	var roomFile models.RoomFile
	err = suite.db.Where("room_id = ? AND user_file_id = ?", suite.testRoom.ID, suite.testUserFile.ID).First(&roomFile).Error
	assert.Error(suite.T(), err)
	assert.True(suite.T(), errors.Is(err, gorm.ErrRecordNotFound))
}

func (suite *RoomServiceTestSuite) TestRemoveFileFromRoom_AccessDenied() {
	// First share a file
	err := suite.roomService.ShareFileToRoom(suite.testUserFile.ID, suite.testRoom.ID, suite.testUser.ID)
	suite.Require().NoError(err)

	// Add user2 as viewer
	err = suite.roomService.AddRoomMember(suite.testRoom.ID, suite.testUser2.ID, suite.testUser.ID, models.RoomRoleContentViewer)
	suite.Require().NoError(err)

	// Try to remove file as viewer
	err = suite.roomService.RemoveFileFromRoom(suite.testUserFile.ID, suite.testRoom.ID, suite.testUser2.ID)

	assert.Error(suite.T(), err)
	assert.Contains(suite.T(), err.Error(), "access denied")
}

func (suite *RoomServiceTestSuite) TestGetRoomFiles_Success() {
	// Share a file to the room
	err := suite.roomService.ShareFileToRoom(suite.testUserFile.ID, suite.testRoom.ID, suite.testUser.ID)
	suite.Require().NoError(err)

	files, err := suite.roomService.GetRoomFiles(suite.testRoom.ID, suite.testUser.ID)

	assert.NoError(suite.T(), err)
	assert.Len(suite.T(), files, 1)
	assert.Equal(suite.T(), suite.testUserFile.Filename, files[0].Filename)
}

func (suite *RoomServiceTestSuite) TestGetRoomFiles_AccessDenied() {
	files, err := suite.roomService.GetRoomFiles(suite.testRoom.ID, suite.testUser2.ID)

	assert.Error(suite.T(), err)
	assert.Nil(suite.T(), files)
	assert.Contains(suite.T(), err.Error(), "access denied")
}

func (suite *RoomServiceTestSuite) TestGetRoomFiles_EmptyRoom() {
	files, err := suite.roomService.GetRoomFiles(suite.testRoom.ID, suite.testUser.ID)

	assert.NoError(suite.T(), err)
	assert.Empty(suite.T(), files)
}


func TestRoomServiceSuite(t *testing.T) {
	suite.Run(t, new(RoomServiceTestSuite))
}