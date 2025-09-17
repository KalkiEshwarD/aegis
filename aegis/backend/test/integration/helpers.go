package integration

import (
	"fmt"
	"strings"

	"github.com/balkanid/aegis-backend/internal/database"
	"gorm.io/gorm"
)

// SetupTestDatabase initializes the test database with schema
func SetupTestDatabase(db *gorm.DB) error {
	// Set the test database globally for services to use
	database.SetDB(db)

	// Run auto-migration for models using the global database function
	if err := database.AutoMigrate(); err != nil {
		return fmt.Errorf("failed to migrate test database: %w", err)
	}

	return nil
}

// TeardownTestDatabase cleans up the test database
func TeardownTestDatabase(db *gorm.DB) error {
	// Get underlying SQL DB
	sqlDB, err := db.DB()
	if err != nil {
		return fmt.Errorf("failed to get SQL DB: %w", err)
	}

	// Close the connection
	if err := sqlDB.Close(); err != nil {
		return fmt.Errorf("failed to close test database: %w", err)
	}

	return nil
}

// ClearTestData clears all data from test tables
func ClearTestData(db *gorm.DB) error {
	tables := []string{
		"download_logs",
		"room_files",
		"room_members",
		"rooms",
		"user_files",
		"files",
		"users",
	}

	for _, table := range tables {
		if err := db.Exec(fmt.Sprintf("DELETE FROM %s", table)).Error; err != nil {
			return fmt.Errorf("failed to clear table %s: %w", table, err)
		}
	}

	return nil
}

// ResetTestDatabase clears all data and resets auto-increment counters
func ResetTestDatabase(db *gorm.DB) error {
	if err := ClearTestData(db); err != nil {
		return err
	}

	// Reset SQLite auto-increment counters
	tables := []string{"users", "files", "user_files", "rooms", "room_members", "room_files", "download_logs"}
	for _, table := range tables {
		if err := db.Exec(fmt.Sprintf("DELETE FROM sqlite_sequence WHERE name='%s'", table)).Error; err != nil {
			// Ignore error if table doesn't exist in sequence
			if !strings.Contains(err.Error(), "no such table") {
				return fmt.Errorf("failed to reset sequence for %s: %w", table, err)
			}
		}
	}

	return nil
}

// ExecuteSQLFile executes SQL commands from a file on the test database
func ExecuteSQLFile(db *gorm.DB, sqlContent string) error {
	sqlDB, err := db.DB()
	if err != nil {
		return fmt.Errorf("failed to get SQL DB: %w", err)
	}

	// Split SQL content by semicolon and execute each statement
	statements := strings.Split(sqlContent, ";")
	for _, stmt := range statements {
		stmt = strings.TrimSpace(stmt)
		if stmt == "" {
			continue
		}

		if _, err := sqlDB.Exec(stmt); err != nil {
			return fmt.Errorf("failed to execute SQL: %s, error: %w", stmt, err)
		}
	}

	return nil
}

// ConvertPostgresToSQLite converts PostgreSQL-specific SQL to SQLite-compatible SQL
func ConvertPostgresToSQLite(postgresSQL string) string {
	sqliteSQL := postgresSQL

	// Replace PostgreSQL-specific syntax
	replacements := map[string]string{
		"SERIAL PRIMARY KEY":                    "INTEGER PRIMARY KEY AUTOINCREMENT",
		"TIMESTAMP WITH TIME ZONE":              "DATETIME",
		"TIMESTAMP WITH TIME ZONE DEFAULT NOW()": "DATETIME DEFAULT CURRENT_TIMESTAMP",
		"NOW()":                                 "CURRENT_TIMESTAMP",
		"BOOLEAN":                               "INTEGER", // SQLite uses INTEGER for boolean
		"BIGINT":                                "INTEGER",
		"TRUE":                                  "1",
		"FALSE":                                 "0",
		"ON CONFLICT":                           "ON CONFLICT", // Keep as is, SQLite supports this
	}

	for pg, sqlite := range replacements {
		sqliteSQL = strings.ReplaceAll(sqliteSQL, pg, sqlite)
	}

	// Remove PostgreSQL-specific constructs that don't apply to SQLite
	sqliteSQL = removePostgresSpecific(sqliteSQL)

	return sqliteSQL
}

// removePostgresSpecific removes PostgreSQL-specific constructs
func removePostgresSpecific(sql string) string {
	lines := strings.Split(sql, "\n")
	var filtered []string

	for _, line := range lines {
		// Skip PostgreSQL-specific lines
		if strings.Contains(line, "language 'plpgsql'") ||
		   strings.Contains(line, "CREATE OR REPLACE FUNCTION") ||
		   strings.Contains(line, "CREATE TRIGGER") ||
		   strings.Contains(line, "EXECUTE FUNCTION") {
			continue
		}
		filtered = append(filtered, line)
	}

	return strings.Join(filtered, "\n")
}