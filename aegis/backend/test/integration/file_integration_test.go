// Package integration provides comprehensive integration tests for file management features
package integration

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"strings"
	"testing"

	"github.com/stretchr/testify/suite"
)

// FileIntegrationTestSuite tests file management functionality
type FileIntegrationTestSuite struct {
	BaseIntegrationTestSuite
}

// TestFileIntegration runs the file integration test suite
func TestFileIntegration(t *testing.T) {
	suite.Run(t, &FileIntegrationTestSuite{})
}

// TestFileUploadSuccess tests successful file upload
func (suite *FileIntegrationTestSuite) TestFileUploadSuccess() {
	ctx := context.Background()

	// First, login to get authentication token
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
			"identifier":    email,
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

	// Test file upload
	filename := "test_document.txt"
	content := "This is test file content for upload"
	contentHash := generateSHA256Hash(content)
	mimeType := "text/plain"
	encryptionKey := "test_encryption_key_123"

	// Prepare upload data as JSON for uploadFileFromMap
	uploadData := map[string]interface{}{
		"filename":      filename,
		"content_hash":  contentHash,
		"size_bytes":    float64(len(content)),
		"mime_type":     mimeType,
		"encrypted_key": encryptionKey,
		"file_data":     []byte(content),
	}

	jsonData, err := json.Marshal(uploadData)
	suite.NoError(err, "JSON marshaling should succeed")

	uploadQuery := `
		mutation UploadFileFromMap($input: UploadFileFromMapInput!) {
			uploadFileFromMap(input: $input) {
				id
				filename
				mime_type
				user_id
				file_id
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
			FileID   string `json:"file_id"`
		} `json:"uploadFileFromMap"`
	}

	err = suite.Server.MakeAuthenticatedRequest(ctx, token, uploadQuery, uploadVariables, &uploadResponse)
	suite.NoError(err, "File upload should succeed")

	// Validate response
	suite.AssertGraphQLSuccess(uploadResponse)
	suite.Equal(filename, uploadResponse.UploadFileFromMap.Filename, "Filename should match")
	suite.Equal(mimeType, uploadResponse.UploadFileFromMap.MimeType, "MIME type should match")
	suite.Equal(loginResponse.Login.User.ID, uploadResponse.UploadFileFromMap.UserID, "User ID should match")

	// Validate database state
	suite.AssertFileExistsInDB(contentHash)
	user := suite.AssertUserExistsInDB(email)
	suite.AssertUserFileCount(user.ID, 3) // Should have 2 existing + 1 new
}

// TestFileDownload tests file download functionality
func (suite *FileIntegrationTestSuite) TestFileDownload() {
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
			"identifier":    email,
			"password": password,
		},
	}

	type LoginResponse struct {
		Data struct {
			Login struct {
				Token string `json:"token"`
				User  struct {
					ID    string `json:"id"`
					Email string `json:"email"`
				} `json:"user"`
			} `json:"login"`
		} `json:"data"`
	}

	var loginResponse LoginResponse

	err := suite.Server.MakeRequest(ctx, loginQuery, variables, &loginResponse)
	suite.NoError(err, "Login should succeed")
	token := loginResponse.Data.Login.Token

	// Test file download
	userFileID := fmt.Sprintf("%d", suite.TestData.UserFile1.ID)

	downloadQuery := `
		mutation DownloadFile($id: ID!) {
			downloadFile(id: $id)
		}
	`

	downloadVariables := map[string]interface{}{
		"id": userFileID,
	}

	var downloadResponse struct {
		DownloadFile string `json:"downloadFile"`
	}

	err = suite.Server.MakeAuthenticatedRequest(ctx, token, downloadQuery, downloadVariables, &downloadResponse)
	suite.NoError(err, "File download should succeed")

	// Validate response contains download URL
	suite.AssertGraphQLSuccess(downloadResponse)
	suite.NotEmpty(downloadResponse.DownloadFile, "Download URL should be returned")
	suite.True(strings.Contains(downloadResponse.DownloadFile, "download") ||
		strings.Contains(downloadResponse.DownloadFile, "presigned") ||
		strings.Contains(downloadResponse.DownloadFile, "url"),
		"Response should contain download URL")
}

// TestFileDeletion tests file deletion functionality
func (suite *FileIntegrationTestSuite) TestFileDeletion() {
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
			"identifier":    email,
			"password": password,
		},
	}

	type LoginResponse struct {
		Data struct {
			Login struct {
				Token string `json:"token"`
				User  struct {
					ID    string `json:"id"`
					Email string `json:"email"`
				} `json:"user"`
			} `json:"login"`
		} `json:"data"`
	}

	var loginResponse LoginResponse

	err := suite.Server.MakeRequest(ctx, loginQuery, variables, &loginResponse)
	suite.NoError(err, "Login should succeed")
	token := loginResponse.Data.Login.Token
	fmt.Printf("DEBUG: After login, token: '%s'\n", token)

	// Get initial file count
	user := suite.AssertUserExistsInDB(email)
	initialCount := 2 // From test data setup
	suite.AssertUserFileCount(user.ID, initialCount)

	// Delete a file
	userFileID := fmt.Sprintf("%d", suite.TestData.UserFile1.ID)

	deleteQuery := `
		mutation DeleteFile($id: ID!) {
			deleteFile(id: $id)
		}
	`

	deleteVariables := map[string]interface{}{
		"id": userFileID,
	}

	var deleteResponse struct {
		Data struct {
			DeleteFile bool `json:"deleteFile"`
		} `json:"data"`
	}

	err = suite.Server.MakeAuthenticatedRequest(ctx, token, deleteQuery, deleteVariables, &deleteResponse)
	suite.NoError(err, "File deletion should succeed")

	// Validate response
	suite.AssertGraphQLSuccess(deleteResponse)
	suite.True(deleteResponse.Data.DeleteFile, "Delete operation should return true")

	// Validate database state - file count should decrease
	suite.AssertUserFileCount(user.ID, initialCount-1)
}

// TestFileDeletionUnauthorized tests deletion of files by unauthorized users
func (suite *FileIntegrationTestSuite) TestFileDeletionUnauthorized() {
	ctx := context.Background()

	// Login as another user (not the owner)
	email := suite.TestData.AnotherUser.Email
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
			"identifier":    email,
			"password": password,
		},
	}

	type LoginResponse struct {
		Data struct {
			Login struct {
				Token string `json:"token"`
				User  struct {
					ID    string `json:"id"`
					Email string `json:"email"`
				} `json:"user"`
			} `json:"login"`
		} `json:"data"`
	}

	var loginResponse LoginResponse

	fmt.Printf("DEBUG: Before MakeRequest\n")
	err := suite.Server.MakeRequest(ctx, loginQuery, variables, &loginResponse)
	fmt.Printf("DEBUG: After MakeRequest, err: %v\n", err)
	suite.NoError(err, "Login should succeed")
	fmt.Printf("DEBUG: loginResponse.Data.Login.Token: '%s'\n", loginResponse.Data.Login.Token)
	fmt.Printf("DEBUG: About to extract token\n")
	token := loginResponse.Data.Login.Token
	fmt.Printf("DEBUG: Extracted token: '%s' (length: %d)\n", token, len(token))

	// Try to delete another user's file
	userFileID := fmt.Sprintf("%d", suite.TestData.UserFile1.ID) // This belongs to RegularUser

	deleteQuery := `
		mutation DeleteFile($id: ID!) {
			deleteFile(id: $id)
		}
	`

	deleteVariables := map[string]interface{}{
		"id": userFileID,
	}

	var deleteResponse map[string]interface{}

	err = suite.Server.MakeAuthenticatedRequest(ctx, token, deleteQuery, deleteVariables, &deleteResponse)
	suite.NoError(err, "Request should not fail")

	// Should contain authorization error
	suite.AssertGraphQLError(deleteResponse, "unauthorized")
}

// TestStorageQuotaEnforcement tests storage quota enforcement
func (suite *FileIntegrationTestSuite) TestStorageQuotaEnforcement() {
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
			"identifier":    email,
			"password": password,
		},
	}

	type LoginResponse struct {
		Data struct {
			Login struct {
				Token string `json:"token"`
				User  struct {
					ID    string `json:"id"`
					Email string `json:"email"`
				} `json:"user"`
			} `json:"login"`
		} `json:"data"`
	}

	var loginResponse LoginResponse

	err := suite.Server.MakeRequest(ctx, loginQuery, variables, &loginResponse)
	suite.NoError(err, "Login should succeed")
	token := loginResponse.Data.Login.Token

	// Try to upload a file that would exceed quota
	// User has 100MB quota, let's try to upload a 200MB file
	largeContent := strings.Repeat("x", 200*1024*1024) // 200MB
	contentHash := generateSHA256Hash(largeContent)

	// Prepare upload data as JSON for uploadFileFromMap
	uploadData := map[string]interface{}{
		"filename":      "large_file.txt",
		"content_hash":  contentHash,
		"size_bytes":    float64(len(largeContent)),
		"mime_type":     "text/plain",
		"encrypted_key": "test_key",
		"file_data":     []byte(largeContent),
	}

	jsonData, err := json.Marshal(uploadData)
	suite.NoError(err, "JSON marshaling should succeed")

	uploadQuery := `
		mutation UploadFileFromMap($input: UploadFileFromMapInput!) {
			uploadFileFromMap(input: $input) {
				id
				filename
			}
		}
	`

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

// TestFileFilteringAndSearch tests file filtering and search functionality
func (suite *FileIntegrationTestSuite) TestFileFilteringAndSearch() {
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
			"identifier":    email,
			"password": password,
		},
	}

	type LoginResponse struct {
		Data struct {
			Login struct {
				Token string `json:"token"`
				User  struct {
					ID    string `json:"id"`
					Email string `json:"email"`
				} `json:"user"`
			} `json:"login"`
		} `json:"data"`
	}

	var loginResponse LoginResponse

	err := suite.Server.MakeRequest(ctx, loginQuery, variables, &loginResponse)
	suite.NoError(err, "Login should succeed")
	token := loginResponse.Data.Login.Token

	// Test file listing with filters
	filesQuery := `
		query MyFiles($filter: FileFilterInput) {
			myFiles(filter: $filter) {
				id
				filename
				mime_type
			}
		}
	`

	// Test filename filter
	filenameFilter := map[string]interface{}{
		"filter": map[string]interface{}{
			"filename": "testfile",
		},
	}

	var filenameResponse struct {
		MyFiles []struct {
			ID       string `json:"id"`
			Filename string `json:"filename"`
			MimeType string `json:"mime_type"`
		} `json:"myFiles"`
	}

	err = suite.Server.MakeAuthenticatedRequest(ctx, token, filesQuery, filenameFilter, &filenameResponse)
	suite.NoError(err, "File filtering should succeed")

	// Should find files with "testfile" in name
	suite.AssertGraphQLSuccess(filenameResponse)
	for _, file := range filenameResponse.MyFiles {
		suite.True(strings.Contains(strings.ToLower(file.Filename), "testfile"),
			"Filename should contain 'testfile'")
	}

	// Test MIME type filter
	mimeFilter := map[string]interface{}{
		"filter": map[string]interface{}{
			"mime_type": "application/pdf",
		},
	}

	var mimeResponse struct {
		MyFiles []struct {
			ID       string `json:"id"`
			Filename string `json:"filename"`
			MimeType string `json:"mime_type"`
		} `json:"myFiles"`
	}

	err = suite.Server.MakeAuthenticatedRequest(ctx, token, filesQuery, mimeFilter, &mimeResponse)
	suite.NoError(err, "MIME type filtering should succeed")

	// Should find only PDF files
	suite.AssertGraphQLSuccess(mimeResponse)
	for _, file := range mimeResponse.MyFiles {
		suite.Equal("application/pdf", file.MimeType, "MIME type should be PDF")
	}
}

// TestFileUploadValidation tests file upload validation
func (suite *FileIntegrationTestSuite) TestFileUploadValidation() {
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
			"identifier":    email,
			"password": password,
		},
	}

	type LoginResponse struct {
		Data struct {
			Login struct {
				Token string `json:"token"`
				User  struct {
					ID    string `json:"id"`
					Email string `json:"email"`
				} `json:"user"`
			} `json:"login"`
		} `json:"data"`
	}

	var loginResponse LoginResponse

	err := suite.Server.MakeRequest(ctx, loginQuery, variables, &loginResponse)
	suite.NoError(err, "Login should succeed")
	token := loginResponse.Data.Login.Token

	testCases := []struct {
		name        string
		filename    string
		contentHash string
		sizeBytes   int
		mimeType    string
		errorMsg    string
	}{
		{
			name:        "Empty filename",
			filename:    "",
			contentHash: "hash123",
			sizeBytes:   100,
			mimeType:    "text/plain",
			errorMsg:    "filename",
		},
		{
			name:        "Empty content hash",
			filename:    "test.txt",
			contentHash: "",
			sizeBytes:   100,
			mimeType:    "text/plain",
			errorMsg:    "hash",
		},
		{
			name:        "Invalid size",
			filename:    "test.txt",
			contentHash: "hash123",
			sizeBytes:   -1,
			mimeType:    "text/plain",
			errorMsg:    "size",
		},
		{
			name:        "Empty MIME type",
			filename:    "test.txt",
			contentHash: "hash123",
			sizeBytes:   100,
			mimeType:    "",
			errorMsg:    "mime",
		},
	}

	for _, tc := range testCases {
		suite.Run(tc.name, func() {
			// Prepare upload data as JSON for uploadFileFromMap
			uploadData := map[string]interface{}{
				"filename":      tc.filename,
				"content_hash":  tc.contentHash,
				"size_bytes":    float64(tc.sizeBytes),
				"mime_type":     tc.mimeType,
				"encrypted_key": "test_key",
				"file_data":     []byte("test content"),
			}

			jsonData, err := json.Marshal(uploadData)
			suite.NoError(err, "JSON marshaling should succeed")

			uploadQuery := `
				mutation UploadFileFromMap($input: UploadFileFromMapInput!) {
					uploadFileFromMap(input: $input) {
						id
						filename
					}
				}
			`

			uploadVariables := map[string]interface{}{
				"input": map[string]interface{}{
					"data": string(jsonData),
				},
			}

			var uploadResponse map[string]interface{}

			err = suite.Server.MakeAuthenticatedRequest(ctx, token, uploadQuery, uploadVariables, &uploadResponse)
			suite.NoError(err, "Request should not fail")

			// Should contain validation error
			suite.AssertGraphQLError(uploadResponse, tc.errorMsg)
		})
	}
}

// TestConcurrentFileOperations tests concurrent file operations
func (suite *FileIntegrationTestSuite) TestConcurrentFileOperations() {
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
			"identifier":    email,
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

	// Simulate concurrent uploads (sequential for testing)
	files := []string{"concurrent1.txt", "concurrent2.txt", "concurrent3.txt"}

	for _, filename := range files {
		content := fmt.Sprintf("Content for %s", filename)
		contentHash := generateSHA256Hash(content)

		// Prepare upload data as JSON for uploadFileFromMap
		uploadData := map[string]interface{}{
			"filename":      filename,
			"content_hash":  contentHash,
			"size_bytes":    float64(len(content)),
			"mime_type":     "text/plain",
			"encrypted_key": fmt.Sprintf("key_%s", filename),
			"file_data":     []byte(content),
		}

		jsonData, err := json.Marshal(uploadData)
		suite.NoError(err, "JSON marshaling should succeed")

		uploadQuery := `
			mutation UploadFileFromMap($input: UploadFileFromMapInput!) {
				uploadFileFromMap(input: $input) {
					id
					filename
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
			} `json:"uploadFileFromMap"`
		}

		err = suite.Server.MakeAuthenticatedRequest(ctx, token, uploadQuery, uploadVariables, &uploadResponse)
		suite.NoError(err, "Concurrent file upload should succeed")
		suite.AssertGraphQLSuccess(uploadResponse)
		suite.Equal(filename, uploadResponse.UploadFileFromMap.Filename, "Filename should match")
	}

	// Verify all files were created
	user := suite.AssertUserExistsInDB(email)
	suite.AssertUserFileCount(user.ID, 2+len(files)) // 2 original + 3 new
}

