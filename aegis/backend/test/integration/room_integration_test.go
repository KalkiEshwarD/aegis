// Package integration provides comprehensive integration tests for room collaboration features
package integration

import (
	"context"
	"fmt"
	"testing"

	"github.com/stretchr/testify/suite"
)

// RoomIntegrationTestSuite tests room collaboration functionality
type RoomIntegrationTestSuite struct {
	BaseIntegrationTestSuite
}

// TestRoomIntegration runs the room integration test suite
func TestRoomIntegration(t *testing.T) {
	suite.Run(t, &RoomIntegrationTestSuite{})
}

// TestRoomCreationSuccess tests successful room creation
func (suite *RoomIntegrationTestSuite) TestRoomCreationSuccess() {
	ctx := context.Background()

	// Login as admin user
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
	suite.NoError(err, "Login should succeed")
	token := loginResponse.Login.Token

	// Create a new room
	roomName := "Test Collaboration Room"

	createRoomQuery := `
		mutation CreateRoom($input: CreateRoomInput!) {
			createRoom(input: $input) {
				id
				name
				creator_id
				members {
					id
					user_id
					role
				}
			}
		}
	`

	createVariables := map[string]interface{}{
		"input": map[string]interface{}{
			"name": roomName,
		},
	}

	var createResponse struct {
		CreateRoom struct {
			ID        string `json:"id"`
			Name      string `json:"name"`
			CreatorID string `json:"creator_id"`
			Members   []struct {
				ID     string `json:"id"`
				UserID string `json:"user_id"`
				Role   string `json:"role"`
			} `json:"members"`
		} `json:"createRoom"`
	}

	err = suite.Server.MakeAuthenticatedRequest(ctx, token, createRoomQuery, createVariables, &createResponse)
	suite.NoError(err, "Room creation should succeed")

	// Validate response
	suite.AssertGraphQLSuccess(createResponse)
	suite.Equal(roomName, createResponse.CreateRoom.Name, "Room name should match")
	suite.Equal(loginResponse.Login.User.ID, createResponse.CreateRoom.CreatorID, "Creator ID should match")
	suite.Len(createResponse.CreateRoom.Members, 1, "Room should have one member (creator)")
	suite.Equal("ADMIN", createResponse.CreateRoom.Members[0].Role, "Creator should have ADMIN role")

	// Validate database state
	room := suite.AssertRoomExistsInDB(roomName)
	suite.Equal(suite.TestData.AdminUser.ID, room.CreatorID, "Room creator should match")
	suite.AssertRoomMemberCount(room.ID, 1)
}

// TestRoomMembershipManagement tests adding and removing room members
func (suite *RoomIntegrationTestSuite) TestRoomMembershipManagement() {
	ctx := context.Background()

	// Login as admin user
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
	suite.NoError(err, "Login should succeed")
	token := loginResponse.Login.Token

	// Create a room first
	roomName := "Membership Test Room"

	createRoomQuery := `
		mutation CreateRoom($input: CreateRoomInput!) {
			createRoom(input: $input) {
				id
				name
			}
		}
	`

	createVariables := map[string]interface{}{
		"input": map[string]interface{}{
			"name": roomName,
		},
	}

	var createResponse struct {
		CreateRoom struct {
			ID   string `json:"id"`
			Name string `json:"name"`
		} `json:"createRoom"`
	}

	err = suite.Server.MakeAuthenticatedRequest(ctx, token, createRoomQuery, createVariables, &createResponse)
	suite.NoError(err, "Room creation should succeed")
	roomID := createResponse.CreateRoom.ID

	// Add a member to the room
	userID := fmt.Sprintf("%d", suite.TestData.RegularUser.ID)

	addMemberQuery := `
		mutation AddRoomMember($input: AddRoomMemberInput!) {
			addRoomMember(input: $input)
		}
	`

	addMemberVariables := map[string]interface{}{
		"input": map[string]interface{}{
			"room_id": roomID,
			"user_id": userID,
			"role":    "CONTENT_EDITOR",
		},
	}

	var addMemberResponse struct {
		AddRoomMember bool `json:"addRoomMember"`
	}

	err = suite.Server.MakeAuthenticatedRequest(ctx, token, addMemberQuery, addMemberVariables, &addMemberResponse)
	suite.NoError(err, "Adding room member should succeed")

	// Validate response
	suite.AssertGraphQLSuccess(addMemberResponse)
	suite.True(addMemberResponse.AddRoomMember, "Add member should return true")

	// Validate database state
	room := suite.AssertRoomExistsInDB(roomName)
	suite.AssertRoomMemberCount(room.ID, 2)

	// Query room details to verify member was added
	roomQuery := `
		query Room($id: ID!) {
			room(id: $id) {
				id
				name
				members {
					id
					user_id
					role
					user {
						id
						email
					}
				}
			}
		}
	`

	roomVariables := map[string]interface{}{
		"id": roomID,
	}

	var roomResponse struct {
		Room struct {
			ID      string `json:"id"`
			Name    string `json:"name"`
			Members []struct {
				ID     string `json:"id"`
				UserID string `json:"user_id"`
				Role   string `json:"role"`
				User   struct {
					ID    string `json:"id"`
					Email string `json:"email"`
				} `json:"user"`
			} `json:"members"`
		} `json:"room"`
	}

	err = suite.Server.MakeAuthenticatedRequest(ctx, token, roomQuery, roomVariables, &roomResponse)
	suite.NoError(err, "Room query should succeed")

	// Verify member details
	suite.Len(roomResponse.Room.Members, 2, "Room should have 2 members")
	found := false
	for _, member := range roomResponse.Room.Members {
		if member.User.Email == suite.TestData.RegularUser.Email {
			suite.Equal("CONTENT_EDITOR", member.Role, "Member should have CONTENT_EDITOR role")
			found = true
			break
		}
	}
	suite.True(found, "Added member should be found in room")

	// Remove member from room
	removeMemberQuery := `
		mutation RemoveRoomMember($room_id: ID!, $user_id: ID!) {
			removeRoomMember(room_id: $room_id, user_id: $user_id)
		}
	`

	removeMemberVariables := map[string]interface{}{
		"room_id": roomID,
		"user_id": userID,
	}

	var removeMemberResponse struct {
		RemoveRoomMember bool `json:"removeRoomMember"`
	}

	err = suite.Server.MakeAuthenticatedRequest(ctx, token, removeMemberQuery, removeMemberVariables, &removeMemberResponse)
	suite.NoError(err, "Removing room member should succeed")

	// Validate response
	suite.AssertGraphQLSuccess(removeMemberResponse)
	suite.True(removeMemberResponse.RemoveRoomMember, "Remove member should return true")

	// Validate database state - member count should decrease
	suite.AssertRoomMemberCount(room.ID, 1)
}

