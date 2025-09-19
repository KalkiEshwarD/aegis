package services_test

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/suite"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"

	"github.com/balkanid/aegis-backend/internal/config"
	"github.com/balkanid/aegis-backend/internal/database"
	"github.com/balkanid/aegis-backend/internal/models"
	"github.com/balkanid/aegis-backend/internal/services"
)

type UserServiceTestSuite struct {
	suite.Suite
	db          *gorm.DB
	userService *services.UserService
	config      *config.Config
}

func (suite *UserServiceTestSuite) SetupSuite() {
	// Create in-memory SQLite database for testing
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	suite.Require().NoError(err)

	suite.db = db
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

	// Test config
	suite.config = &config.Config{
		JWTSecret: "test-secret-key",
	}

	suite.userService = services.NewUserService(suite.config)
}

func (suite *UserServiceTestSuite) TearDownSuite() {
	if suite.db != nil {
		sqlDB, _ := suite.db.DB()
		sqlDB.Close()
	}
}

func (suite *UserServiceTestSuite) SetupTest() {
	// Clean database before each test
	suite.db.Exec("DELETE FROM download_logs")
	suite.db.Exec("DELETE FROM room_files")
	suite.db.Exec("DELETE FROM room_members")
	suite.db.Exec("DELETE FROM user_files")
	suite.db.Exec("DELETE FROM rooms")
	suite.db.Exec("DELETE FROM files")
	suite.db.Exec("DELETE FROM users")
}

func (suite *UserServiceTestSuite) TestNewUserService() {
	service := services.NewUserService(suite.config)
	assert.NotNil(suite.T(), service)
}

func (suite *UserServiceTestSuite) TestRegister_Success() {
	user, token, err := suite.userService.Register("testuser", "test@example.com", "TestPass123!")

	assert.NoError(suite.T(), err)
	assert.NotNil(suite.T(), user)
	assert.NotEmpty(suite.T(), token)
	assert.Equal(suite.T(), "test@example.com", user.Email)
	assert.Equal(suite.T(), "testuser", user.Username)
	assert.False(suite.T(), user.IsAdmin)
	assert.Equal(suite.T(), int64(104857600), user.StorageQuota)
	assert.Equal(suite.T(), int64(0), user.UsedStorage)

	// Verify password is hashed
	err = bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte("TestPass123!"))
	assert.NoError(suite.T(), err)
}

func (suite *UserServiceTestSuite) TestRegister_UserAlreadyExists() {
	// Create existing user
	existingUser := models.User{
		Email:        "test@example.com",
		Username:     "testuser",
		PasswordHash: "hash",
	}
	suite.db.Create(&existingUser)

	user, token, err := suite.userService.Register("testuser", "test@example.com", "TestPass123!")

	assert.Error(suite.T(), err)
	assert.Nil(suite.T(), user)
	assert.Empty(suite.T(), token)
	assert.Contains(suite.T(), err.Error(), "already exists")
}

func (suite *UserServiceTestSuite) TestRegister_InvalidPassword() {
	user, token, err := suite.userService.Register("testuser", "test@example.com", "")

	assert.Error(suite.T(), err)
	assert.Nil(suite.T(), user)
	assert.Empty(suite.T(), token)
}

func (suite *UserServiceTestSuite) TestLogin_Success() {
	// Create user
	hashedPassword, _ := bcrypt.GenerateFromPassword([]byte("password123"), bcrypt.DefaultCost)
	user := models.User{
		Email:        "test@example.com",
		Username:     "testuser2",
		PasswordHash: string(hashedPassword),
	}
	suite.db.Create(&user)

	loggedInUser, token, err := suite.userService.Login("test@example.com", "password123")

	assert.NoError(suite.T(), err)
	assert.NotNil(suite.T(), loggedInUser)
	assert.NotEmpty(suite.T(), token)
	assert.Equal(suite.T(), user.ID, loggedInUser.ID)
	assert.Equal(suite.T(), user.Email, loggedInUser.Email)
}