// TestTrashOperationsGraphQL tests GraphQL trash operations
func (suite *FileIntegrationTestSuite) TestTrashOperationsGraphQL() {
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
			"identifier":    email,
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

	// Delete file (move to trash)
	userFileID := fmt.Sprintf("%d", suite.TestData.UserFile1.ID)

	deleteQuery := `
		mutation DeleteFile($id: ID!) {
			deleteFile(id: $id)
		}
	`

	deleteVariables := map[string]interface{}{
		"id": userFileID,
	}

	var deleteResponse struct {
		DeleteFile bool `json:"deleteFile"`
	}

	err = suite.Server.MakeAuthenticatedRequest(ctx, token, deleteQuery, deleteVariables, &deleteResponse)
	suite.NoError(err, "File deletion should succeed")
	suite.AssertGraphQLSuccess(deleteResponse)
	suite.True(deleteResponse.DeleteFile, "Delete operation should return true")

	// Verify file is in trash
	myTrashedFilesQuery := `
		query MyTrashedFiles {
			myTrashedFiles {
				id
				filename
				mime_type
			}
		}
	`

	var trashedFilesResponse struct {
		MyTrashedFiles []struct {
			ID       string `json:"id"`
			Filename string `json:"filename"`
			MimeType string `json:"mime_type"`
		} `json:"myTrashedFiles"`
	}

	err = suite.Server.MakeAuthenticatedRequest(ctx, token, myTrashedFilesQuery, nil, &trashedFilesResponse)
	suite.NoError(err, "Getting trashed files should succeed")
	suite.AssertGraphQLSuccess(trashedFilesResponse)
	suite.Len(trashedFilesResponse.MyTrashedFiles, 1, "Should have one trashed file")
	suite.Equal(suite.TestData.UserFile1.Filename, trashedFilesResponse.MyTrashedFiles[0].Filename, "Filename should match")

	// Verify file is not in regular files list
	myFilesQuery := `
		query MyFiles {
			myFiles {
				id
				filename
			}
		}
	`

	var myFilesResponse struct {
		MyFiles []struct {
			ID       string `json:"id"`
			Filename string `json:"filename"`
		} `json:"myFiles"`
	}

	err = suite.Server.MakeAuthenticatedRequest(ctx, token, myFilesQuery, nil, &myFilesResponse)
	suite.NoError(err, "Getting user files should succeed")
	suite.AssertGraphQLSuccess(myFilesResponse)
	// Should have 1 less file (originally 2, now 1 after deletion)
	suite.Len(myFilesResponse.MyFiles, 1, "Should have one file remaining")
}

