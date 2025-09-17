package integration

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/suite"
)

// UploadFromMapIntegrationTestSuite tests the new uploadFileFromMap functionality
type UploadFromMapIntegrationTestSuite struct {
	BaseIntegrationTestSuite
}

// TestUploadFromMapIntegration runs the upload from map integration test suite
func TestUploadFromMapIntegration(t *testing.T) {
	suite.Run(t, &UploadFromMapIntegrationTestSuite{})
}

// TestUploadFileFromMap_Success tests successful file upload using map data
func (suite *UploadFromMapIntegrationTestSuite) TestUploadFileFromMap_Success() {
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
			"email":    email,
			"password": password,
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

	// Prepare upload data as a map (this is the key test - converting map to upload)
	uploadData := map[string]interface{}{
		"filename":     "test-from-map.pdf",
		"mime_type":    "application/pdf",
		"size_bytes":   float64(1024), // JSON numbers are float64
		"content_hash": "hash-from-map-123",
		"encrypted_key": "encrypted-key-123",
		"file_data":    []byte("test file content for map upload"),
	}

	// Convert to JSON string (this solves the original problem)
	jsonData, err := json.Marshal(uploadData)
	suite.NoError(err, "JSON marshaling should succeed")

	// Test the new uploadFileFromMap mutation
	uploadMutation := `
		mutation UploadFileFromMap($input: UploadFileFromMapInput!) {
			uploadFileFromMap(input: $input) {
				id
				filename
				mime_type
				user_id
				file {
					size_bytes
					content_hash
				}
			}
		}
	`

	uploadVariables := map[string]interface{}{
		"input": map[string]interface{}{
			"data": string(jsonData),
		},
	}

	var uploadResponse struct {
		UploadFileFromMap struct {
			ID       string `json:"id"`
			Filename string `json:"filename"`
			MimeType string `json:"mime_type"`
			UserID   string `json:"user_id"`
			File     struct {
				SizeBytes   int    `json:"size_bytes"`
				ContentHash string `json:"content_hash"`
			} `json:"file"`
		} `json:"uploadFileFromMap"`
	}

	err = suite.Server.MakeAuthenticatedRequest(ctx, token, uploadMutation, uploadVariables, &uploadResponse)
	suite.NoError(err, "File upload from map should succeed")

	// Verify the response
	suite.AssertGraphQLSuccess(uploadResponse)
	suite.Equal("test-from-map.pdf", uploadResponse.UploadFileFromMap.Filename, "Filename should match")
	suite.Equal("application/pdf", uploadResponse.UploadFileFromMap.MimeType, "MIME type should match")
	suite.Equal(loginResponse.Login.User.ID, uploadResponse.UploadFileFromMap.UserID, "User ID should match")
	suite.Equal(1024, uploadResponse.UploadFileFromMap.File.SizeBytes, "Size should match")
	suite.Equal("hash-from-map-123", uploadResponse.UploadFileFromMap.File.ContentHash, "Content hash should match")

	// Validate database state
	suite.AssertFileExistsInDB("hash-from-map-123")
	user := suite.AssertUserExistsInDB(email)
	suite.AssertUserFileCount(user.ID, 3) // Should have 2 existing + 1 new
}

// TestUploadFileFromMap_InvalidJSON tests handling of invalid JSON
func (suite *UploadFromMapIntegrationTestSuite) TestUploadFileFromMap_InvalidJSON() {
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
			"email":    email,
			"password": password,
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

	// Test with invalid JSON
	uploadMutation := `
		mutation UploadFileFromMap($input: UploadFileFromMapInput!) {
			uploadFileFromMap(input: $input) {
				id
				filename
			}
		}
	`

	uploadVariables := map[string]interface{}{
		"input": map[string]interface{}{
			"data": `{"filename": "test.pdf", "invalid": json}`,
		},
	}

	var uploadResponse map[string]interface{}

	err = suite.Server.MakeAuthenticatedRequest(ctx, token, uploadMutation, uploadVariables, &uploadResponse)
	suite.NoError(err, "Request should not fail")

	// Should contain JSON parsing error
	suite.AssertGraphQLError(uploadResponse, "parse")
}

// TestUploadFileFromMap_Unauthenticated tests authentication requirement
func (suite *UploadFromMapIntegrationTestSuite) TestUploadFileFromMap_Unauthenticated() {
	ctx := context.Background()

	// Prepare valid upload data
	uploadData := map[string]interface{}{
		"filename":     "test-unauth.pdf",
		"mime_type":    "application/pdf",
		"size_bytes":   float64(512),
		"content_hash": "hash-unauth-123",
		"encrypted_key": "key-unauth-123",
		"file_data":    []byte("test content"),
	}

	jsonData, err := json.Marshal(uploadData)
	suite.NoError(err, "JSON marshaling should succeed")

	// Test without authentication
	uploadMutation := `
		mutation UploadFileFromMap($input: UploadFileFromMapInput!) {
			uploadFileFromMap(input: $input) {
				id
			}
		}
	`

	uploadVariables := map[string]interface{}{
		"input": map[string]interface{}{
			"data": string(jsonData),
		},
	}

	var uploadResponse map[string]interface{}

	err = suite.Server.MakeRequest(ctx, uploadMutation, uploadVariables, &uploadResponse)
	suite.NoError(err, "Request should not fail")

	// Should contain authentication error
	suite.AssertGraphQLError(uploadResponse, "unauthenticated")
}