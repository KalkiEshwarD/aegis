package integration

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/suite"

	"github.com/balkanid/aegis-backend/internal/database"
	"github.com/balkanid/aegis-backend/internal/models"
	"github.com/balkanid/aegis-backend/internal/services"
)

type ShareIntegrationTestSuite struct {
	BaseIntegrationTestSuite
	shareService *services.ShareService
}

func (suite *ShareIntegrationTestSuite) SetupTest() {
	// Call parent setup
	suite.BaseIntegrationTestSuite.SetupTest()

	// Create crypto manager for testing
	cryptoManager, err := services.NewCryptoManager()
	if err != nil {
		suite.T().Fatalf("Failed to create crypto manager: %v", err)
	}

	// Create database service wrapper
	dbService := database.NewDB(suite.TestDB)

	suite.shareService = services.NewShareService(dbService, "http://localhost:8080", cryptoManager)
}

func (suite *ShareIntegrationTestSuite) TestCreateShareWithUsernameRestrictions() {
	allowedUsernames := []string{"alice", "bob", "charlie"}
	fileShare, err := suite.shareService.CreateShare(suite.TestData.UserFile1.ID, "Password123!", 5, nil, allowedUsernames)

	assert.NoError(suite.T(), err)
	assert.NotNil(suite.T(), fileShare)
	assert.Equal(suite.T(), allowedUsernames, fileShare.AllowedUsernames)

	// Verify share was created in database
	var dbShare models.FileShare
	err = suite.TestDB.Preload("UserFile").Where("id = ?", fileShare.ID).First(&dbShare).Error
	assert.NoError(suite.T(), err)
	assert.Equal(suite.T(), allowedUsernames, dbShare.AllowedUsernames)
}

func (suite *ShareIntegrationTestSuite) TestCreateShareWithoutUsernameRestrictions() {
	fileShare, err := suite.shareService.CreateShare(suite.TestData.UserFile1.ID, "Password123!", 5, nil, nil)

	assert.NoError(suite.T(), err)
	assert.NotNil(suite.T(), fileShare)
	assert.Nil(suite.T(), fileShare.AllowedUsernames)

	// Verify share was created in database
	var dbShare models.FileShare
	err = suite.TestDB.Preload("UserFile").Where("id = ?", fileShare.ID).First(&dbShare).Error
	assert.NoError(suite.T(), err)
	assert.Nil(suite.T(), dbShare.AllowedUsernames)
}

func (suite *ShareIntegrationTestSuite) TestUsernameAuthorization_AllowedUser() {
	// Create share with username restrictions
	allowedUsernames := []string{"alice", "bob"}
	fileShare, err := suite.shareService.CreateShare(suite.TestData.UserFile1.ID, "Password123!", 5, nil, allowedUsernames)
	assert.NoError(suite.T(), err)

	// Create a mock user "alice"
	aliceUser := models.User{
		Username:     "alice",
		Email:        "alice@example.com",
		PasswordHash: "hash",
		StorageQuota: 10485760,
		UsedStorage:  0,
		IsAdmin:      false,
	}
	err = suite.TestDB.Create(&aliceUser).Error
	assert.NoError(suite.T(), err)

	// Test authorization logic (simulating what happens in GraphQL resolver)
	isAuthorized := suite.checkUsernameAuthorization(fileShare, &aliceUser)
	assert.True(suite.T(), isAuthorized, "User 'alice' should be authorized")
}

func (suite *ShareIntegrationTestSuite) TestUsernameAuthorization_DeniedUser() {
	// Create share with username restrictions
	allowedUsernames := []string{"alice", "bob"}
	fileShare, err := suite.shareService.CreateShare(suite.TestData.UserFile1.ID, "Password123!", 5, nil, allowedUsernames)
	assert.NoError(suite.T(), err)

	// Create a mock user "charlie" (not in allowed list)
	charlieUser := models.User{
		Username:     "charlie",
		Email:        "charlie@example.com",
		PasswordHash: "hash",
		StorageQuota: 10485760,
		UsedStorage:  0,
		IsAdmin:      false,
	}
	err = suite.TestDB.Create(&charlieUser).Error
	assert.NoError(suite.T(), err)

	// Test authorization logic
	isAuthorized := suite.checkUsernameAuthorization(fileShare, &charlieUser)
	assert.False(suite.T(), isAuthorized, "User 'charlie' should not be authorized")
}

func (suite *ShareIntegrationTestSuite) TestUsernameAuthorization_NoRestrictions() {
	// Create share without username restrictions
	fileShare, err := suite.shareService.CreateShare(suite.TestData.UserFile1.ID, "Password123!", 5, nil, nil)
	assert.NoError(suite.T(), err)

	// Create a mock user
	testUser := models.User{
		Username:     "anyuser",
		Email:        "anyuser@example.com",
		PasswordHash: "hash",
		StorageQuota: 10485760,
		UsedStorage:  0,
		IsAdmin:      false,
	}
	err = suite.TestDB.Create(&testUser).Error
	assert.NoError(suite.T(), err)

	// Test authorization logic - should be authorized since no restrictions
	isAuthorized := suite.checkUsernameAuthorization(fileShare, &testUser)
	assert.True(suite.T(), isAuthorized, "Any user should be authorized when no restrictions are set")
}

func (suite *ShareIntegrationTestSuite) TestUsernameAuthorization_EmptyRestrictions() {
	// Create share with empty username restrictions
	allowedUsernames := []string{}
	fileShare, err := suite.shareService.CreateShare(suite.TestData.UserFile1.ID, "Password123!", 5, nil, allowedUsernames)
	assert.NoError(suite.T(), err)

	// Create a mock user
	testUser := models.User{
		Username:     "anyuser",
		Email:        "anyuser@example.com",
		PasswordHash: "hash",
		StorageQuota: 10485760,
		UsedStorage:  0,
		IsAdmin:      false,
	}
	err = suite.TestDB.Create(&testUser).Error
	assert.NoError(suite.T(), err)

	// Test authorization logic - should be authorized since empty restrictions means public
	isAuthorized := suite.checkUsernameAuthorization(fileShare, &testUser)
	assert.True(suite.T(), isAuthorized, "Any user should be authorized when restrictions are empty")
}

// Helper method to check username authorization (mimics GraphQL resolver logic)
func (suite *ShareIntegrationTestSuite) checkUsernameAuthorization(fileShare *models.FileShare, user *models.User) bool {
	if user == nil {
		return false
	}

	if len(fileShare.AllowedUsernames) == 0 {
		return true // No restrictions means public access
	}

	// Check if the user's username is in the allowed list
	for _, allowedUsername := range fileShare.AllowedUsernames {
		if user.Username == allowedUsername {
			return true
		}
	}

	return false
}

func TestShareIntegrationTestSuite(t *testing.T) {
	suite.Run(t, new(ShareIntegrationTestSuite))
}