// TestRestoreFileGraphQL tests restoring files from trash via GraphQL
func (suite *FileIntegrationTestSuite) TestRestoreFileGraphQL() {
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
			"identifier":    email,
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

	// First delete file (move to trash)
	userFileID := fmt.Sprintf("%d", suite.TestData.UserFile1.ID)

	deleteQuery := `
		mutation DeleteFile($id: ID!) {
			deleteFile(id: $id)
		}
	`

	deleteVariables := map[string]interface{}{
		"id": userFileID,
	}

	var deleteResponse struct {
		DeleteFile bool `json:"deleteFile"`
	}

	err = suite.Server.MakeAuthenticatedRequest(ctx, token, deleteQuery, deleteVariables, &deleteResponse)
	suite.NoError(err, "File deletion should succeed")

	// Restore file from trash
	restoreQuery := `
		mutation RestoreFile($fileID: ID!) {
			restoreFile(fileID: $fileID)
		}
	`

	restoreVariables := map[string]interface{}{
		"fileID": userFileID,
	}

	var restoreResponse struct {
		RestoreFile bool `json:"restoreFile"`
	}

	err = suite.Server.MakeAuthenticatedRequest(ctx, token, restoreQuery, restoreVariables, &restoreResponse)
	suite.NoError(err, "File restoration should succeed")
	suite.AssertGraphQLSuccess(restoreResponse)
	suite.True(restoreResponse.RestoreFile, "Restore operation should return true")

	// Verify file is back in regular files list
	myFilesQuery := `
		query MyFiles {
			myFiles {
				id
				filename
			}
		}
	`

	var myFilesResponse struct {
		MyFiles []struct {
			ID       string `json:"id"`
			Filename string `json:"filename"`
		} `json:"myFiles"`
	}

	err = suite.Server.MakeAuthenticatedRequest(ctx, token, myFilesQuery, nil, &myFilesResponse)
	suite.NoError(err, "Getting user files should succeed")
	suite.AssertGraphQLSuccess(myFilesResponse)
	suite.Len(myFilesResponse.MyFiles, 2, "Should have both files back")

	// Verify file is no longer in trash
	myTrashedFilesQuery := `
		query MyTrashedFiles {
			myTrashedFiles {
				id
				filename
			}
		}
	`

	var trashedFilesResponse struct {
		MyTrashedFiles []struct {
			ID       string `json:"id"`
			Filename string `json:"filename"`
		} `json:"myTrashedFiles"`
	}

	err = suite.Server.MakeAuthenticatedRequest(ctx, token, myTrashedFilesQuery, nil, &trashedFilesResponse)
	suite.NoError(err, "Getting trashed files should succeed")
	suite.AssertGraphQLSuccess(trashedFilesResponse)
	suite.Len(trashedFilesResponse.MyTrashedFiles, 0, "Should have no trashed files")
}