// TestRoleBasedAccessControl tests role-based permissions in rooms
func (suite *RoomIntegrationTestSuite) TestRoleBasedAccessControl() {
	ctx := context.Background()

	// Login as admin to create room
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

	variables := map[string]interface{}{
		"input": map[string]interface{}{
			"identifier": adminEmail,
			"password":   password,
		},
	}

	var adminLoginResponse struct {
		Login struct {
			Token string `json:"token"`
			User  struct {
				ID    string `json:"id"`
				Email string `json:"email"`
			} `json:"user"`
		} `json:"login"`
	}

	err := suite.Server.MakeRequest(ctx, loginQuery, variables, &adminLoginResponse)
	suite.NoError(err, "Admin login should succeed")
	adminToken := adminLoginResponse.Login.Token

	// Create a room
	roomName := "RBAC Test Room"

	createRoomQuery := `
		mutation CreateRoom($input: CreateRoomInput!) {
			createRoom(input: $input) {
				id
				name
			}
		}
	`

	createVariables := map[string]interface{}{
		"input": map[string]interface{}{
			"name": roomName,
		},
	}

	var createResponse struct {
		CreateRoom struct {
			ID   string `json:"id"`
			Name string `json:"name"`
		} `json:"createRoom"`
	}

	err = suite.Server.MakeAuthenticatedRequest(ctx, adminToken, createRoomQuery, createVariables, &createResponse)
	suite.NoError(err, "Room creation should succeed")
	roomID := createResponse.CreateRoom.ID

	// Add members with different roles
	regularUserID := fmt.Sprintf("%d", suite.TestData.RegularUser.ID)
	anotherUserID := fmt.Sprintf("%d", suite.TestData.AnotherUser.ID)

	// Add CONTENT_EDITOR
	addEditorQuery := `
		mutation AddRoomMember($input: AddRoomMemberInput!) {
			addRoomMember(input: $input)
		}
	`

	editorVariables := map[string]interface{}{
		"input": map[string]interface{}{
			"room_id": roomID,
			"user_id": regularUserID,
			"role":    "CONTENT_EDITOR",
		},
	}

	var editorResponse struct {
		AddRoomMember bool `json:"addRoomMember"`
	}

	err = suite.Server.MakeAuthenticatedRequest(ctx, adminToken, addEditorQuery, editorVariables, &editorResponse)
	suite.NoError(err, "Adding editor should succeed")

	// Add CONTENT_VIEWER
	viewerVariables := map[string]interface{}{
		"input": map[string]interface{}{
			"room_id": roomID,
			"user_id": anotherUserID,
			"role":    "CONTENT_VIEWER",
		},
	}

	var viewerResponse struct {
		AddRoomMember bool `json:"addRoomMember"`
	}

	err = suite.Server.MakeAuthenticatedRequest(ctx, adminToken, addEditorQuery, viewerVariables, &viewerResponse)
	suite.NoError(err, "Adding viewer should succeed")

	// Test permissions - login as different users
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
				ID    string `json:"id"`
				Email string `json:"email"`
			} `json:"user"`
		} `json:"login"`
	}

	err = suite.Server.MakeRequest(ctx, loginQuery, regularLoginVars, &regularLoginResponse)
	suite.NoError(err, "Regular user login should succeed")
	editorToken := regularLoginResponse.Login.Token

	// Test that CONTENT_EDITOR can add members (should fail - only ADMIN can add members)
	addMemberByEditorVars := map[string]interface{}{
		"input": map[string]interface{}{
			"room_id": roomID,
			"user_id": anotherUserID,
			"role":    "CONTENT_CREATOR",
		},
	}

	var addMemberByEditorResponse map[string]interface{}

	err = suite.Server.MakeAuthenticatedRequest(ctx, editorToken, addEditorQuery, addMemberByEditorVars, &addMemberByEditorResponse)
	suite.NoError(err, "Request should not fail")

	// Should contain permission error
	suite.AssertGraphQLError(addMemberByEditorResponse, "permission")
}

