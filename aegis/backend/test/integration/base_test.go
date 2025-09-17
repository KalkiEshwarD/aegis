// Package integration provides integration test infrastructure for the Aegis backend.
//
// SETUP INSTRUCTIONS:
//
// 1. Directory Structure:
//    The integration tests are located in aegis/backend/test/integration/
//    - base_test.go: Base test suite with common setup/teardown
//    - test_db.go: Test database configuration and setup
//    - helpers.go: Database helpers for setup/teardown and data management
//    - graphql_client.go: GraphQL client for making test requests
//    - mock_data.go: Functions to create test data
//
// 2. Dependencies:
//    Required dependencies have been added to go.mod:
//    - github.com/stretchr/testify (for test suites and assertions)
//    - github.com/machinebox/graphql (for GraphQL client)
//    - SQLite driver is already included for test database
//
// 3. Test Database:
//    - Uses SQLite in-memory database by default for fast testing
//    - Can be configured to use temporary files for debugging
//    - Automatically migrates schema using GORM AutoMigrate
//
// 4. Creating Integration Tests:
//
//    a) Create a new test file (e.g., auth_integration_test.go):
//
//       package integration
//
//       import "testing"
//       import "github.com/stretchr/testify/suite"
//
//       type AuthIntegrationTestSuite struct {
//           BaseIntegrationTestSuite
//       }
//
//       func (suite *AuthIntegrationTestSuite) TestUserLogin() {
//           // Your test code here
//           // Access suite.TestData.AdminUser, suite.Server, etc.
//       }
//
//       func TestAuthIntegration(t *testing.T) {
//           suite.Run(t, &AuthIntegrationTestSuite{})
//       }
//
//    b) Use the GraphQL client:
//
//       ctx := context.Background()
//       query := `
//           mutation Login($email: String!, $password: String!) {
//               login(email: $email, password: $password) {
//                   token
//                   user {
//                       id
//                       email
//                   }
//               }
//           }
//       `
//       variables := map[string]interface{}{
//           "email":    suite.TestData.AdminUser.Email,
//           "password": "password123",
//       }
//
//       var response struct {
//           Login struct {
//               Token string `json:"token"`
//               User  struct {
//                   ID    string `json:"id"`
//                   Email string `json:"email"`
//               } `json:"user"`
//           } `json:"login"`
//       }
//
//       err := suite.Server.MakeAuthenticatedRequest(ctx, "", query, variables, &response)
//       suite.NoError(err)
//
// 5. Available Test Data:
//    The BaseIntegrationTestSuite automatically creates:
//    - AdminUser: Administrator user (admin@test.com / password123)
//    - RegularUser: Regular user (user@test.com / password123)
//    - AnotherUser: Another regular user (user2@test.com / password123)
//    - File1, File2: Test files
//    - UserFile1, UserFile2: User files
//    - Room: Test room with members
//
// 6. Running Tests:
//    - Run all integration tests: go test ./test/integration/
//    - Run specific test: go test ./test/integration/ -run TestAuthIntegration
//    - With verbose output: go test ./test/integration/ -v
//
// 7. Best Practices:
//    - Each test should be independent and not rely on other tests
//    - Use suite.TestData for consistent test data
//    - Clean up is handled automatically by TearDownTest
//    - Use descriptive test names that indicate what is being tested
//    - Test both success and error scenarios
//
// 8. Extending the Framework:
//    - Add new helper methods to BaseIntegrationTestSuite
//    - Create additional mock data functions in mock_data.go
//    - Add new GraphQL client methods as needed
//
// 9. Troubleshooting:
//    - Check test logs for database connection issues
//    - Use NewTestDBConfigWithFile for debugging database state
//    - Ensure GraphQL server is running on expected port
//    - Verify JWT tokens are properly formatted

package integration

import (
	"context"
	"errors"

	"github.com/stretchr/testify/suite"
	"gorm.io/gorm"

	"github.com/balkanid/aegis-backend/internal/config"
	"github.com/balkanid/aegis-backend/internal/models"
)

// BaseIntegrationTestSuite provides common setup and teardown for integration tests
type BaseIntegrationTestSuite struct {
	suite.Suite
	DBConfig    *TestDBConfig
	TestDB      *gorm.DB
	Server      *TestGraphQLServer
	TestData    *TestData
	Config      *config.Config
}