// TestPermanentlyDeleteFileGraphQL tests permanently deleting files from trash via GraphQL
func (suite *FileIntegrationTestSuite) TestPermanentlyDeleteFileGraphQL() {
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
			"identifier":    email,
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

	// First delete file (move to trash)
	userFileID := fmt.Sprintf("%d", suite.TestData.UserFile1.ID)

	deleteQuery := `
		mutation DeleteFile($id: ID!) {
			deleteFile(id: $id)
		}
	`

	deleteVariables := map[string]interface{}{
		"id": userFileID,
	}

	var deleteResponse struct {
		DeleteFile bool `json:"deleteFile"`
	}

	err = suite.Server.MakeAuthenticatedRequest(ctx, token, deleteQuery, deleteVariables, &deleteResponse)
	suite.NoError(err, "File deletion should succeed")

	// Permanently delete file from trash
	permanentDeleteQuery := `
		mutation PermanentlyDeleteFile($fileID: ID!) {
			permanentlyDeleteFile(fileID: $fileID)
		}
	`

	permanentDeleteVariables := map[string]interface{}{
		"fileID": userFileID,
	}

	var permanentDeleteResponse struct {
		PermanentlyDeleteFile bool `json:"permanentlyDeleteFile"`
	}

	err = suite.Server.MakeAuthenticatedRequest(ctx, token, permanentDeleteQuery, permanentDeleteVariables, &permanentDeleteResponse)
	suite.NoError(err, "Permanent file deletion should succeed")
	suite.AssertGraphQLSuccess(permanentDeleteResponse)
	suite.True(permanentDeleteResponse.PermanentlyDeleteFile, "Permanent delete operation should return true")

	// Verify file is completely gone from both regular files and trash
	myFilesQuery := `
		query MyFiles {
			myFiles {
				id
				filename
			}
		}
	`

	var myFilesResponse struct {
		MyFiles []struct {
			ID       string `json:"id"`
			Filename string `json:"filename"`
		} `json:"myFiles"`
	}

	err = suite.Server.MakeAuthenticatedRequest(ctx, token, myFilesQuery, nil, &myFilesResponse)
	suite.NoError(err, "Getting user files should succeed")
	suite.AssertGraphQLSuccess(myFilesResponse)
	suite.Len(myFilesResponse.MyFiles, 1, "Should have one file remaining")

	// Verify file is not in trash
	myTrashedFilesQuery := `
		query MyTrashedFiles {
			myTrashedFiles {
				id
				filename
			}
		}
	`

	var trashedFilesResponse struct {
		MyTrashedFiles []struct {
			ID       string `json:"id"`
			Filename string `json:"filename"`
		} `json:"myTrashedFiles"`
	}

	err = suite.Server.MakeAuthenticatedRequest(ctx, token, myTrashedFilesQuery, nil, &trashedFilesResponse)
	suite.NoError(err, "Getting trashed files should succeed")
	suite.AssertGraphQLSuccess(trashedFilesResponse)
	suite.Len(trashedFilesResponse.MyTrashedFiles, 0, "Should have no trashed files")
}

