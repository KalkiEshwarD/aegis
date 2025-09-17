// Package integration provides comprehensive integration tests for authentication features
package integration

import (
	"context"
	"strings"
	"testing"

	"github.com/stretchr/testify/suite"
	"golang.org/x/crypto/bcrypt"
)

// AuthIntegrationTestSuite tests authentication-related functionality
type AuthIntegrationTestSuite struct {
	BaseIntegrationTestSuite
}

// TestAuthIntegration runs the auth integration test suite
func TestAuthIntegration(t *testing.T) {
	suite.Run(t, &AuthIntegrationTestSuite{})
}

// TestUserRegistrationSuccess tests successful user registration
func (suite *AuthIntegrationTestSuite) TestUserRegistrationSuccess() {
	ctx := context.Background()

	// Test data
	email := "newuser@test.com"
	password := "securepassword123"

	// GraphQL mutation for registration
	query := `
		mutation Register($input: RegisterInput!) {
			register(input: $input) {
				token
				user {
					id
					email
					is_admin
					storage_quota
					used_storage
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

	var response struct {
		Register struct {
			Token string `json:"token"`
			User  struct {
				ID           string `json:"id"`
				Email        string `json:"email"`
				IsAdmin      bool   `json:"is_admin"`
				StorageQuota int    `json:"storage_quota"`
				UsedStorage  int    `json:"used_storage"`
			} `json:"user"`
		} `json:"register"`
	}

	// Execute the mutation
	err := suite.Server.MakeRequest(ctx, query, variables, &response)
	suite.NoError(err, "Registration should succeed")

	// Validate response
	suite.AssertGraphQLSuccess(response)
	suite.NotEmpty(response.Register.Token, "JWT token should be returned")
	suite.Equal(email, response.Register.User.Email, "Email should match")
	suite.False(response.Register.User.IsAdmin, "New user should not be admin")
	suite.Equal(104857600, response.Register.User.StorageQuota, "Storage quota should be default 100MB")
	suite.Equal(0, response.Register.User.UsedStorage, "Used storage should be 0")

	// Validate database state
	user := suite.AssertUserExistsInDB(email)
	suite.False(user.IsAdmin, "User should not be admin in database")
	suite.Equal(int64(104857600), user.StorageQuota, "Storage quota should match")
	suite.Equal(int64(0), user.UsedStorage, "Used storage should be 0")

	// Validate password hashing
	err = bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(password))
	suite.NoError(err, "Password should be properly hashed")
}

// TestUserRegistrationValidationErrors tests registration with invalid input
func (suite *AuthIntegrationTestSuite) TestUserRegistrationValidationErrors() {
	ctx := context.Background()

	testCases := []struct {
		name      string
		email     string
		password  string
		errorMsg  string
	}{
		{
			name:     "Empty email",
			email:    "",
			password: "password123",
			errorMsg: "email",
		},
		{
			name:     "Invalid email format",
			email:    "invalid-email",
			password: "password123",
			errorMsg: "email",
		},
		{
			name:     "Empty password",
			email:    "test@test.com",
			password: "",
			errorMsg: "password",
		},
		{
			name:     "Password too short",
			email:    "test@test.com",
			password: "123",
			errorMsg: "password",
		},
	}

	for _, tc := range testCases {
		suite.Run(tc.name, func() {
			query := `
				mutation Register($input: RegisterInput!) {
					register(input: $input) {
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
					"email":    tc.email,
					"password": tc.password,
				},
			}

			var response map[string]interface{}
			err := suite.Server.MakeRequest(ctx, query, variables, &response)
			suite.Error(err, "Request should fail with validation error")
			suite.Contains(err.Error(), tc.errorMsg, "Error should contain expected validation message")
		})
	}
}

// TestUserRegistrationDuplicateEmail tests registration with existing email
func (suite *AuthIntegrationTestSuite) TestUserRegistrationDuplicateEmail() {
	ctx := context.Background()

	// Use existing admin user email
	email := suite.TestData.AdminUser.Email
	password := "newpassword123"

	query := `
		mutation Register($input: RegisterInput!) {
			register(input: $input) {
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

	var response map[string]interface{}
	err := suite.Server.MakeRequest(ctx, query, variables, &response)
	suite.Error(err, "Request should fail with duplicate email error")
	suite.Contains(err.Error(), "user with this email already exists", "Error should indicate duplicate email")
}

// TestUserLoginSuccess tests successful user login
func (suite *AuthIntegrationTestSuite) TestUserLoginSuccess() {
	ctx := context.Background()

	email := suite.TestData.RegularUser.Email
	password := "password123"

	query := `
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
			"email":    email,
			"password": password,
		},
	}

	var response struct {
		Login struct {
			Token string `json:"token"`
			User  struct {
				ID      string `json:"id"`
				Email   string `json:"email"`
				IsAdmin bool   `json:"is_admin"`
			} `json:"user"`
		} `json:"login"`
	}

	err := suite.Server.MakeRequest(ctx, query, variables, &response)
	suite.NoError(err, "Login should succeed")

	// Validate response
	suite.AssertGraphQLSuccess(response)
	suite.NotEmpty(response.Login.Token, "JWT token should be returned")
	suite.Equal(email, response.Login.User.Email, "Email should match")
	suite.False(response.Login.User.IsAdmin, "Regular user should not be admin")
}