func (suite *UserServiceTestSuite) TestLogin_UserNotFound() {
	user, token, err := suite.userService.Login("nonexistent@example.com", "password123")

	assert.Error(suite.T(), err)
	assert.Nil(suite.T(), user)
	assert.Empty(suite.T(), token)
	assert.Contains(suite.T(), err.Error(), "invalid credentials")
}

func (suite *UserServiceTestSuite) TestLogin_InvalidPassword() {
	// Create user
	hashedPassword, _ := bcrypt.GenerateFromPassword([]byte("password123"), bcrypt.DefaultCost)
	user := models.User{
		Email:        "test@example.com",
		Username:     "testuser1",
		PasswordHash: string(hashedPassword),
	}
	suite.db.Create(&user)

	loggedInUser, token, err := suite.userService.Login("test@example.com", "wrongpassword")

	assert.Error(suite.T(), err)
	assert.Nil(suite.T(), loggedInUser)
	assert.Empty(suite.T(), token)
	assert.Contains(suite.T(), err.Error(), "invalid credentials")
}

func (suite *UserServiceTestSuite) TestGetUserStats_Success() {
	// Create user
	user := models.User{
		Email:        "test@example.com",
		Username:     "testuser3",
		PasswordHash: "hash",
		StorageQuota: 10485760,
		UsedStorage:  1024,
	}
	suite.db.Create(&user)

	// Create files
	file1 := models.File{
		ContentHash: "hash1",
		SizeBytes:   512,
		StoragePath: "/path1",
	}
	file2 := models.File{
		ContentHash: "hash2",
		SizeBytes:   1024,
		StoragePath: "/path2",
	}
	suite.db.Create(&file1)
	suite.db.Create(&file2)

	// Create user files
	userFile1 := models.UserFile{
		UserID:   user.ID,
		FileID:   file1.ID,
		Filename: "file1.txt",
	}
	userFile2 := models.UserFile{
		UserID:   user.ID,
		FileID:   file2.ID,
		Filename: "file2.txt",
	}
	suite.db.Create(&userFile1)
	suite.db.Create(&userFile2)

	stats, err := suite.userService.GetUserStats(user.ID)

	assert.NoError(suite.T(), err)
	assert.NotNil(suite.T(), stats)
	assert.Equal(suite.T(), 2, stats.TotalFiles)
	assert.Equal(suite.T(), 1536, stats.UsedStorage) // 512 + 1024
	assert.Equal(suite.T(), 10485760, stats.StorageQuota)
	assert.Equal(suite.T(), 0, stats.StorageSavings) // No deduplication in current implementation
}

func (suite *UserServiceTestSuite) TestGetUserStats_UserNotFound() {
	stats, err := suite.userService.GetUserStats(999)

	assert.Error(suite.T(), err)
	assert.Nil(suite.T(), stats)
	assert.Contains(suite.T(), err.Error(), "user not found")
}

func (suite *UserServiceTestSuite) TestCheckStorageQuota_Success() {
	user := models.User{
		Email:        "test@example.com",
		Username:     "testuser4",
		PasswordHash: "hash",
		StorageQuota: 1000,
		UsedStorage:  500,
	}
	suite.db.Create(&user)

	err := suite.userService.CheckStorageQuota(user.ID, 400) // 500 + 400 = 900 < 1000

	assert.NoError(suite.T(), err)
}

func (suite *UserServiceTestSuite) TestCheckStorageQuota_Exceeded() {
	user := models.User{
		Email:        "test@example.com",
		Username:     "testuser5",
		PasswordHash: "hash",
		StorageQuota: 1000,
		UsedStorage:  0,
	}
	suite.db.Create(&user)

	// Create files that total 800 bytes
	file1 := models.File{
		ContentHash: "hash1",
		SizeBytes:   500,
		StoragePath: "/path1",
	}
	file2 := models.File{
		ContentHash: "hash2",
		SizeBytes:   300,
		StoragePath: "/path2",
	}
	suite.db.Create(&file1)
	suite.db.Create(&file2)

	// Create user files
	userFile1 := models.UserFile{
		UserID:   user.ID,
		FileID:   file1.ID,
		Filename: "file1.txt",
	}
	userFile2 := models.UserFile{
		UserID:   user.ID,
		FileID:   file2.ID,
		Filename: "file2.txt",
	}
	suite.db.Create(&userFile1)
	suite.db.Create(&userFile2)

	err := suite.userService.CheckStorageQuota(user.ID, 300) // 800 + 300 = 1100 > 1000

	assert.Error(suite.T(), err)
	assert.Contains(suite.T(), err.Error(), "storage quota exceeded")
}

