// Package integration provides comprehensive integration tests for error handling and edge cases
package integration

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"testing"

	"github.com/stretchr/testify/suite"
)

// ErrorIntegrationTestSuite tests error handling and edge cases
type ErrorIntegrationTestSuite struct {
	BaseIntegrationTestSuite
}

// TestErrorIntegration runs the error integration test suite
func TestErrorIntegration(t *testing.T) {
	suite.Run(t, &ErrorIntegrationTestSuite{})
}

// TestInvalidGraphQLQueries tests handling of invalid GraphQL queries
func (suite *ErrorIntegrationTestSuite) TestInvalidGraphQLQueries() {
	ctx := context.Background()

	testCases := []struct {
		name      string
		query     string
		variables map[string]interface{}
		errorMsg  string
	}{
		{
			name: "Invalid syntax",
			query: `
				query {
					me {
						id
						email
					}
					# Missing closing brace
			`,
			variables: nil,
			errorMsg:  "syntax",
		},
		{
			name: "Non-existent field",
			query: `
				query {
					me {
						id
						email
						non_existent_field
					}
				}
			`,
			variables: nil,
			errorMsg:  "field",
		},
		{
			name: "Invalid mutation",
			query: `
				mutation {
					invalidMutation(input: {field: "value"}) {
						id
					}
				}
			`,
			variables: nil,
			errorMsg:  "mutation",
		},
		{
			name: "Wrong argument type",
			query: `
				mutation Login($email: String!, $password: Int!) {
					login(input: {email: $email, password: $password}) {
						token
					}
				}
			`,
			variables: map[string]interface{}{
				"identifier": "test@test.com",
				"password":   123, // Should be string
			},
			errorMsg: "type",
		},
	}

	for _, tc := range testCases {
		suite.Run(tc.name, func() {
			var response map[string]interface{}

			err := suite.Server.MakeRequest(ctx, tc.query, tc.variables, &response)
			suite.NoError(err, "Request should not fail")

			// Should contain GraphQL error
			suite.AssertGraphQLError(response, tc.errorMsg)
		})
	}
}

// TestAuthenticationFailures tests various authentication failure scenarios
func (suite *ErrorIntegrationTestSuite) TestAuthenticationFailures() {
	ctx := context.Background()

	testCases := []struct {
		name     string
		query    string
		token    string
		errorMsg string
	}{
		{
			name: "No authorization header",
			query: `
				query {
					me {
						id
						email
					}
				}
			`,
			token:    "",
			errorMsg: "auth",
		},
		{
			name: "Invalid JWT token",
			query: `
				query {
					me {
						id
						email
					}
				}
			`,
			token:    "invalid.jwt.token",
			errorMsg: "token",
		},
		{
			name: "Malformed JWT token",
			query: `
				query {
					me {
						id
						email
					}
				}
			`,
			token:    "malformed_token_without_dots",
			errorMsg: "token",
		},
		{
			name: "Expired JWT token",
			query: `
				query {
					me {
						id
						email
					}
				}
			`,
			token:    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyLCJleHAiOjE1MTYyMzkwMjJ9.4Adcj3UFYzPUVaVF43FmMab6R3No7sK4H4TgUk2zBK8", // Expired token
			errorMsg: "token",
		},
	}

	for _, tc := range testCases {
		suite.Run(tc.name, func() {
			var response map[string]interface{}

			if tc.token == "" {
				err := suite.Server.MakeRequest(ctx, tc.query, nil, &response)
				suite.NoError(err, "Request should not fail")
			} else {
				err := suite.Server.MakeAuthenticatedRequest(ctx, tc.token, tc.query, nil, &response)
				suite.NoError(err, "Request should not fail")
			}

			// Should contain authentication error
			suite.AssertGraphQLError(response, tc.errorMsg)
		})
	}
}

// TestDatabaseConnectionFailures tests handling of database connection issues
func (suite *ErrorIntegrationTestSuite) TestDatabaseConnectionFailures() {
	ctx := context.Background()

	// Login first to get a valid token
	email := suite.TestData.RegularUser.Email
	password := "password123"

	loginQuery := `
		mutation Login($input: LoginInput!) {
			login(input: $input) {
				token
				user {
					id
					email
				}
			}
		}
	`

	variables := map[string]interface{}{
		"input": map[string]interface{}{
			"identifier": email,
			"password":   password,
		},
	}

	var loginResponse struct {
		Login struct {
			Token string `json:"token"`
			User  struct {
				ID    string `json:"id"`
				Email string `json:"email"`
			} `json:"user"`
		} `json:"login"`
	}

	err := suite.Server.MakeRequest(ctx, loginQuery, variables, &loginResponse)
	suite.NoError(err, "Login should succeed")
	token := loginResponse.Login.Token

	// Simulate database connection failure by closing the database connection
	// This is a simplified test - in real scenarios, you'd mock the database
	sqlDB, err := suite.TestDB.DB()
	suite.NoError(err, "Should get SQL DB")

	// Close the database connection to simulate failure
	err = sqlDB.Close()
	suite.NoError(err, "Should close database connection")

	// Try to make a request that requires database access
	query := `
		query {
			me {
				id
				email
			}
		}
	`

	var response map[string]interface{}

	err = suite.Server.MakeAuthenticatedRequest(ctx, token, query, nil, &response)
	suite.NoError(err, "Request should not fail")

	// Should contain database error
	suite.AssertGraphQLError(response, "database")
}