// TestFileSharingInRooms tests file sharing functionality within rooms
func (suite *RoomIntegrationTestSuite) TestFileSharingInRooms() {
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
	suite.NoError(err, "Login should succeed")
	token := loginResponse.Login.Token

	// Create a room
	roomName := "File Sharing Test Room"

	createRoomQuery := `
		mutation CreateRoom($input: CreateRoomInput!) {
			createRoom(input: $input) {
				id
				name
			}
		}
	`

	createVariables := map[string]interface{}{
		"input": map[string]interface{}{
			"name": roomName,
		},
	}

	var createResponse struct {
		CreateRoom struct {
			ID   string `json:"id"`
			Name string `json:"name"`
		} `json:"createRoom"`
	}

	err = suite.Server.MakeAuthenticatedRequest(ctx, token, createRoomQuery, createVariables, &createResponse)
	suite.NoError(err, "Room creation should succeed")
	roomID := createResponse.CreateRoom.ID

	// Share a file to the room
	userFileID := fmt.Sprintf("%d", suite.TestData.UserFile1.ID)

	shareFileQuery := `
		mutation ShareFileToRoom($user_file_id: ID!, $room_id: ID!) {
			shareFileToRoom(user_file_id: $user_file_id, room_id: $room_id)
		}
	`

	shareVariables := map[string]interface{}{
		"user_file_id": userFileID,
		"room_id":      roomID,
	}

	var shareResponse struct {
		ShareFileToRoom bool `json:"shareFileToRoom"`
	}

	err = suite.Server.MakeAuthenticatedRequest(ctx, token, shareFileQuery, shareVariables, &shareResponse)
	suite.NoError(err, "File sharing should succeed")

	// Validate response
	suite.AssertGraphQLSuccess(shareResponse)
	suite.True(shareResponse.ShareFileToRoom, "Share file should return true")

	// Query room to verify file was shared
	roomQuery := `
		query Room($id: ID!) {
			room(id: $id) {
				id
				name
				files {
					id
					filename
					user_id
				}
			}
		}
	`

	roomVariables := map[string]interface{}{
		"id": roomID,
	}

	var roomResponse struct {
		Room struct {
			ID    string `json:"id"`
			Name  string `json:"name"`
			Files []struct {
				ID       string `json:"id"`
				Filename string `json:"filename"`
				UserID   string `json:"user_id"`
			} `json:"files"`
		} `json:"room"`
	}

	err = suite.Server.MakeAuthenticatedRequest(ctx, token, roomQuery, roomVariables, &roomResponse)
	suite.NoError(err, "Room query should succeed")

	// Verify file is in room
	suite.Len(roomResponse.Room.Files, 1, "Room should have 1 file")
	suite.Equal(suite.TestData.UserFile1.Filename, roomResponse.Room.Files[0].Filename, "Filename should match")

	// Remove file from room
	removeFileQuery := `
		mutation RemoveFileFromRoom($user_file_id: ID!, $room_id: ID!) {
			removeFileFromRoom(user_file_id: $user_file_id, room_id: $room_id)
		}
	`

	removeVariables := map[string]interface{}{
		"user_file_id": userFileID,
		"room_id":      roomID,
	}

	var removeResponse struct {
		RemoveFileFromRoom bool `json:"removeFileFromRoom"`
	}

	err = suite.Server.MakeAuthenticatedRequest(ctx, token, removeFileQuery, removeVariables, &removeResponse)
	suite.NoError(err, "File removal should succeed")

	// Validate response
	suite.AssertGraphQLSuccess(removeResponse)
	suite.True(removeResponse.RemoveFileFromRoom, "Remove file should return true")

	// Verify file was removed from room
	err = suite.Server.MakeAuthenticatedRequest(ctx, token, roomQuery, roomVariables, &roomResponse)
	suite.NoError(err, "Room query should succeed")
	suite.Len(roomResponse.Room.Files, 0, "Room should have 0 files after removal")
}