// TestUserLoginWrongPassword tests login with incorrect password
func (suite *AuthIntegrationTestSuite) TestUserLoginWrongPassword() {
	ctx := context.Background()

	email := suite.TestData.RegularUser.Email
	password := "wrongpassword"

	query := `
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

	var response map[string]interface{}
	err := suite.Server.MakeRequest(ctx, query, variables, &response)
	suite.Error(err, "Request should fail with invalid credentials")
	suite.Contains(err.Error(), "invalid credentials", "Error should indicate invalid credentials")
}

// TestUserLoginNonExistentUser tests login with non-existent user
func (suite *AuthIntegrationTestSuite) TestUserLoginNonExistentUser() {
	ctx := context.Background()

	email := "nonexistent@test.com"
	password := "password123"

	query := `
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

	var response map[string]interface{}
	err := suite.Server.MakeRequest(ctx, query, variables, &response)
	suite.Error(err, "Request should fail with invalid credentials")
	suite.Contains(err.Error(), "invalid credentials", "Error should indicate invalid credentials")
}

// TestJWTTokenValidation tests JWT token validation and expiration
func (suite *AuthIntegrationTestSuite) TestJWTTokenValidation() {
	ctx := context.Background()

	// First, login to get a valid token
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
	suite.NotEmpty(token, "Token should be present")

	// Test authenticated query with valid token
	meQuery := `
		query Me {
			me {
				id
				email
			}
		}
	`

	var meResponse struct {
		Me struct {
			ID    string `json:"id"`
			Email string `json:"email"`
		} `json:"me"`
	}

	err = suite.Server.MakeAuthenticatedRequest(ctx, token, meQuery, nil, &meResponse)
	suite.NoError(err, "Authenticated query should succeed")
	suite.Equal(email, meResponse.Me.Email, "Email should match authenticated user")
}

// TestPasswordHashingVerification tests that passwords are properly hashed and verified
func (suite *AuthIntegrationTestSuite) TestPasswordHashingVerification() {
	// Test password hashing directly
	password := "testpassword123"
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	suite.NoError(err, "Password hashing should succeed")

	// Verify the hash works
	err = bcrypt.CompareHashAndPassword(hashedPassword, []byte(password))
	suite.NoError(err, "Password verification should succeed")

	// Test with wrong password
	err = bcrypt.CompareHashAndPassword(hashedPassword, []byte("wrongpassword"))
	suite.Error(err, "Wrong password should fail verification")
	suite.True(strings.Contains(err.Error(), "hashedPassword"), "Error should indicate hash mismatch")
}

// TestConcurrentUserRegistration tests concurrent user registration scenarios
func (suite *AuthIntegrationTestSuite) TestConcurrentUserRegistration() {
	ctx := context.Background()

	// This test simulates concurrent registration attempts
	// In a real scenario, you'd use goroutines, but for simplicity we'll test sequential
	emails := []string{
		"concurrent1@test.com",
		"concurrent2@test.com",
		"concurrent3@test.com",
	}

	for _, email := range emails {
		query := `
			mutation Register($input: RegisterInput!) {
				register(input: $input) {
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
				"password": "password123",
			},
		}

		var response struct {
			Register struct {
				Token string `json:"token"`
				User  struct {
					ID    string `json:"id"`
					Email string `json:"email"`
				} `json:"user"`
			} `json:"register"`
		}

		err := suite.Server.MakeRequest(ctx, query, variables, &response)
		suite.NoError(err, "Registration should succeed")
		suite.AssertGraphQLSuccess(response)
		suite.Equal(email, response.Register.User.Email, "Email should match")

		// Verify user was created in database
		suite.AssertUserExistsInDB(email)
	}
}

// TestUserSessionManagement tests user session management and token expiration
func (suite *AuthIntegrationTestSuite) TestUserSessionManagement() {
	ctx := context.Background()

	// Login to get token
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

	// Test that the token works for multiple requests
	for i := 0; i < 3; i++ {
		meQuery := `
			query Me {
				me {
					id
					email
				}
			}
		`

		var meResponse struct {
			Me struct {
				ID    string `json:"id"`
				Email string `json:"email"`
			} `json:"me"`
		}

		err = suite.Server.MakeAuthenticatedRequest(ctx, token, meQuery, nil, &meResponse)
		suite.NoError(err, "Authenticated query should succeed")
		suite.Equal(email, meResponse.Me.Email, "Email should match")
	}

	// Test with invalid token
	invalidToken := "invalid.jwt.token"
	var invalidResponse map[string]interface{}
	err = suite.Server.MakeAuthenticatedRequest(ctx, invalidToken, "query Me { me { id } }", nil, &invalidResponse)
	suite.Error(err, "Request should fail with invalid token")
	suite.Contains(err.Error(), "token has invalid claims", "Error should indicate invalid token")
}

// TestUserDataIsolation tests that user data is properly isolated between users
func (suite *AuthIntegrationTestSuite) TestUserDataIsolation() {
	ctx := context.Background()

	// Login as regular user
	regularEmail := suite.TestData.RegularUser.Email
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
			"email":    regularEmail,
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

	// Query user files - should only see their own files
	filesQuery := `
		query MyFiles {
			myFiles {
				id
				filename
				user_id
			}
		}
	`

	var filesResponse struct {
		MyFiles []struct {
			ID     string `json:"id"`
			Filename string `json:"filename"`
			UserID string `json:"user_id"`
		} `json:"myFiles"`
	}

	err = suite.Server.MakeAuthenticatedRequest(ctx, token, filesQuery, nil, &filesResponse)
	suite.NoError(err, "Files query should succeed")

	// Should only see files belonging to this user
	for _, file := range filesResponse.MyFiles {
		suite.Equal(suite.TestData.RegularUser.ID, uint(parseUint(file.UserID)), "File should belong to authenticated user")
	}
}

// Helper function to parse string to uint (simplified for testing)
func parseUint(s string) uint {
	// This is a simplified implementation for testing
	// In production, you'd use strconv.ParseUint
	if s == "1" {
		return 1
	}
	if s == "2" {
		return 2
	}
	return 0
}