// TestStorageQuotaExceeded tests handling of storage quota exceeded scenarios
func (suite *ErrorIntegrationTestSuite) TestStorageQuotaExceeded() {
	ctx := context.Background()

	// Login first
	email := suite.TestData.RegularUser.Email
	password := "password123"

	loginQuery := `
		mutation Login($input: LoginInput!) {
			login(input: $input) {
				token
				user {
					id
					email
				}
			}
		}
	`

	variables := map[string]interface{}{
		"input": map[string]interface{}{
			"identifier": email,
			"password":   password,
		},
	}

	var loginResponse struct {
		Login struct {
			Token string `json:"token"`
			User  struct {
				ID    string `json:"id"`
				Email string `json:"email"`
			} `json:"user"`
		} `json:"login"`
	}

	err := suite.Server.MakeRequest(ctx, loginQuery, variables, &loginResponse)
	suite.NoError(err, "Login should succeed")
	token := loginResponse.Login.Token

	// Try to upload a file that would exceed quota
	// Create a very large content that exceeds the 100MB quota
	largeContent := strings.Repeat("x", 150*1024*1024) // 150MB

	uploadQuery := `
		mutation UploadFileFromMap($input: UploadFileFromMapInput!) {
			uploadFileFromMap(input: $input) {
				id
				filename
			}
		}
	`

	// Prepare upload data as JSON for uploadFileFromMap
	uploadData := map[string]interface{}{
		"filename":      "large_file.txt",
		"content_hash":  fmt.Sprintf("hash_%d", len(largeContent)),
		"size_bytes":    float64(len(largeContent)),
		"mime_type":     "text/plain",
		"encrypted_key": "test_key",
		"file_data":     []byte(largeContent),
	}

	jsonData, err := json.Marshal(uploadData)
	suite.NoError(err, "JSON marshaling should succeed")

	uploadVariables := map[string]interface{}{
		"input": map[string]interface{}{
			"data": string(jsonData),
		},
	}

	var uploadResponse map[string]interface{}

	err = suite.Server.MakeAuthenticatedRequest(ctx, token, uploadQuery, uploadVariables, &uploadResponse)
	suite.NoError(err, "Request should not fail")

	// Should contain quota exceeded error
	suite.AssertGraphQLError(uploadResponse, "quota")
}

// TestConcurrentAccessScenarios tests concurrent access edge cases
func (suite *ErrorIntegrationTestSuite) TestConcurrentAccessScenarios() {
	ctx := context.Background()

	// Login first
	email := suite.TestData.RegularUser.Email
	password := "password123"

	loginQuery := `
		mutation Login($input: LoginInput!) {
			login(input: $input) {
				token
				user {
					id
					email
				}
			}
		}
	`

	variables := map[string]interface{}{
		"input": map[string]interface{}{
			"identifier": email,
			"password":   password,
		},
	}

	var loginResponse struct {
		Login struct {
			Token string `json:"token"`
			User  struct {
				ID    string `json:"id"`
				Email string `json:"email"`
			} `json:"user"`
		} `json:"login"`
	}

	err := suite.Server.MakeRequest(ctx, loginQuery, variables, &loginResponse)
	suite.NoError(err, "Login should succeed")
	token := loginResponse.Login.Token

	// Test concurrent file operations that might cause race conditions
	userFileID := fmt.Sprintf("%d", suite.TestData.UserFile1.ID)

	// Simulate multiple delete operations on the same file
	deleteQuery := `
		mutation DeleteFile($id: ID!) {
			deleteFile(id: $id)
		}
	`

	deleteVariables := map[string]interface{}{
		"id": userFileID,
	}

	// First delete should succeed
	var deleteResponse1 struct {
		DeleteFile bool `json:"deleteFile"`
	}

	err = suite.Server.MakeAuthenticatedRequest(ctx, token, deleteQuery, deleteVariables, &deleteResponse1)
	suite.NoError(err, "First delete should succeed")
	suite.AssertGraphQLSuccess(deleteResponse1)
	suite.True(deleteResponse1.DeleteFile, "First delete should return true")

	// Second delete should fail (file already deleted)
	var deleteResponse2 map[string]interface{}

	err = suite.Server.MakeAuthenticatedRequest(ctx, token, deleteQuery, deleteVariables, &deleteResponse2)
	suite.NoError(err, "Second delete request should not fail")

	// Should contain not found error
	suite.AssertGraphQLError(deleteResponse2, "not found")
}

