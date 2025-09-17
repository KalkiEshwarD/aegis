// Package integration provides comprehensive integration tests for file management features
package integration

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
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

	// Test file upload
	filename := "test_document.txt"
	content := "This is test file content for upload"
	contentHash := generateSHA256Hash(content)
	mimeType := "text/plain"
	encryptionKey := "test_encryption_key_123"

	uploadQuery := `
		mutation UploadFile($input: UploadFileInput!) {
			uploadFile(input: $input) {
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
			"filename":     filename,
			"content_hash": contentHash,
			"size_bytes":   len(content),
			"mime_type":    mimeType,
			"encrypted_key": encryptionKey,
			"file_data":    content, // In real implementation, this would be a file upload
		},
	}

	var uploadResponse struct {
		UploadFile struct {
			ID       string `json:"id"`
			Filename string `json:"filename"`
			MimeType string `json:"mime_type"`
			UserID   string `json:"user_id"`
			FileID   string `json:"file_id"`
		} `json:"uploadFile"`
	}

	err = suite.Server.MakeAuthenticatedRequest(ctx, token, uploadQuery, uploadVariables, &uploadResponse)
	suite.NoError(err, "File upload should succeed")

	// Validate response
	suite.AssertGraphQLSuccess(uploadResponse)
	suite.Equal(filename, uploadResponse.UploadFile.Filename, "Filename should match")
	suite.Equal(mimeType, uploadResponse.UploadFile.MimeType, "MIME type should match")
	suite.Equal(loginResponse.Login.User.ID, uploadResponse.UploadFile.UserID, "User ID should match")

	// Validate database state
	suite.AssertFileExistsInDB(contentHash)
	user := suite.AssertUserExistsInDB(email)
	suite.AssertUserFileCount(user.ID, 3) // Should have 2 existing + 1 new
}

// TestFileUploadDeduplication tests file deduplication with existing hash
func (suite *FileIntegrationTestSuite) TestFileUploadDeduplication() {
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

	// Use existing file's content hash for deduplication test
	existingContentHash := suite.TestData.File1.ContentHash
	content := "This is test file content" // Same content as File1
	mimeType := "text/plain"
	encryptionKey := "test_encryption_key_456"

	uploadQuery := `
		mutation UploadFile($input: UploadFileInput!) {
			uploadFile(input: $input) {
				id
				filename
				file_id
			}
		}
	`

	uploadVariables := map[string]interface{}{
		"input": map[string]interface{}{
			"filename":     "duplicate_test.txt",
			"content_hash": existingContentHash,
			"size_bytes":   len(content),
			"mime_type":    mimeType,
			"encrypted_key": encryptionKey,
			"file_data":    content,
		},
	}

	var uploadResponse struct {
		UploadFile struct {
			ID     string `json:"id"`
			Filename string `json:"filename"`
			FileID string `json:"file_id"`
		} `json:"uploadFile"`
	}

	err = suite.Server.MakeAuthenticatedRequest(ctx, token, uploadQuery, uploadVariables, &uploadResponse)
	suite.NoError(err, "File upload with existing hash should succeed")

	// Validate that it reused the existing file
	suite.AssertGraphQLSuccess(uploadResponse)
	suite.Equal(fmt.Sprintf("%d", suite.TestData.File1.ID), uploadResponse.UploadFile.FileID, "Should reuse existing file ID")
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
		DeleteFile bool `json:"deleteFile"`
	}

	err = suite.Server.MakeAuthenticatedRequest(ctx, token, deleteQuery, deleteVariables, &deleteResponse)
	suite.NoError(err, "File deletion should succeed")

	// Validate response
	suite.AssertGraphQLSuccess(deleteResponse)
	suite.True(deleteResponse.DeleteFile, "Delete operation should return true")

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

	// Try to upload a file that would exceed quota
	// User has 100MB quota, let's try to upload a 200MB file
	largeContent := strings.Repeat("x", 200*1024*1024) // 200MB
	contentHash := generateSHA256Hash(largeContent)

	uploadQuery := `
		mutation UploadFile($input: UploadFileInput!) {
			uploadFile(input: $input) {
				id
				filename
			}
		}
	`

	uploadVariables := map[string]interface{}{
		"input": map[string]interface{}{
			"filename":     "large_file.txt",
			"content_hash": contentHash,
			"size_bytes":   len(largeContent),
			"mime_type":    "text/plain",
			"encrypted_key": "test_key",
			"file_data":    largeContent,
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
			uploadQuery := `
				mutation UploadFile($input: UploadFileInput!) {
					uploadFile(input: $input) {
						id
						filename
					}
				}
			`

			uploadVariables := map[string]interface{}{
				"input": map[string]interface{}{
					"filename":     tc.filename,
					"content_hash": tc.contentHash,
					"size_bytes":   tc.sizeBytes,
					"mime_type":    tc.mimeType,
					"encrypted_key": "test_key",
					"file_data":    "test content",
				},
			}

			var uploadResponse map[string]interface{}

			err := suite.Server.MakeAuthenticatedRequest(ctx, token, uploadQuery, uploadVariables, &uploadResponse)
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

	// Simulate concurrent uploads (sequential for testing)
	files := []string{"concurrent1.txt", "concurrent2.txt", "concurrent3.txt"}

	for _, filename := range files {
		content := fmt.Sprintf("Content for %s", filename)
		contentHash := generateSHA256Hash(content)

		uploadQuery := `
			mutation UploadFile($input: UploadFileInput!) {
				uploadFile(input: $input) {
					id
					filename
				}
			}
		`

		uploadVariables := map[string]interface{}{
			"input": map[string]interface{}{
				"filename":     filename,
				"content_hash": contentHash,
				"size_bytes":   len(content),
				"mime_type":    "text/plain",
				"encrypted_key": fmt.Sprintf("key_%s", filename),
				"file_data":    content,
			},
		}

		var uploadResponse struct {
			UploadFile struct {
				ID       string `json:"id"`
				Filename string `json:"filename"`
			} `json:"uploadFile"`
		}

		err := suite.Server.MakeAuthenticatedRequest(ctx, token, uploadQuery, uploadVariables, &uploadResponse)
		suite.NoError(err, "Concurrent file upload should succeed")
		suite.AssertGraphQLSuccess(uploadResponse)
		suite.Equal(filename, uploadResponse.UploadFile.Filename, "Filename should match")
	}

	// Verify all files were created
	user := suite.AssertUserExistsInDB(email)
	suite.AssertUserFileCount(user.ID, 2+len(files)) // 2 original + 3 new
}

// Helper function to generate SHA-256 hash
func generateSHA256Hash(content string) string {
	hash := sha256.Sum256([]byte(content))
	return hex.EncodeToString(hash[:])
}