// TestRoomQueries tests various room-related queries
func (suite *RoomIntegrationTestSuite) TestRoomQueries() {
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
	suite.NoError(err, "Login should succeed")
	token := loginResponse.Login.Token

	// Query user's rooms
	myRoomsQuery := `
		query MyRooms {
			myRooms {
				id
				name
				creator_id
				members {
					id
					role
				}
			}
		}
	`

	var myRoomsResponse struct {
		MyRooms []struct {
			ID        string `json:"id"`
			Name      string `json:"name"`
			CreatorID string `json:"creator_id"`
			Members   []struct {
				ID   string `json:"id"`
				Role string `json:"role"`
			} `json:"members"`
		} `json:"myRooms"`
	}

	err = suite.Server.MakeAuthenticatedRequest(ctx, token, myRoomsQuery, nil, &myRoomsResponse)
	suite.NoError(err, "My rooms query should succeed")

	// Should include the test room created in SetupTest
	suite.AssertGraphQLSuccess(myRoomsResponse)
	suite.True(len(myRoomsResponse.MyRooms) >= 1, "User should have at least 1 room")

	// Verify test room is included
	found := false
	for _, room := range myRoomsResponse.MyRooms {
		if room.Name == "Test Room" {
			suite.Equal(loginResponse.Login.User.ID, room.CreatorID, "Creator ID should match")
			found = true
			break
		}
	}
	suite.True(found, "Test room should be found in user's rooms")
}

// TestRoomAccessControl tests that users can only access rooms they're members of
func (suite *RoomIntegrationTestSuite) TestRoomAccessControl() {
	ctx := context.Background()

	// Login as a user who is not a member of the test room
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

	// Try to query the test room (which this user is not a member of)
	roomID := fmt.Sprintf("%d", suite.TestData.Room.ID)

	roomQuery := `
		query Room($id: ID!) {
			room(id: $id) {
				id
				name
			}
		}
	`

	roomVariables := map[string]interface{}{
		"id": roomID,
	}

	var roomResponse map[string]interface{}

	err = suite.Server.MakeAuthenticatedRequest(ctx, token, roomQuery, roomVariables, &roomResponse)
	suite.NoError(err, "Request should not fail")

	// Should contain access control error
	suite.AssertGraphQLError(roomResponse, "access")
}

// TestConcurrentRoomOperations tests concurrent room operations
func (suite *RoomIntegrationTestSuite) TestConcurrentRoomOperations() {
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
	suite.NoError(err, "Login should succeed")
	token := loginResponse.Login.Token

	// Create multiple rooms (simulating concurrent operations)
	roomNames := []string{"Concurrent Room 1", "Concurrent Room 2", "Concurrent Room 3"}

	for _, roomName := range roomNames {
		createRoomQuery := `
			mutation CreateRoom($input: CreateRoomInput!) {
				createRoom(input: $input) {
					id
					name
				}
			}
		`

		createVariables := map[string]interface{}{
			"input": map[string]interface{}{
				"name": roomName,
			},
		}

		var createResponse struct {
			CreateRoom struct {
				ID   string `json:"id"`
				Name string `json:"name"`
			} `json:"createRoom"`
		}

		err := suite.Server.MakeAuthenticatedRequest(ctx, token, createRoomQuery, createVariables, &createResponse)
		suite.NoError(err, "Concurrent room creation should succeed")
		suite.AssertGraphQLSuccess(createResponse)
		suite.Equal(roomName, createResponse.CreateRoom.Name, "Room name should match")
	}

	// Verify all rooms were created
	myRoomsQuery := `
		query MyRooms {
			myRooms {
				id
				name
			}
		}
	`

	var myRoomsResponse struct {
		MyRooms []struct {
			ID   string `json:"id"`
			Name string `json:"name"`
		} `json:"myRooms"`
	}

	err = suite.Server.MakeAuthenticatedRequest(ctx, token, myRoomsQuery, nil, &myRoomsResponse)
	suite.NoError(err, "My rooms query should succeed")

	// Should have original room + 3 new rooms
	suite.True(len(myRoomsResponse.MyRooms) >= 4, "User should have at least 4 rooms")
}