func (suite *UserServiceTestSuite) TestCheckStorageQuota_UserNotFound() {
	err := suite.userService.CheckStorageQuota(999, 100)

	assert.Error(suite.T(), err)
	assert.Contains(suite.T(), err.Error(), "user not found")
}

func (suite *UserServiceTestSuite) TestUpdateStorageUsage() {
	user := models.User{
		Email:        "test@example.com",
		Username:     "testuser6",
		PasswordHash: "hash",
		StorageQuota: 1000,
		UsedStorage:  500,
	}
	suite.db.Create(&user)

	err := suite.userService.UpdateStorageUsage(user.ID, 200)

	assert.NoError(suite.T(), err)

	// Verify update
	var updatedUser models.User
	suite.db.First(&updatedUser, user.ID)
	assert.Equal(suite.T(), int64(700), updatedUser.UsedStorage)
}

func (suite *UserServiceTestSuite) TestPromoteToAdmin() {
	user := models.User{
		Email:        "test@example.com",
		Username:     "testuser7",
		PasswordHash: "hash",
		IsAdmin:      false,
	}
	suite.db.Create(&user)

	err := suite.userService.PromoteToAdmin(user.ID)

	assert.NoError(suite.T(), err)

	// Verify promotion
	var updatedUser models.User
	suite.db.First(&updatedUser, user.ID)
	assert.True(suite.T(), updatedUser.IsAdmin)
}

func (suite *UserServiceTestSuite) TestDeleteUser() {
	user := models.User{
		Email:        "test@example.com",
		Username:     "testuser8",
		PasswordHash: "hash",
	}
	suite.db.Create(&user)

	err := suite.userService.DeleteUser(user.ID)

	assert.NoError(suite.T(), err)

	// Verify soft delete
	var deletedUser models.User
	err = suite.db.Unscoped().First(&deletedUser, user.ID).Error
	assert.NoError(suite.T(), err)
	assert.NotNil(suite.T(), deletedUser.DeletedAt)
}

func (suite *UserServiceTestSuite) TestGetAllUsers() {
	// Create users
	user1 := models.User{Username: "user1", Email: "user1@example.com", PasswordHash: "hash1"}
	user2 := models.User{Username: "user2", Email: "user2@example.com", PasswordHash: "hash2"}
	suite.db.Create(&user1)
	suite.db.Create(&user2)

	users, err := suite.userService.GetAllUsers()

	assert.NoError(suite.T(), err)
	assert.Len(suite.T(), users, 2)
	assert.Equal(suite.T(), "user1@example.com", users[0].Email)
	assert.Equal(suite.T(), "user2@example.com", users[1].Email)
}

func (suite *UserServiceTestSuite) TestHashSHA256() {
	data := []byte("test data")
	hash := services.HashSHA256(data)

	assert.NotEmpty(suite.T(), hash)
	assert.Len(suite.T(), hash, 64) // SHA-256 produces 64 character hex string

	// Same data should produce same hash
	hash2 := services.HashSHA256(data)
	assert.Equal(suite.T(), hash, hash2)

	// Different data should produce different hash
	hash3 := services.HashSHA256([]byte("different data"))
	assert.NotEqual(suite.T(), hash, hash3)
}

func (suite *UserServiceTestSuite) TestUserStats_Struct() {
	stats := &services.UserStats{
		TotalFiles:     5,
		UsedStorage:    1024,
		StorageQuota:   10485760,
		StorageSavings: 512,
	}

	assert.Equal(suite.T(), 5, stats.TotalFiles)
	assert.Equal(suite.T(), 1024, stats.UsedStorage)
	assert.Equal(suite.T(), 10485760, stats.StorageQuota)
	assert.Equal(suite.T(), 512, stats.StorageSavings)
}

func TestUserServiceSuite(t *testing.T) {
	suite.Run(t, new(UserServiceTestSuite))
}