// SetupSuite is called once before all tests in the suite
func (suite *BaseIntegrationTestSuite) SetupSuite() {
	// Create test configuration
	suite.Config = &config.Config{
		GinMode:        "test",
		JWTSecret:      "test_jwt_secret_key_for_integration_tests",
		Port:           "8081", // Use a different port for tests
		DatabaseURL:    "",     // Will be set by test database
		MinIOEndpoint:  "",     // Disable MinIO for tests
		MinIOAccessKey: "",
		MinIOSecretKey: "",
		MinIOBucket:    "",
	}

	// Setup will be called in SetupTest for each test
}

// SetupTest is called before each test method
func (suite *BaseIntegrationTestSuite) SetupTest() {
	// Create test database configuration
	suite.DBConfig = NewTestDBConfig()

	// Setup test database
	var err error
	suite.TestDB, err = suite.DBConfig.SetupTestDB()
	suite.Require().NoError(err, "Failed to setup test database")

	// Setup database schema
	err = SetupTestDatabase(suite.TestDB)
	suite.Require().NoError(err, "Failed to setup database schema")

	// Create test GraphQL server
	suite.Server = NewTestGraphQLServer(suite.Config)

	// Setup basic test data
	suite.TestData, err = SetupBasicTestData(suite.TestDB)
	suite.Require().NoError(err, "Failed to setup basic test data")
}

// TearDownTest is called after each test method
func (suite *BaseIntegrationTestSuite) TearDownTest() {
	// Clean up test data
	if suite.TestDB != nil {
		err := ResetTestDatabase(suite.TestDB)
		suite.NoError(err, "Failed to reset test database")
	}

	// Close test server
	if suite.Server != nil {
		suite.Server.Close()
	}

	// Clean up test database file
	if suite.DBConfig != nil {
		err := suite.DBConfig.CleanupTestDB()
		suite.NoError(err, "Failed to cleanup test database")
	}
}

// TearDownSuite is called once after all tests in the suite
func (suite *BaseIntegrationTestSuite) TearDownSuite() {
	// Any global cleanup can go here
}

// Helper methods for common test operations

// LoginUser performs a login and returns the JWT token
func (suite *BaseIntegrationTestSuite) LoginUser(email, password string) (string, error) {
	// This would typically make a GraphQL mutation call
	// For now, we'll simulate the login process
	// In a real implementation, you'd use suite.Server.MakeAuthenticatedRequest

	// Placeholder - implement actual login logic
	return "mock_jwt_token", nil
}

// CreateAuthenticatedClient creates a GraphQL client with authentication
func (suite *BaseIntegrationTestSuite) CreateAuthenticatedClient(token string) *TestGraphQLServer {
	// Create a new server instance for authenticated requests
	authServer := NewTestGraphQLServer(suite.Config)
	// Note: In practice, you'd set the auth token on the client
	return authServer
}

// AssertGraphQLError asserts that a GraphQL response contains an error
func (suite *BaseIntegrationTestSuite) AssertGraphQLError(response interface{}, expectedError string) {
	// Check if response has errors field
	responseMap, ok := response.(map[string]interface{})
	if ok {
		if errors, exists := responseMap["errors"]; exists {
			suite.NotNil(errors, "Errors should not be nil")
			errorList, ok := errors.([]interface{})
			suite.True(ok, "Errors should be an array")

			if len(errorList) > 0 {
				errorMap, ok := errorList[0].(map[string]interface{})
				suite.True(ok, "First error should be a map")

				if message, exists := errorMap["message"]; exists {
					suite.Contains(message.(string), expectedError, "Error message should contain expected text")
				}
			}
		} else {
			// If no errors field, the error might be indicated by missing data or other fields
			suite.Fail("Expected GraphQL error but no errors field found in response")
		}
	} else {
		// For typed responses, we can't check for errors in the response structure
		// The error would have been thrown by the GraphQL client instead
		suite.Fail("Cannot check for GraphQL errors in typed response - error should have been thrown by client")
	}
}

// MakeRequestWithErrorHandling executes a GraphQL query and handles errors properly
func (suite *BaseIntegrationTestSuite) MakeRequestWithErrorHandling(ctx context.Context, query string, variables map[string]interface{}, response interface{}) error {
	return suite.Server.MakeRequest(ctx, query, variables, response)
}

// MakeAuthenticatedRequestWithErrorHandling executes an authenticated GraphQL query and handles errors properly
func (suite *BaseIntegrationTestSuite) MakeAuthenticatedRequestWithErrorHandling(ctx context.Context, token string, query string, variables map[string]interface{}, response interface{}) error {
	return suite.Server.MakeAuthenticatedRequest(ctx, token, query, variables, response)
}