// TestMyTrashedFilesGraphQL tests the myTrashedFiles query
func (suite *FileIntegrationTestSuite) TestMyTrashedFilesGraphQL() {
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
			"identifier":    email,
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

	// Delete one file (move to trash)
	userFileID := fmt.Sprintf("%d", suite.TestData.UserFile1.ID)

	deleteQuery := `
		mutation DeleteFile($id: ID!) {
			deleteFile(id: $id)
		}
	`

	deleteVariables := map[string]interface{}{
		"id": userFileID,
	}

	var deleteResponse struct {
		DeleteFile bool `json:"deleteFile"`
	}

	err = suite.Server.MakeAuthenticatedRequest(ctx, token, deleteQuery, deleteVariables, &deleteResponse)
	suite.NoError(err, "File deletion should succeed")

	// Test myTrashedFiles query
	myTrashedFilesQuery := `
		query MyTrashedFiles {
			myTrashedFiles {
				id
				filename
				mime_type
				file {
					size_bytes
				}
			}
		}
	`

	var trashedFilesResponse struct {
		MyTrashedFiles []struct {
			ID       string `json:"id"`
			Filename string `json:"filename"`
			MimeType string `json:"mime_type"`
			File     struct {
				SizeBytes int64 `json:"size_bytes"`
			} `json:"file"`
		} `json:"myTrashedFiles"`
	}

	err = suite.Server.MakeAuthenticatedRequest(ctx, token, myTrashedFilesQuery, nil, &trashedFilesResponse)
	suite.NoError(err, "Getting trashed files should succeed")
	suite.AssertGraphQLSuccess(trashedFilesResponse)
	suite.Len(trashedFilesResponse.MyTrashedFiles, 1, "Should have one trashed file")

	// Verify the trashed file details
	trashedFile := trashedFilesResponse.MyTrashedFiles[0]
	suite.Equal(suite.TestData.UserFile1.Filename, trashedFile.Filename, "Filename should match")
	suite.Equal(suite.TestData.UserFile1.MimeType, trashedFile.MimeType, "MIME type should match")
	suite.Equal(suite.TestData.File1.SizeBytes, trashedFile.File.SizeBytes, "File size should match")
}

// TestTrashOperationsUnauthorized tests unauthorized access to trash operations
func (suite *FileIntegrationTestSuite) TestTrashOperationsUnauthorized() {
	ctx := context.Background()

	// Login as another user (not the owner)
	email := suite.TestData.AnotherUser.Email
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
			"identifier":    email,
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

	// Try to delete another user's file
	userFileID := fmt.Sprintf("%d", suite.TestData.UserFile1.ID) // This belongs to RegularUser

	deleteQuery := `
		mutation DeleteFile($id: ID!) {
			deleteFile(id: $id)
		}
	`

	deleteVariables := map[string]interface{}{
		"id": userFileID,
	}

	var deleteResponse map[string]interface{}

	err = suite.Server.MakeAuthenticatedRequest(ctx, token, deleteQuery, deleteVariables, &deleteResponse)
	suite.NoError(err, "Request should not fail")

	// Should contain authorization error
	suite.AssertGraphQLError(deleteResponse, "unauthorized")

	// Try to restore another user's file
	restoreQuery := `
		mutation RestoreFile($fileID: ID!) {
			restoreFile(fileID: $fileID)
		}
	`

	restoreVariables := map[string]interface{}{
		"fileID": userFileID,
	}

	var restoreResponse map[string]interface{}

	err = suite.Server.MakeAuthenticatedRequest(ctx, token, restoreQuery, restoreVariables, &restoreResponse)
	suite.NoError(err, "Request should not fail")

	// Should contain authorization error
	suite.AssertGraphQLError(restoreResponse, "unauthorized")

	// Try to permanently delete another user's file
	permanentDeleteQuery := `
		mutation PermanentlyDeleteFile($fileID: ID!) {
			permanentlyDeleteFile(fileID: $fileID)
		}
	`

	permanentDeleteVariables := map[string]interface{}{
		"fileID": userFileID,
	}

	var permanentDeleteResponse map[string]interface{}

	err = suite.Server.MakeAuthenticatedRequest(ctx, token, permanentDeleteQuery, permanentDeleteVariables, &permanentDeleteResponse)
	suite.NoError(err, "Request should not fail")

	// Should contain authorization error
	suite.AssertGraphQLError(permanentDeleteResponse, "unauthorized")
}