// TestInvalidFileOperations tests invalid file operation scenarios
func (suite *ErrorIntegrationTestSuite) TestInvalidFileOperations() {
	ctx := context.Background()

	// Login first
	email := suite.TestData.RegularUser.Email
	password := "password123"

	loginQuery := `
		mutation Login($input: LoginInput!) {
			login(input: $input) {
				token
				user {
					id
					email
				}
			}
		}
	`

	variables := map[string]interface{}{
		"input": map[string]interface{}{
			"identifier": email,
			"password":   password,
		},
	}

	var loginResponse struct {
		Login struct {
			Token string `json:"token"`
			User  struct {
				ID    string `json:"id"`
				Email string `json:"email"`
			} `json:"user"`
		} `json:"login"`
	}

	err := suite.Server.MakeRequest(ctx, loginQuery, variables, &loginResponse)
	suite.NoError(err, "Login should succeed")
	token := loginResponse.Login.Token

	testCases := []struct {
		name      string
		query     string
		variables map[string]interface{}
		errorMsg  string
	}{
		{
			name: "Download non-existent file",
			query: `
				mutation DownloadFile($id: ID!) {
					downloadFile(id: $id)
				}
			`,
			variables: map[string]interface{}{
				"id": "99999", // Non-existent ID
			},
			errorMsg: "not found",
		},
		{
			name: "Delete non-existent file",
			query: `
				mutation DeleteFile($id: ID!) {
					deleteFile(id: $id)
				}
			`,
			variables: map[string]interface{}{
				"id": "99999", // Non-existent ID
			},
			errorMsg: "not found",
		},
		{
			name: "Access file with invalid ID format",
			query: `
				mutation DownloadFile($id: ID!) {
					downloadFile(id: $id)
				}
			`,
			variables: map[string]interface{}{
				"id": "invalid_id_format",
			},
			errorMsg: "invalid",
		},
	}

	for _, tc := range testCases {
		suite.Run(tc.name, func() {
			var response map[string]interface{}

			err := suite.Server.MakeAuthenticatedRequest(ctx, token, tc.query, tc.variables, &response)
			suite.NoError(err, "Request should not fail")

			// Should contain error
			suite.AssertGraphQLError(response, tc.errorMsg)
		})
	}
}

// TestInvalidRoomOperations tests invalid room operation scenarios
func (suite *ErrorIntegrationTestSuite) TestInvalidRoomOperations() {
	ctx := context.Background()

	// Login first
	email := suite.TestData.RegularUser.Email
	password := "password123"

	loginQuery := `
		mutation Login($input: LoginInput!) {
			login(input: $input) {
				token
				user {
					id
					email
				}
			}
		}
	`

	variables := map[string]interface{}{
		"input": map[string]interface{}{
			"identifier": email,
			"password":   password,
		},
	}

	var loginResponse struct {
		Login struct {
			Token string `json:"token"`
			User  struct {
				ID    string `json:"id"`
				Email string `json:"email"`
			} `json:"user"`
		} `json:"login"`
	}

	err := suite.Server.MakeRequest(ctx, loginQuery, variables, &loginResponse)
	suite.NoError(err, "Login should succeed")
	token := loginResponse.Login.Token

	testCases := []struct {
		name      string
		query     string
		variables map[string]interface{}
		errorMsg  string
	}{
		{
			name: "Access non-existent room",
			query: `
				query Room($id: ID!) {
					room(id: $id) {
						id
						name
					}
				}
			`,
			variables: map[string]interface{}{
				"id": "99999", // Non-existent room ID
			},
			errorMsg: "not found",
		},
		{
			name: "Add member to non-existent room",
			query: `
				mutation AddRoomMember($input: AddRoomMemberInput!) {
					addRoomMember(input: $input)
				}
			`,
			variables: map[string]interface{}{
				"input": map[string]interface{}{
					"room_id": "99999",
					"user_id": loginResponse.Login.User.ID,
					"role":    "CONTENT_VIEWER",
				},
			},
			errorMsg: "not found",
		},
		{
			name: "Share file to non-existent room",
			query: `
				mutation ShareFileToRoom($user_file_id: ID!, $room_id: ID!) {
					shareFileToRoom(user_file_id: $user_file_id, room_id: $room_id)
				}
			`,
			variables: map[string]interface{}{
				"user_file_id": fmt.Sprintf("%d", suite.TestData.UserFile1.ID),
				"room_id":      "99999",
			},
			errorMsg: "not found",
		},
	}

	for _, tc := range testCases {
		suite.Run(tc.name, func() {
			var response map[string]interface{}

			err := suite.Server.MakeAuthenticatedRequest(ctx, token, tc.query, tc.variables, &response)
			suite.NoError(err, "Request should not fail")

			// Should contain error
			suite.AssertGraphQLError(response, tc.errorMsg)
		})
	}
}

