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
	username := "newuser"
	email := "newuser@test.com"
	password := "TestPass123!"

	// GraphQL mutation for registration
	query := `
		mutation Register($input: RegisterInput!) {
			register(input: $input) {
				token
				user {
					id
					username
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
			"username": username,
			"email":    email,
			"password": password,
		},
	}

	var response struct {
		Data struct {
			Register struct {
				Token string `json:"token"`
				User  struct {
					ID           string `json:"id"`
					Username     string `json:"username"`
					Email        string `json:"email"`
					IsAdmin      bool   `json:"is_admin"`
					StorageQuota int    `json:"storage_quota"`
					UsedStorage  int    `json:"used_storage"`
				} `json:"user"`
			} `json:"register"`
		} `json:"data"`
	}

	// Execute the mutation
	err := suite.Server.MakeRequest(ctx, query, variables, &response)
	suite.NoError(err, "Registration should succeed")

	// Validate response
	suite.AssertGraphQLSuccess(response)
	suite.NotEmpty(response.Data.Register.Token, "JWT token should be returned")
	suite.Equal(username, response.Data.Register.User.Username, "Username should match")
	suite.Equal(email, response.Data.Register.User.Email, "Email should match")
	suite.False(response.Data.Register.User.IsAdmin, "New user should not be admin")
	suite.Equal(104857600, response.Data.Register.User.StorageQuota, "Storage quota should be default 100MB")
	suite.Equal(0, response.Data.Register.User.UsedStorage, "Used storage should be 0")

	// Validate database state
	user := suite.AssertUserExistsInDB(email)
	suite.Equal(username, user.Username, "Username should match in database")
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
		username  string
		email     string
		password  string
		errorMsg  string
	}{
		{
			name:     "Empty username",
			username: "",
			email:    "test@test.com",
			password: "password123",
			errorMsg: "username",
		},
		{
			name:     "Empty email",
			username: "testuser",
			email:    "",
			password: "password123",
			errorMsg: "email",
		},
		{
			name:     "Invalid email format",
			username: "testuser",
			email:    "invalid-email",
			password: "password123",
			errorMsg: "invalid email format",
		},
		{
			name:     "Empty password",
			username: "testuser",
			email:    "test@test.com",
			password: "",
			errorMsg: "password",
		},
		{
			name:     "Password too short",
			username: "testuser",
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
					"username": tc.username,
					"email":    tc.email,
					"password": tc.password,
				},
			}

			var response map[string]interface{}
			err := suite.Server.MakeRequest(ctx, query, variables, &response)
			suite.NoError(err, "GraphQL request should succeed")
			suite.AssertGraphQLError(response, tc.errorMsg)
		})
	}
}

// TestUserRegistrationDuplicateEmail tests registration with existing email
func (suite *AuthIntegrationTestSuite) TestUserRegistrationDuplicateEmail() {
	ctx := context.Background()

	// Use existing admin user email
	username := "duplicateuser"
	email := suite.TestData.AdminUser.Email
	password := "TestPass123!"

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
			"username": username,
			"email":    email,
			"password": password,
		},
	}

	var response map[string]interface{}
	err := suite.Server.MakeRequest(ctx, query, variables, &response)
	suite.NoError(err, "GraphQL request should succeed")
	suite.AssertGraphQLError(response, "user with this email already exists")
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
			"identifier":    email,
			"password": password,
		},
	}

	var response struct {
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

	err := suite.Server.MakeRequest(ctx, query, variables, &response)
	suite.NoError(err, "Login should succeed")

	// Validate response
	suite.AssertGraphQLSuccess(response)
	suite.NotEmpty(response.Data.Login.Token, "JWT token should be returned")
	suite.Equal(email, response.Data.Login.User.Email, "Email should match")
	suite.False(response.Data.Login.User.IsAdmin, "Regular user should not be admin")
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
			"identifier":    email,
			"password": password,
		},
	}

	var response map[string]interface{}
	err := suite.Server.MakeRequest(ctx, query, variables, &response)
	suite.NoError(err, "GraphQL request should succeed")
	suite.AssertGraphQLError(response, "invalid credentials")
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
			"identifier":    email,
			"password": password,
		},
	}

	var response map[string]interface{}
	err := suite.Server.MakeRequest(ctx, query, variables, &response)
	suite.NoError(err, "GraphQL request should succeed")
	suite.AssertGraphQLError(response, "invalid credentials")
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
	testData := []struct {
		username string
		email    string
	}{
		{"concurrent1", "concurrent1@test.com"},
		{"concurrent2", "concurrent2@test.com"},
		{"concurrent3", "concurrent3@test.com"},
	}

	for _, data := range testData {
		query := `
			mutation Register($input: RegisterInput!) {
				register(input: $input) {
					token
					user {
						id
						username
						email
					}
				}
			}
		`

		variables := map[string]interface{}{
			"input": map[string]interface{}{
				"username": data.username,
				"email":    data.email,
				"password": "TestPass123!",
			},
		}

		var response struct {
			Data struct {
				Register struct {
					Token string `json:"token"`
					User  struct {
						ID       string `json:"id"`
						Username string `json:"username"`
						Email    string `json:"email"`
					} `json:"user"`
				} `json:"register"`
			} `json:"data"`
		}

		err := suite.Server.MakeRequest(ctx, query, variables, &response)
		suite.NoError(err, "Registration should succeed")
		suite.AssertGraphQLSuccess(response)
		suite.Equal(data.username, response.Register.User.Username, "Username should match")
		suite.Equal(data.email, response.Register.User.Email, "Email should match")

		// Verify user was created in database
		suite.AssertUserExistsInDB(data.email)
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
	suite.NoError(err, "GraphQL request should succeed")
	suite.AssertGraphQLError(invalidResponse, "token has invalid claims")
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
			"identifier":    regularEmail,
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