// AssertGraphQLSuccess asserts that a GraphQL response is successful
func (suite *BaseIntegrationTestSuite) AssertGraphQLSuccess(response interface{}) {
	// For typed responses (structs), we assume success if no error was returned from the client
	// For raw responses, check the structure
	if responseMap, ok := response.(map[string]interface{}); ok {
		// Check that there are no errors
		if errors, exists := responseMap["errors"]; exists {
			suite.Nil(errors, "Response should not contain errors")
		}

		// Check that data exists
		_, exists := responseMap["data"]
		suite.True(exists, "Response should contain data field")
	}
	// For typed struct responses, success is implied by the lack of error from the GraphQL client
}

// AssertGraphQLDataExists asserts that specific data exists in GraphQL response
func (suite *BaseIntegrationTestSuite) AssertGraphQLDataExists(response interface{}, dataPath ...string) interface{} {
	responseMap, ok := response.(map[string]interface{})
	suite.True(ok, "Response should be a map")

	data, exists := responseMap["data"]
	suite.True(exists, "Response should contain data field")

	current := data.(map[string]interface{})
	for _, path := range dataPath {
		val, exists := current[path]
		suite.True(exists, "Data path %s should exist", path)
		current = val.(map[string]interface{})
	}

	return current
}

// AssertUserExistsInDB asserts that a user exists in the database with given email
func (suite *BaseIntegrationTestSuite) AssertUserExistsInDB(email string) *models.User {
	var user models.User
	err := suite.TestDB.Where("email = ?", email).First(&user).Error
	suite.NoError(err, "User should exist in database")
	return &user
}

// AssertUserNotExistsInDB asserts that a user does not exist in the database
func (suite *BaseIntegrationTestSuite) AssertUserNotExistsInDB(email string) {
	var user models.User
	err := suite.TestDB.Where("email = ?", email).First(&user).Error
	suite.Error(err, "User should not exist in database")
	suite.True(errors.Is(err, gorm.ErrRecordNotFound), "Error should be record not found")
}

// AssertFileExistsInDB asserts that a file exists in the database with given hash
func (suite *BaseIntegrationTestSuite) AssertFileExistsInDB(contentHash string) *models.File {
	var file models.File
	err := suite.TestDB.Where("content_hash = ?", contentHash).First(&file).Error
	suite.NoError(err, "File should exist in database")
	return &file
}

// AssertRoomExistsInDB asserts that a room exists in the database with given name
func (suite *BaseIntegrationTestSuite) AssertRoomExistsInDB(name string) *models.Room {
	var room models.Room
	err := suite.TestDB.Where("name = ?", name).First(&room).Error
	suite.NoError(err, "Room should exist in database")
	return &room
}

// AssertUserFileCount asserts the count of user files for a given user
func (suite *BaseIntegrationTestSuite) AssertUserFileCount(userID uint, expectedCount int) {
	var count int64
	err := suite.TestDB.Model(&models.UserFile{}).Where("user_id = ?", userID).Count(&count).Error
	suite.NoError(err, "Should be able to count user files")
	suite.Equal(int64(expectedCount), count, "User file count should match expected")
}

// AssertRoomMemberCount asserts the count of room members for a given room
func (suite *BaseIntegrationTestSuite) AssertRoomMemberCount(roomID uint, expectedCount int) {
	var count int64
	err := suite.TestDB.Model(&models.RoomMember{}).Where("room_id = ?", roomID).Count(&count).Error
	suite.NoError(err, "Should be able to count room members")
	suite.Equal(int64(expectedCount), count, "Room member count should match expected")
}

// Usage: Create a struct that embeds BaseIntegrationTestSuite and implements specific test methods
// Example:
// type MyIntegrationTestSuite struct {
//     BaseIntegrationTestSuite
// }
//
// func (suite *MyIntegrationTestSuite) TestSomething() {
//     // Your test code here
// }
//
// func TestMyIntegration(t *testing.T) {
//     suite.Run(t, &MyIntegrationTestSuite{})
// }

// Example test methods that can be overridden in specific test suites

// TestUserAuthentication tests user login, registration, and authentication flows
func (suite *BaseIntegrationTestSuite) TestUserAuthentication() {
	suite.T().Skip("Base test - override in specific test suite")
}

// TestFileOperations tests file upload, download, and management operations
func (suite *BaseIntegrationTestSuite) TestFileOperations() {
	suite.T().Skip("Base test - override in specific test suite")
}

// TestRoomManagement tests room creation, member management, and file sharing
func (suite *BaseIntegrationTestSuite) TestRoomManagement() {
	suite.T().Skip("Base test - override in specific test suite")
}

// TestAdminOperations tests admin-specific operations like user management
func (suite *BaseIntegrationTestSuite) TestAdminOperations() {
	suite.T().Skip("Base test - override in specific test suite")
}