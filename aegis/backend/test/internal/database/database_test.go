package database_test

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"

	"github.com/balkanid/aegis-backend/internal/config"
	"github.com/balkanid/aegis-backend/internal/database"
	"github.com/balkanid/aegis-backend/internal/models"
)

func TestConnect(t *testing.T) {
	// This test would require a real PostgreSQL connection
	// For unit tests, we'll test the function behavior with invalid configs
	cfg := &config.Config{
		DatabaseURL: "invalid://connection/string",
		GinMode:     "debug",
	}

	err := database.Connect(cfg)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "failed to connect to database")
}

func TestGetDB_WhenNotConnected(t *testing.T) {
	// When no connection has been established
	db := database.GetDB()
	// This might be nil or the previous connection, depending on test order
	// In a real scenario, this would be properly handled
	_ = db // Just verify the function doesn't panic
}

func TestAutoMigrate_WithoutConnection(t *testing.T) {
	// Save current DB state
	currentDB := database.GetDB()

	// Temporarily set DB to nil to test error handling
	database.SetDB(nil)

	err := database.AutoMigrate()
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "database connection not initialized")

	// Restore DB state
	database.SetDB(currentDB)
}

func TestAutoMigrate_WithValidConnection(t *testing.T) {
	// Create in-memory SQLite database for testing
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)

	// Save current DB state
	originalDB := database.GetDB()

	// Set test DB
	database.SetDB(db)

	// Test migration
	err = database.AutoMigrate()
	assert.NoError(t, err)

	// Verify tables were created by checking if we can create records
	user := models.User{
		Email:        "test@example.com",
		PasswordHash: "hash",
		StorageQuota: 1024,
		UsedStorage:  0,
		IsAdmin:      false,
	}
	err = db.Create(&user).Error
	assert.NoError(t, err)
	assert.NotZero(t, user.ID)

	// Restore original DB
	database.SetDB(originalDB)

	// Close test DB
	sqlDB, _ := db.DB()
	sqlDB.Close()
}

func TestClose_WithoutConnection(t *testing.T) {
	// Save current DB state
	originalDB := database.GetDB()

	// Set DB to nil
	database.SetDB(nil)

	err := database.Close()
	assert.NoError(t, err) // Should not error when DB is nil

	// Restore original DB
	database.SetDB(originalDB)
}

func TestClose_WithValidConnection(t *testing.T) {
	// Create in-memory SQLite database for testing
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)

	// Save current DB state
	originalDB := database.GetDB()

	// Set test DB
	database.SetDB(db)

	// Test close
	err = database.Close()
	assert.NoError(t, err)

	// Restore original DB (even though it might be closed)
	database.SetDB(originalDB)
}

func TestDatabaseLifecycle(t *testing.T) {
	// Test the complete lifecycle with SQLite
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)

	// Save current state
	originalDB := database.GetDB()

	// Set test DB
	database.SetDB(db)

	// Test GetDB
	retrievedDB := database.GetDB()
	assert.Equal(t, db, retrievedDB)

	// Test migration
	err = database.AutoMigrate()
	assert.NoError(t, err)

	// Test that we can perform database operations
	user := models.User{
		Email:        "lifecycle@example.com",
		PasswordHash: "hash",
		StorageQuota: 2048,
		UsedStorage:  512,
		IsAdmin:      true,
	}
	err = db.Create(&user).Error
	assert.NoError(t, err)

	// Verify user was created
	var count int64
	db.Model(&models.User{}).Count(&count)
	assert.Equal(t, int64(1), count)

	// Test close
	err = database.Close()
	assert.NoError(t, err)

	// Restore original state
	database.SetDB(originalDB)
}

// Test configuration impact on connection
func TestConnect_WithDifferentModes(t *testing.T) {
	tests := []struct {
		name    string
		ginMode string
	}{
		{"debug mode", "debug"},
		{"release mode", "release"},
		{"test mode", "test"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			cfg := &config.Config{
				DatabaseURL: "invalid://connection/string",
				GinMode:     tt.ginMode,
			}

			// This will fail due to invalid connection string,
			// but it tests that different modes don't cause panics
			err := database.Connect(cfg)
			assert.Error(t, err)
		})
	}
}