// TestPasswordBasedFileSharing tests the complete password-based file sharing workflow
func (suite *FileIntegrationTestSuite) TestPasswordBasedFileSharing() {
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
			"identifier":    email,
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

	// Create a file share
	userFileID := fmt.Sprintf("%d", suite.TestData.UserFile1.ID)
	masterPassword := "MySecurePassword123!"

	createShareQuery := `
		mutation CreateFileShare($input: CreateFileShareInput!) {
			createFileShare(input: $input) {
				id
				share_token
				max_downloads
				expires_at
				user_file {
					filename
				}
			}
		}
	`

	createShareVariables := map[string]interface{}{
		"input": map[string]interface{}{
			"user_file_id":    userFileID,
			"master_password": masterPassword,
			"max_downloads":   5,
		},
	}

	var createShareResponse struct {
		CreateFileShare struct {
			ID         string `json:"id"`
			ShareToken string `json:"share_token"`
			MaxDownloads int  `json:"max_downloads"`
			ExpiresAt   *string `json:"expires_at"`
			UserFile    struct {
				Filename string `json:"filename"`
			} `json:"user_file"`
		} `json:"createFileShare"`
	}

	err = suite.Server.MakeAuthenticatedRequest(ctx, token, createShareQuery, createShareVariables, &createShareResponse)
	suite.NoError(err, "File share creation should succeed")
	suite.AssertGraphQLSuccess(createShareResponse)
	suite.NotEmpty(createShareResponse.CreateFileShare.ShareToken, "Share token should be generated")
	suite.Equal(5, createShareResponse.CreateFileShare.MaxDownloads, "Max downloads should match")
	suite.Equal(suite.TestData.UserFile1.Filename, createShareResponse.CreateFileShare.UserFile.Filename, "Filename should match")

	shareToken := createShareResponse.CreateFileShare.ShareToken

	// Test accessing the shared file with correct password
	accessSharedFileQuery := `
		mutation AccessSharedFile($input: AccessSharedFileInput!) {
			accessSharedFile(input: $input)
		}
	`

	accessVariables := map[string]interface{}{
		"input": map[string]interface{}{
			"token":          shareToken,
			"master_password": masterPassword,
		},
	}

	var accessResponse struct {
		AccessSharedFile string `json:"accessSharedFile"`
	}

	err = suite.Server.MakeRequest(ctx, accessSharedFileQuery, accessVariables, &accessResponse)
	suite.NoError(err, "Access shared file should succeed")
	suite.AssertGraphQLSuccess(accessResponse)
	suite.NotEmpty(accessResponse.AccessSharedFile, "Download URL should be returned")
	suite.True(strings.Contains(accessResponse.AccessSharedFile, "download"), "Response should contain download URL")

	// Test accessing with wrong password
	wrongPasswordVariables := map[string]interface{}{
		"input": map[string]interface{}{
			"token":          shareToken,
			"master_password": "WrongPassword123!",
		},
	}

	var wrongPasswordResponse map[string]interface{}

	err = suite.Server.MakeRequest(ctx, accessSharedFileQuery, wrongPasswordVariables, &wrongPasswordResponse)
	suite.NoError(err, "Request should not fail")
	suite.AssertGraphQLError(wrongPasswordResponse, "validation")

	// Test rate limiting by making multiple rapid requests
	rateLimited := false
	for i := 0; i < 15; i++ { // More than the rate limit allows
		var tempResponse map[string]interface{}
		err = suite.Server.MakeRequest(ctx, accessSharedFileQuery, accessVariables, &tempResponse)
		suite.NoError(err, "Request should not fail")

		if i >= 10 { // After 10 requests, should be rate limited
			// Check if this request was rate limited
			if strings.Contains(fmt.Sprintf("%v", tempResponse), "rate limit") {
				rateLimited = true
				break // Found rate limit error, test passed
			}
		}
	}
	suite.True(rateLimited, "Rate limiting should have been triggered")
}