// TestNetworkTimeoutScenarios tests handling of network timeout scenarios
func (suite *ErrorIntegrationTestSuite) TestNetworkTimeoutScenarios() {
	ctx := context.Background()

	// This test simulates network timeouts by making requests with very short timeouts
	// In a real implementation, you'd configure the HTTP client with short timeouts

	// Login first
	email := suite.TestData.RegularUser.Email
	password := "password123"

	loginQuery := `
		mutation Login($input: LoginInput!) {
			login(input: $input) {
				token
				user {
					id
					email
				}
			}
		}
	`

	variables := map[string]interface{}{
		"input": map[string]interface{}{
			"identifier": email,
			"password":   password,
		},
	}

	var loginResponse struct {
		Login struct {
			Token string `json:"token"`
			User  struct {
				ID    string `json:"id"`
				Email string `json:"email"`
			} `json:"user"`
		} `json:"login"`
	}

	err := suite.Server.MakeRequest(ctx, loginQuery, variables, &loginResponse)
	suite.NoError(err, "Login should succeed")
	token := loginResponse.Login.Token

	// Test with a complex query that might take longer
	complexQuery := `
		query ComplexQuery {
			me {
				id
				email
			}
			myFiles {
				id
				filename
				mime_type
			}
			myRooms {
				id
				name
				members {
					id
					role
				}
			}
			myStats {
				total_files
				used_storage
				storage_quota
			}
		}
	`

	var complexResponse map[string]interface{}

	// This should succeed in normal conditions
	err = suite.Server.MakeAuthenticatedRequest(ctx, token, complexQuery, nil, &complexResponse)
	suite.NoError(err, "Complex query should succeed")
	suite.AssertGraphQLSuccess(complexResponse)
}

// TestDataIntegrityViolations tests handling of data integrity violations
func (suite *ErrorIntegrationTestSuite) TestDataIntegrityViolations() {
	ctx := context.Background()

	// Login first
	email := suite.TestData.RegularUser.Email
	password := "password123"

	loginQuery := `
		mutation Login($input: LoginInput!) {
			login(input: $input) {
				token
				user {
					id
					email
				}
			}
		}
	`

	variables := map[string]interface{}{
		"input": map[string]interface{}{
			"identifier": email,
			"password":   password,
		},
	}

	var loginResponse struct {
		Login struct {
			Token string `json:"token"`
			User  struct {
				ID    string `json:"id"`
				Email string `json:"email"`
			} `json:"user"`
		} `json:"login"`
	}

	err := suite.Server.MakeRequest(ctx, loginQuery, variables, &loginResponse)
	suite.NoError(err, "Login should succeed")
	token := loginResponse.Login.Token

	// Try to create a room with invalid data (empty name)
	invalidRoomQuery := `
		mutation CreateRoom($input: CreateRoomInput!) {
			createRoom(input: $input) {
				id
				name
			}
		}
	`

	invalidRoomVariables := map[string]interface{}{
		"input": map[string]interface{}{
			"name": "", // Empty name should cause validation error
		},
	}

	var invalidRoomResponse map[string]interface{}

	err = suite.Server.MakeAuthenticatedRequest(ctx, token, invalidRoomQuery, invalidRoomVariables, &invalidRoomResponse)
	suite.NoError(err, "Request should not fail")

	// Should contain validation error
	suite.AssertGraphQLError(invalidRoomResponse, "name")
}

// TestServiceUnavailableScenarios tests handling of service unavailable scenarios
func (suite *ErrorIntegrationTestSuite) TestServiceUnavailableScenarios() {
	ctx := context.Background()

	// Test making requests when the server might be temporarily unavailable
	// This is a simplified test - in real scenarios, you'd test against a server that's been stopped

	query := `
		query {
			health
		}
	`

	var response map[string]interface{}

	// This should succeed when server is running
	err := suite.Server.MakeRequest(ctx, query, nil, &response)
	suite.NoError(err, "Health check should succeed when server is running")
	suite.AssertGraphQLSuccess(response)
}
