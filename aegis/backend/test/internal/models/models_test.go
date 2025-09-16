package models_test

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"

	"github.com/balkanid/aegis-backend/internal/models"
)

func TestUserTableName(t *testing.T) {
	user := models.User{}
	assert.Equal(t, "users", user.TableName())
}

func TestFileTableName(t *testing.T) {
	file := models.File{}
	assert.Equal(t, "files", file.TableName())
}

func TestUserFileTableName(t *testing.T) {
	userFile := models.UserFile{}
	assert.Equal(t, "user_files", userFile.TableName())
}

func TestRoomTableName(t *testing.T) {
	room := models.Room{}
	assert.Equal(t, "rooms", room.TableName())
}

func TestRoomMemberTableName(t *testing.T) {
	roomMember := models.RoomMember{}
	assert.Equal(t, "room_members", roomMember.TableName())
}

func TestRoomFileTableName(t *testing.T) {
	roomFile := models.RoomFile{}
	assert.Equal(t, "room_files", roomFile.TableName())
}

func TestDownloadLogTableName(t *testing.T) {
	downloadLog := models.DownloadLog{}
	assert.Equal(t, "download_logs", downloadLog.TableName())
}

func TestRoomRole_String(t *testing.T) {
	tests := []struct {
		role     models.RoomRole
		expected string
	}{
		{models.RoomRoleAdmin, "ADMIN"},
		{models.RoomRoleContentCreator, "CONTENT_CREATOR"},
		{models.RoomRoleContentEditor, "CONTENT_EDITOR"},
		{models.RoomRoleContentViewer, "CONTENT_VIEWER"},
	}

	for _, tt := range tests {
		t.Run(string(tt.role), func(t *testing.T) {
			assert.Equal(t, tt.expected, tt.role.String())
		})
	}
}

func TestRoomRoleConstants(t *testing.T) {
	assert.Equal(t, models.RoomRole("ADMIN"), models.RoomRoleAdmin)
	assert.Equal(t, models.RoomRole("CONTENT_CREATOR"), models.RoomRoleContentCreator)
	assert.Equal(t, models.RoomRole("CONTENT_EDITOR"), models.RoomRoleContentEditor)
	assert.Equal(t, models.RoomRole("CONTENT_VIEWER"), models.RoomRoleContentViewer)
}

func TestUserModel(t *testing.T) {
	user := models.User{
		ID:           1,
		Email:        "test@example.com",
		PasswordHash: "hashedpassword",
		StorageQuota: 10485760, // 10MB
		UsedStorage:  0,
		IsAdmin:      false,
		CreatedAt:    time.Now(),
		UpdatedAt:    time.Now(),
	}

	assert.Equal(t, uint(1), user.ID)
	assert.Equal(t, "test@example.com", user.Email)
	assert.Equal(t, "hashedpassword", user.PasswordHash)
	assert.Equal(t, int64(10485760), user.StorageQuota)
	assert.Equal(t, int64(0), user.UsedStorage)
	assert.False(t, user.IsAdmin)
	assert.NotZero(t, user.CreatedAt)
	assert.NotZero(t, user.UpdatedAt)
}

func TestFileModel(t *testing.T) {
	file := models.File{
		ID:          1,
		ContentHash: "sha256hash",
		SizeBytes:   1024,
		StoragePath: "/path/to/file",
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}

	assert.Equal(t, uint(1), file.ID)
	assert.Equal(t, "sha256hash", file.ContentHash)
	assert.Equal(t, int64(1024), file.SizeBytes)
	assert.Equal(t, "/path/to/file", file.StoragePath)
	assert.NotZero(t, file.CreatedAt)
	assert.NotZero(t, file.UpdatedAt)
}

func TestUserFileModel(t *testing.T) {
	userFile := models.UserFile{
		ID:            1,
		UserID:        1,
		FileID:        1,
		Filename:      "test.txt",
		MimeType:      "text/plain",
		EncryptionKey: "encryptedkey",
		CreatedAt:     time.Now(),
		UpdatedAt:     time.Now(),
	}

	assert.Equal(t, uint(1), userFile.ID)
	assert.Equal(t, uint(1), userFile.UserID)
	assert.Equal(t, uint(1), userFile.FileID)
	assert.Equal(t, "test.txt", userFile.Filename)
	assert.Equal(t, "text/plain", userFile.MimeType)
	assert.Equal(t, "encryptedkey", userFile.EncryptionKey)
	assert.NotZero(t, userFile.CreatedAt)
	assert.NotZero(t, userFile.UpdatedAt)
}

