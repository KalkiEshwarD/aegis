// Package integration provides comprehensive integration tests for admin operations
package integration

import (
	"context"
	"fmt"
	"testing"

	"github.com/stretchr/testify/suite"
)

// AdminIntegrationTestSuite tests admin-specific functionality
type AdminIntegrationTestSuite struct {
	BaseIntegrationTestSuite
}

// TestAdminIntegration runs the admin integration test suite
func TestAdminIntegration(t *testing.T) {
	suite.Run(t, &AdminIntegrationTestSuite{})
}

// TestAdminDashboardStatistics tests admin dashboard statistics
func (suite *AdminIntegrationTestSuite) TestAdminDashboardStatistics() {
	ctx := context.Background()

	// Login as admin
	email := suite.TestData.AdminUser.Email
	password := "password123"

	loginQuery := `
		mutation Login($input: LoginInput!) {
			login(input: $input) {
				token
				user {
					id
					email
					is_admin
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
		Data struct {
			Login struct {
				Token string `json:"token"`
				User  struct {
					ID      string `json:"id"`
					Email   string `json:"email"`
					IsAdmin bool   `json:"is_admin"`
				} `json:"user"`
			} `json:"login"`
		} `json:"data"`
	}

	err := suite.Server.MakeRequest(ctx, loginQuery, variables, &loginResponse)
	suite.NoError(err, "Admin login should succeed")
	fmt.Printf("DEBUG: IsAdmin value: %v\n", loginResponse.Data.Login.User.IsAdmin)
	suite.True(loginResponse.Data.Login.User.IsAdmin, "User should be admin")
	token := loginResponse.Data.Login.Token

	// Query admin dashboard
	dashboardQuery := `
		query AdminDashboard {
			adminDashboard {
				total_users
				total_files
				total_storage_used
				recent_uploads {
					id
					filename
					user_id
				}
			}
		}
	`

	var dashboardResponse struct {
		Data struct {
			AdminDashboard struct {
				TotalUsers       int `json:"total_users"`
				TotalFiles       int `json:"total_files"`
				TotalStorageUsed int `json:"total_storage_used"`
				RecentUploads    []struct {
					ID       string `json:"id"`
					Filename string `json:"filename"`
					UserID   string `json:"user_id"`
				} `json:"recent_uploads"`
			} `json:"adminDashboard"`
		} `json:"data"`
	}

	err = suite.Server.MakeAuthenticatedRequest(ctx, token, dashboardQuery, nil, &dashboardResponse)
	suite.NoError(err, "Admin dashboard query should succeed")

	// Validate response
	suite.AssertGraphQLSuccess(dashboardResponse)
	suite.True(dashboardResponse.Data.AdminDashboard.TotalUsers >= 3, "Should have at least 3 users (from test data)")
	suite.True(dashboardResponse.Data.AdminDashboard.TotalFiles >= 2, "Should have at least 2 files (from test data)")
	suite.True(dashboardResponse.Data.AdminDashboard.TotalStorageUsed >= 0, "Storage used should be non-negative")

	// Recent uploads should include test files
	found := false
	for _, upload := range dashboardResponse.Data.AdminDashboard.RecentUploads {
		if upload.Filename == suite.TestData.UserFile1.Filename {
			found = true
			break
		}
	}
	suite.True(found, "Recent uploads should include test files")
}

// TestUserPromotionToAdmin tests promoting a regular user to admin
func (suite *AdminIntegrationTestSuite) TestUserPromotionToAdmin() {
	ctx := context.Background()

	// Login as admin
	email := suite.TestData.AdminUser.Email
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

	err := suite.Server.MakeRequest(ctx, loginQuery, variables, &loginResponse)
	suite.NoError(err, "Admin login should succeed")
	token := loginResponse.Data.Login.Token

	// Promote regular user to admin
	userID := fmt.Sprintf("%d", suite.TestData.RegularUser.ID)

	promoteQuery := `
		mutation PromoteUserToAdmin($user_id: ID!) {
			promoteUserToAdmin(user_id: $user_id)
		}
	`

	promoteVariables := map[string]interface{}{
		"user_id": userID,
	}

	var promoteResponse struct {
		PromoteUserToAdmin bool `json:"promoteUserToAdmin"`
	}

	err = suite.Server.MakeAuthenticatedRequest(ctx, token, promoteQuery, promoteVariables, &promoteResponse)
	suite.NoError(err, "User promotion should succeed")

	// Validate response
	suite.AssertGraphQLSuccess(promoteResponse)
	suite.True(promoteResponse.PromoteUserToAdmin, "Promotion should return true")

	// Validate database state - user should now be admin
	user := suite.AssertUserExistsInDB(suite.TestData.RegularUser.Email)
	suite.True(user.IsAdmin, "User should now be admin in database")

	// Verify user can access admin queries
	adminDashboardQuery := `
		query AdminDashboard {
			adminDashboard {
				total_users
			}
		}
	`

	var adminDashboardResponse struct {
		AdminDashboard struct {
			TotalUsers int `json:"total_users"`
		} `json:"adminDashboard"`
	}

	// Login as the newly promoted admin
	regularLoginVars := map[string]interface{}{
		"input": map[string]interface{}{
			"identifier": suite.TestData.RegularUser.Email,
			"password":   password,
		},
	}

	var regularLoginResponse struct {
		Login struct {
			Token string `json:"token"`
			User  struct {
				ID      string `json:"id"`
				Email   string `json:"email"`
				IsAdmin bool   `json:"is_admin"`
			} `json:"user"`
		} `json:"login"`
	}

	err = suite.Server.MakeRequest(ctx, loginQuery, regularLoginVars, &regularLoginResponse)
	suite.NoError(err, "Promoted user login should succeed")
	suite.True(regularLoginResponse.Login.User.IsAdmin, "Promoted user should be admin")

	promotedToken := regularLoginResponse.Login.Token

	err = suite.Server.MakeAuthenticatedRequest(ctx, promotedToken, adminDashboardQuery, nil, &adminDashboardResponse)
	suite.NoError(err, "Promoted admin should access admin dashboard")
	suite.AssertGraphQLSuccess(adminDashboardResponse)
}

// TestUserDeletionByAdmin tests admin deleting user accounts
func (suite *AdminIntegrationTestSuite) TestUserDeletionByAdmin() {
	ctx := context.Background()

	// First, create a test user to delete
	createUserQuery := `
		mutation Register($input: RegisterInput!) {
			register(input: $input) {
				user {
					id
					email
				}
			}
		}
	`

	createVariables := map[string]interface{}{
		"input": map[string]interface{}{
			"identifier": "delete_me@test.com",
			"password":   "password123",
		},
	}

	var createResponse struct {
		Register struct {
			User struct {
				ID    string `json:"id"`
				Email string `json:"email"`
			} `json:"user"`
		} `json:"register"`
	}

	err := suite.Server.MakeRequest(ctx, createUserQuery, createVariables, &createResponse)
	suite.NoError(err, "User creation should succeed")
	userToDeleteID := createResponse.Register.User.ID

	// Login as admin
	adminEmail := suite.TestData.AdminUser.Email
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

	loginVariables := map[string]interface{}{
		"input": map[string]interface{}{
			"identifier": adminEmail,
			"password":   password,
		},
	}

	var loginResponse struct {
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

	err = suite.Server.MakeRequest(ctx, loginQuery, loginVariables, &loginResponse)
	suite.NoError(err, "Admin login should succeed")
	token := loginResponse.Data.Login.Token

	// Delete the user
	deleteQuery := `
		mutation DeleteUserAccount($user_id: ID!) {
			deleteUserAccount(user_id: $user_id)
		}
	`

	deleteVariables := map[string]interface{}{
		"user_id": userToDeleteID,
	}

	var deleteResponse struct {
		DeleteUserAccount bool `json:"deleteUserAccount"`
	}

	err = suite.Server.MakeAuthenticatedRequest(ctx, token, deleteQuery, deleteVariables, &deleteResponse)
	suite.NoError(err, "User deletion should succeed")

	// Validate response
	suite.AssertGraphQLSuccess(deleteResponse)
	suite.True(deleteResponse.DeleteUserAccount, "Deletion should return true")

	// Validate database state - user should be deleted
	suite.AssertUserNotExistsInDB("delete_me@test.com")
}

// TestAdminAccessControl tests that only admins can access admin operations
func (suite *AdminIntegrationTestSuite) TestAdminAccessControl() {
	ctx := context.Background()

	// Login as regular user
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

	err := suite.Server.MakeRequest(ctx, loginQuery, variables, &loginResponse)
	suite.NoError(err, "Regular user login should succeed")
	token := loginResponse.Data.Login.Token

	// Try to access admin dashboard (should fail)
	dashboardQuery := `
		query AdminDashboard {
			adminDashboard {
				total_users
			}
		}
	`

	var dashboardResponse map[string]interface{}

	err = suite.Server.MakeAuthenticatedRequest(ctx, token, dashboardQuery, nil, &dashboardResponse)
	suite.Error(err, "Request should fail with GraphQL error")
	suite.Contains(err.Error(), "admin", "Error should contain admin access message")

	// Try to promote another user (should fail)
	userID := fmt.Sprintf("%d", suite.TestData.AnotherUser.ID)

	promoteQuery := `
		mutation PromoteUserToAdmin($user_id: ID!) {
			promoteUserToAdmin(user_id: $user_id)
		}
	`

	promoteVariables := map[string]interface{}{
		"user_id": userID,
	}

	var promoteResponse map[string]interface{}

	err = suite.Server.MakeAuthenticatedRequest(ctx, token, promoteQuery, promoteVariables, &promoteResponse)
	suite.Error(err, "Request should fail with GraphQL error")
	suite.Contains(err.Error(), "admin", "Error should contain admin access message")

	// Try to delete another user (should fail)
	deleteQuery := `
		mutation DeleteUserAccount($user_id: ID!) {
			deleteUserAccount(user_id: $user_id)
		}
	`

	deleteVariables := map[string]interface{}{
		"user_id": userID,
	}

	var deleteResponse map[string]interface{}

	err = suite.Server.MakeAuthenticatedRequest(ctx, token, deleteQuery, deleteVariables, &deleteResponse)
	suite.Error(err, "Request should fail with GraphQL error")
	suite.Contains(err.Error(), "admin", "Error should contain admin access message")
}

// TestAllUsersQuery tests querying all users (admin only)
func (suite *AdminIntegrationTestSuite) TestAllUsersQuery() {
	ctx := context.Background()

	// Login as admin
	email := suite.TestData.AdminUser.Email
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

	err := suite.Server.MakeRequest(ctx, loginQuery, variables, &loginResponse)
	suite.NoError(err, "Admin login should succeed")
	token := loginResponse.Data.Login.Token

	// Query all users
	allUsersQuery := `
		query AllUsers {
			allUsers {
				id
				email
				is_admin
				storage_quota
				used_storage
			}
		}
	`

	var allUsersResponse struct {
		AllUsers []struct {
			ID           string `json:"id"`
			Email        string `json:"email"`
			IsAdmin      bool   `json:"is_admin"`
			StorageQuota int    `json:"storage_quota"`
			UsedStorage  int    `json:"used_storage"`
		} `json:"allUsers"`
	}

	err = suite.Server.MakeAuthenticatedRequest(ctx, token, allUsersQuery, nil, &allUsersResponse)
	suite.NoError(err, "All users query should succeed")

	// Validate response
	suite.AssertGraphQLSuccess(allUsersResponse)
	suite.True(len(allUsersResponse.AllUsers) >= 3, "Should have at least 3 users")

	// Verify admin user is included and marked as admin
	found := false
	for _, user := range allUsersResponse.AllUsers {
		if user.Email == email {
			suite.True(user.IsAdmin, "Admin user should be marked as admin")
			found = true
			break
		}
	}
	suite.True(found, "Admin user should be found in all users list")
}

// TestAllFilesQuery tests querying all files (admin only)
func (suite *AdminIntegrationTestSuite) TestAllFilesQuery() {
	ctx := context.Background()

	// Login as admin
	email := suite.TestData.AdminUser.Email
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

	err := suite.Server.MakeRequest(ctx, loginQuery, variables, &loginResponse)
	suite.NoError(err, "Admin login should succeed")
	token := loginResponse.Data.Login.Token

	// Query all files
	allFilesQuery := `
		query AllFiles {
			allFiles {
				id
				filename
				mime_type
				user_id
				file_id
			}
		}
	`

	var allFilesResponse struct {
		AllFiles []struct {
			ID       string `json:"id"`
			Filename string `json:"filename"`
			MimeType string `json:"mime_type"`
			UserID   string `json:"user_id"`
			FileID   string `json:"file_id"`
		} `json:"allFiles"`
	}

	err = suite.Server.MakeAuthenticatedRequest(ctx, token, allFilesQuery, nil, &allFilesResponse)
	suite.NoError(err, "All files query should succeed")

	// Validate response
	suite.AssertGraphQLSuccess(allFilesResponse)
	suite.True(len(allFilesResponse.AllFiles) >= 2, "Should have at least 2 files")

	// Verify test files are included
	found := false
	for _, file := range allFilesResponse.AllFiles {
		if file.Filename == suite.TestData.UserFile1.Filename {
			found = true
			break
		}
	}
	suite.True(found, "Test file should be found in all files list")
}

// TestAdminUserStats tests user statistics queries
func (suite *AdminIntegrationTestSuite) TestAdminUserStats() {
	ctx := context.Background()

	// Login as admin
	email := suite.TestData.AdminUser.Email
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
	suite.NoError(err, "Admin login should succeed")
	token := loginResponse.Login.Token

	// Query user stats
	userStatsQuery := `
		query UserStats {
			myStats {
				total_files
				used_storage
				storage_quota
				storage_savings
			}
		}
	`

	var userStatsResponse struct {
		MyStats struct {
			TotalFiles     int `json:"total_files"`
			UsedStorage    int `json:"used_storage"`
			StorageQuota   int `json:"storage_quota"`
			StorageSavings int `json:"storage_savings"`
		} `json:"myStats"`
	}

	err = suite.Server.MakeAuthenticatedRequest(ctx, token, userStatsQuery, nil, &userStatsResponse)
	suite.NoError(err, "User stats query should succeed")

	// Validate response
	suite.AssertGraphQLSuccess(userStatsResponse)
	suite.True(userStatsResponse.MyStats.TotalFiles >= 0, "Total files should be non-negative")
	suite.True(userStatsResponse.MyStats.UsedStorage >= 0, "Used storage should be non-negative")
	suite.True(userStatsResponse.MyStats.StorageQuota > 0, "Storage quota should be positive")
	suite.True(userStatsResponse.MyStats.StorageSavings >= 0, "Storage savings should be non-negative")
}

// TestAdminSelfDeletionPrevention tests that admins cannot delete themselves
func (suite *AdminIntegrationTestSuite) TestAdminSelfDeletionPrevention() {
	ctx := context.Background()

	// Login as admin
	email := suite.TestData.AdminUser.Email
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

	err := suite.Server.MakeRequest(ctx, loginQuery, variables, &loginResponse)
	suite.NoError(err, "Admin login should succeed")
	token := loginResponse.Data.Login.Token

	// Try to delete own account (should fail)
	userID := loginResponse.Data.Login.User.ID

	deleteQuery := `
		mutation DeleteUserAccount($user_id: ID!) {
			deleteUserAccount(user_id: $user_id)
		}
	`

	deleteVariables := map[string]interface{}{
		"user_id": userID,
	}

	var deleteResponse map[string]interface{}

	err = suite.Server.MakeAuthenticatedRequest(ctx, token, deleteQuery, deleteVariables, &deleteResponse)
	suite.NoError(err, "Request should not fail")

	// Should contain self-deletion prevention error
	suite.AssertGraphQLError(deleteResponse, "self")
}