// TestPasswordComplexityValidation tests password complexity requirements for file sharing
func (suite *FileIntegrationTestSuite) TestPasswordComplexityValidation() {
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
			"identifier":    email,
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

	userFileID := fmt.Sprintf("%d", suite.TestData.UserFile1.ID)

	testCases := []struct {
		name     string
		password string
		errorMsg string
	}{
		{
			name:     "Password too short",
			password: "Short1!",
			errorMsg: "security requirements",
		},
		{
			name:     "Password without uppercase",
			password: "nouppercase123!",
			errorMsg: "security requirements",
		},
		{
			name:     "Password without lowercase",
			password: "NOLOWERCASE123!",
			errorMsg: "security requirements",
		},
		{
			name:     "Password without digit",
			password: "NoDigitPassword!",
			errorMsg: "security requirements",
		},
		{
			name:     "Password without special character",
			password: "NoSpecialChar123",
			errorMsg: "security requirements",
		},
		{
			name:     "Valid password",
			password: "ValidPassword123!",
			errorMsg: "",
		},
	}

	for _, tc := range testCases {
		suite.Run(tc.name, func() {
			createShareQuery := `
				mutation CreateFileShare($input: CreateFileShareInput!) {
					createFileShare(input: $input) {
						id
						share_token
					}
				}
			`

			createShareVariables := map[string]interface{}{
				"input": map[string]interface{}{
					"user_file_id":    userFileID,
					"master_password": tc.password,
				},
			}

			var createShareResponse map[string]interface{}

			err = suite.Server.MakeAuthenticatedRequest(ctx, token, createShareQuery, createShareVariables, &createShareResponse)
			suite.NoError(err, "Request should not fail")

			if tc.errorMsg == "" {
				// Should succeed
				suite.AssertGraphQLSuccess(createShareResponse)
			} else {
				// Should contain validation error
				suite.AssertGraphQLError(createShareResponse, tc.errorMsg)
			}
		})
	}
}

// TestShareAccessAuditLogging tests that share access attempts are properly logged
func (suite *FileIntegrationTestSuite) TestShareAccessAuditLogging() {
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
			"identifier":    email,
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

	// Create a file share
	userFileID := fmt.Sprintf("%d", suite.TestData.UserFile1.ID)
	masterPassword := "MySecurePassword123!"

	createShareQuery := `
		mutation CreateFileShare($input: CreateFileShareInput!) {
			createFileShare(input: $input) {
				id
				share_token
			}
		}
	`

	createShareVariables := map[string]interface{}{
		"input": map[string]interface{}{
			"user_file_id":    userFileID,
			"master_password": masterPassword,
		},
	}

	var createShareResponse struct {
		CreateFileShare struct {
			ID         string `json:"id"`
			ShareToken string `json:"share_token"`
		} `json:"createFileShare"`
	}

	err = suite.Server.MakeAuthenticatedRequest(ctx, token, createShareQuery, createShareVariables, &createShareResponse)
	suite.NoError(err, "File share creation should succeed")
	shareToken := createShareResponse.CreateFileShare.ShareToken

	// Make several access attempts
	accessSharedFileQuery := `
		mutation AccessSharedFile($input: AccessSharedFileInput!) {
			accessSharedFile(input: $input)
		}
	`

	// Successful access
	accessVariables := map[string]interface{}{
		"input": map[string]interface{}{
			"token":          shareToken,
			"master_password": masterPassword,
		},
	}

	var accessResponse struct {
		AccessSharedFile string `json:"accessSharedFile"`
	}

	err = suite.Server.MakeRequest(ctx, accessSharedFileQuery, accessVariables, &accessResponse)
	suite.NoError(err, "Access shared file should succeed")

	// Failed access attempt
	wrongPasswordVariables := map[string]interface{}{
		"input": map[string]interface{}{
			"token":          shareToken,
			"master_password": "WrongPassword123!",
		},
	}

	var wrongPasswordResponse map[string]interface{}

	err = suite.Server.MakeRequest(ctx, accessSharedFileQuery, wrongPasswordVariables, &wrongPasswordResponse)
	suite.NoError(err, "Request should not fail")

	// Verify that access logs were created (this would require database inspection in a real test)
	// For now, we just verify the operations completed without error
	suite.AssertGraphQLSuccess(accessResponse)
	suite.AssertGraphQLError(wrongPasswordResponse, "validation")
}

