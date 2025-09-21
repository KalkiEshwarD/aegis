package integration

import (
	"fmt"
	"os"
	"path/filepath"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

// TestDBConfig holds configuration for test database
type TestDBConfig struct {
	DBPath string
}

// NewTestDBConfig creates a new test database configuration
// Uses SQLite in-memory database for fast testing
func NewTestDBConfig() *TestDBConfig {
	// Use in-memory SQLite for tests
	return &TestDBConfig{
		DBPath: ":memory:",
	}
}

// NewTestDBConfigWithFile creates a test database configuration with a temporary file
// Useful when you need to inspect the database after tests
func NewTestDBConfigWithFile(testName string) *TestDBConfig {
	// Create a temporary file for the test database
	tmpDir := os.TempDir()
	dbPath := filepath.Join(tmpDir, fmt.Sprintf("aegis_test_%s.db", testName))
	return &TestDBConfig{
		DBPath: dbPath,
	}
}

// SetupTestDB initializes a test database connection
func (c *TestDBConfig) SetupTestDB() (*gorm.DB, error) {
	db, err := gorm.Open(sqlite.Open(c.DBPath), &gorm.Config{})
	if err != nil {
		return nil, fmt.Errorf("failed to connect to test database: %w", err)
	}

	return db, nil
}

// CleanupTestDB cleans up the test database file if it exists
func (c *TestDBConfig) CleanupTestDB() error {
	if c.DBPath != ":memory:" {
		if err := os.Remove(c.DBPath); err != nil && !os.IsNotExist(err) {
			return fmt.Errorf("failed to cleanup test database: %w", err)
		}
	}
	return nil
}