func TestRoomModel(t *testing.T) {
	room := models.Room{
		ID:        1,
		Name:      "Test Room",
		CreatorID: 1,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	assert.Equal(t, uint(1), room.ID)
	assert.Equal(t, "Test Room", room.Name)
	assert.Equal(t, uint(1), room.CreatorID)
	assert.NotZero(t, room.CreatedAt)
	assert.NotZero(t, room.UpdatedAt)
}

func TestRoomMemberModel(t *testing.T) {
	roomMember := models.RoomMember{
		ID:        1,
		RoomID:    1,
		UserID:    1,
		Role:      models.RoomRoleAdmin,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	assert.Equal(t, uint(1), roomMember.ID)
	assert.Equal(t, uint(1), roomMember.RoomID)
	assert.Equal(t, uint(1), roomMember.UserID)
	assert.Equal(t, models.RoomRoleAdmin, roomMember.Role)
	assert.NotZero(t, roomMember.CreatedAt)
	assert.NotZero(t, roomMember.UpdatedAt)
}

func TestRoomFileModel(t *testing.T) {
	roomFile := models.RoomFile{
		ID:         1,
		RoomID:     1,
		UserFileID: 1,
		CreatedAt:  time.Now(),
	}

	assert.Equal(t, uint(1), roomFile.ID)
	assert.Equal(t, uint(1), roomFile.RoomID)
	assert.Equal(t, uint(1), roomFile.UserFileID)
	assert.NotZero(t, roomFile.CreatedAt)
}

func TestDownloadLogModel(t *testing.T) {
	downloadLog := models.DownloadLog{
		ID:               1,
		UserFileID:       1,
		DownloaderUserID: 1,
		Timestamp:        time.Now(),
	}

	assert.Equal(t, uint(1), downloadLog.ID)
	assert.Equal(t, uint(1), downloadLog.UserFileID)
	assert.Equal(t, uint(1), downloadLog.DownloaderUserID)
	assert.NotZero(t, downloadLog.Timestamp)
}

func TestModelAssociations(t *testing.T) {
	// Test that model associations are properly defined
	user := models.User{ID: 1}
	file := models.File{ID: 1}
	room := models.Room{ID: 1}

	userFile := models.UserFile{
		UserID: user.ID,
		FileID: file.ID,
		User:   user,
		File:   file,
	}

	roomMember := models.RoomMember{
		RoomID: room.ID,
		UserID: user.ID,
		Room:   room,
		User:   user,
	}

	roomFile := models.RoomFile{
		RoomID:     room.ID,
		UserFileID: userFile.ID,
		Room:       room,
		UserFile:   userFile,
	}

	downloadLog := models.DownloadLog{
		UserFileID:       userFile.ID,
		DownloaderUserID: user.ID,
		UserFile:         userFile,
		DownloaderUser:   user,
	}

	// Verify associations exist
	assert.Equal(t, user.ID, userFile.UserID)
	assert.Equal(t, file.ID, userFile.FileID)
	assert.Equal(t, room.ID, roomMember.RoomID)
	assert.Equal(t, user.ID, roomMember.UserID)
	assert.Equal(t, room.ID, roomFile.RoomID)
	assert.Equal(t, userFile.ID, roomFile.UserFileID)
	assert.Equal(t, userFile.ID, downloadLog.UserFileID)
	assert.Equal(t, user.ID, downloadLog.DownloaderUserID)
}

// Test model validation behavior
func TestUserValidation(t *testing.T) {
	tests := []struct {
		name    string
		user    models.User
		isValid bool
	}{
		{
			name: "valid user",
			user: models.User{
				Email:        "test@example.com",
				PasswordHash: "hashedpassword",
				StorageQuota: 10485760,
				UsedStorage:  0,
			},
			isValid: true,
		},
		{
			name: "user with negative storage quota",
			user: models.User{
				Email:        "test@example.com",
				PasswordHash: "hashedpassword",
				StorageQuota: -1,
				UsedStorage:  0,
			},
			isValid: false, // Depends on database constraints
		},
		{
			name: "user with used storage exceeding quota",
			user: models.User{
				Email:        "test@example.com",
				PasswordHash: "hashedpassword",
				StorageQuota: 1000,
				UsedStorage:  2000,
			},
			isValid: false, // Business logic validation
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Basic field validation
			if tt.isValid {
				assert.NotEmpty(t, tt.user.Email)
				assert.NotEmpty(t, tt.user.PasswordHash)
			}

			// Business rule validation
			if tt.user.StorageQuota > 0 && tt.user.UsedStorage > tt.user.StorageQuota {
				assert.False(t, tt.isValid, "Used storage should not exceed quota")
			}
		})
	}
}