// TestEndToEndShareCreationAndAccessFlow tests the complete end-to-end flow of file sharing
func (suite *FileIntegrationTestSuite) TestEndToEndShareCreationAndAccessFlow() {
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
			"identifier":    email,
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

	// Step 1: Upload a new file for sharing
	filename := "shared_document.txt"
	content := "This is a test document for sharing"
	contentHash := generateSHA256Hash(content)
	mimeType := "text/plain"
	encryptionKey := "test_encryption_key_123"

	uploadData := map[string]interface{}{
		"filename":      filename,
		"content_hash":  contentHash,
		"size_bytes":    float64(len(content)),
		"mime_type":     mimeType,
		"encrypted_key": encryptionKey,
		"file_data":     []byte(content),
	}

	jsonData, err := json.Marshal(uploadData)
	suite.NoError(err, "JSON marshaling should succeed")

	uploadQuery := `
		mutation UploadFileFromMap($input: UploadFileFromMapInput!) {
			uploadFileFromMap(input: $input) {
				id
				filename
				user_id
				file_id
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
			ID      string `json:"id"`
			Filename string `json:"filename"`
			UserID   string `json:"user_id"`
			FileID   string `json:"file_id"`
		} `json:"uploadFileFromMap"`
	}

	err = suite.Server.MakeAuthenticatedRequest(ctx, token, uploadQuery, uploadVariables, &uploadResponse)
	suite.NoError(err, "File upload should succeed")
	suite.AssertGraphQLSuccess(uploadResponse)
	userFileID := uploadResponse.UploadFileFromMap.ID

	// Step 2: Create a password-protected file share with limited downloads
	masterPassword := "SecureSharePass123!"
	maxDownloads := 3

	createShareQuery := `
		mutation CreateFileShare($input: CreateFileShareInput!) {
			createFileShare(input: $input) {
				id
				share_token
				max_downloads
				download_count
				expires_at
			}
		}
	`

	createShareVariables := map[string]interface{}{
		"input": map[string]interface{}{
			"user_file_id":    userFileID,
			"master_password": masterPassword,
			"max_downloads":   maxDownloads,
		},
	}

	var createShareResponse struct {
		CreateFileShare struct {
			ID             string  `json:"id"`
			ShareToken     string  `json:"share_token"`
			MaxDownloads   int     `json:"max_downloads"`
			DownloadCount  int     `json:"download_count"`
			ExpiresAt      *string `json:"expires_at"`
		} `json:"createFileShare"`
	}

	err = suite.Server.MakeAuthenticatedRequest(ctx, token, createShareQuery, createShareVariables, &createShareResponse)
	suite.NoError(err, "File share creation should succeed")
	suite.AssertGraphQLSuccess(createShareResponse)
	suite.Equal(maxDownloads, createShareResponse.CreateFileShare.MaxDownloads, "Max downloads should match")
	suite.Equal(0, createShareResponse.CreateFileShare.DownloadCount, "Initial download count should be 0")

	shareToken := createShareResponse.CreateFileShare.ShareToken

	// Step 3: Test successful access and download
	accessSharedFileQuery := `
		mutation AccessSharedFile($input: AccessSharedFileInput!) {
			accessSharedFile(input: $input)
		}
	`

	accessVariables := map[string]interface{}{
		"input": map[string]interface{}{
			"token":          shareToken,
			"master_password": masterPassword,
		},
	}

	// First download
	var accessResponse1 struct {
		AccessSharedFile string `json:"accessSharedFile"`
	}
	err = suite.Server.MakeRequest(ctx, accessSharedFileQuery, accessVariables, &accessResponse1)
	suite.NoError(err, "First access should succeed")
	suite.AssertGraphQLSuccess(accessResponse1)
	suite.NotEmpty(accessResponse1.AccessSharedFile, "Download URL should be returned")

	// Second download
	var accessResponse2 struct {
		AccessSharedFile string `json:"accessSharedFile"`
	}
	err = suite.Server.MakeRequest(ctx, accessSharedFileQuery, accessVariables, &accessResponse2)
	suite.NoError(err, "Second access should succeed")
	suite.AssertGraphQLSuccess(accessResponse2)

	// Third download
	var accessResponse3 struct {
		AccessSharedFile string `json:"accessSharedFile"`
	}
	err = suite.Server.MakeRequest(ctx, accessSharedFileQuery, accessVariables, &accessResponse3)
	suite.NoError(err, "Third access should succeed")
	suite.AssertGraphQLSuccess(accessResponse3)

	// Fourth download should fail (exceeded max downloads)
	var accessResponse4 map[string]interface{}
	err = suite.Server.MakeRequest(ctx, accessSharedFileQuery, accessVariables, &accessResponse4)
	suite.NoError(err, "Request should not fail")
	suite.AssertGraphQLError(accessResponse4, "download limit exceeded")

	// Step 4: Test failed access attempts
	wrongPasswordVariables := map[string]interface{}{
		"input": map[string]interface{}{
			"token":          shareToken,
			"master_password": "WrongPassword123!",
		},
	}

	var wrongPasswordResponse map[string]interface{}
	err = suite.Server.MakeRequest(ctx, accessSharedFileQuery, wrongPasswordVariables, &wrongPasswordResponse)
	suite.NoError(err, "Wrong password request should not fail")
	suite.AssertGraphQLError(wrongPasswordResponse, "validation")

	// Step 5: Test invalid token
	invalidTokenVariables := map[string]interface{}{
		"input": map[string]interface{}{
			"token":          "invalid_token_123456789012345678901234567890123456789012345678901234567890",
			"master_password": masterPassword,
		},
	}

	var invalidTokenResponse map[string]interface{}
	err = suite.Server.MakeRequest(ctx, accessSharedFileQuery, invalidTokenVariables, &invalidTokenResponse)
	suite.NoError(err, "Invalid token request should not fail")
	suite.AssertGraphQLError(invalidTokenResponse, "not found")

	// Step 6: Verify share statistics
	getShareStatsQuery := `
		query GetShareStats($shareToken: String!) {
			getShareStats(shareToken: $shareToken) {
				total_attempts
				successful_attempts
				failed_attempts
				recent_attempts
				unique_ips
			}
		}
	`

	statsVariables := map[string]interface{}{
		"shareToken": shareToken,
	}

	var statsResponse struct {
		GetShareStats struct {
			TotalAttempts     int64 `json:"total_attempts"`
			SuccessfulAttempts int64 `json:"successful_attempts"`
			FailedAttempts    int64 `json:"failed_attempts"`
			RecentAttempts    int64 `json:"recent_attempts"`
			UniqueIPs         int64 `json:"unique_ips"`
		} `json:"getShareStats"`
	}

	err = suite.Server.MakeAuthenticatedRequest(ctx, token, getShareStatsQuery, statsVariables, &statsResponse)
	suite.NoError(err, "Getting share stats should succeed")
	suite.AssertGraphQLSuccess(statsResponse)
	suite.Equal(int64(5), statsResponse.GetShareStats.TotalAttempts, "Should have 5 total attempts (3 successful + 2 failed)")
	suite.Equal(int64(3), statsResponse.GetShareStats.SuccessfulAttempts, "Should have 3 successful attempts")
	suite.Equal(int64(2), statsResponse.GetShareStats.FailedAttempts, "Should have 2 failed attempts")
	suite.True(statsResponse.GetShareStats.RecentAttempts >= 5, "Should have recent attempts")
	suite.True(statsResponse.GetShareStats.UniqueIPs >= 1, "Should have at least 1 unique IP")
}

// Helper function to generate SHA-256 hash
func generateSHA256Hash(content string) string {
	hash := sha256.Sum256([]byte(content))
	return hex.EncodeToString(hash[:])
}
