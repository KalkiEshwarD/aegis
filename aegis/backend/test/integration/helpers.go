package integration

import (
	"fmt"
	"os"
	"strings"

	"github.com/balkanid/aegis-backend/internal/database"
	"gorm.io/gorm"
)

// SetupTestDatabase initializes the test database with schema
func SetupTestDatabase(db *gorm.DB) error {
	// Set the test database globally for services to use
	database.SetDB(db)

	// Read and execute migration files
	migrationFiles := []string{
		"../../migrations/001_initial_schema.sql",
		"../../migrations/002_add_user_file_unique_constraint.sql",
		"../../migrations/003_remove_content_hash_unique_constraint.sql",
		"../../migrations/004_add_folders.sql",
		"../../migrations/005_add_username_to_users.sql",
		"../../migrations/006_add_file_shares.sql",
		"../../migrations/007_add_shared_with_me.sql",
		"../../migrations/008_add_starring_and_envelope_keys.sql",
		"../../migrations/009_add_is_starred_to_folders.sql",
		"../../migrations/010_add_allowed_usernames_to_file_shares.sql",
		"../../migrations/011_add_plain_text_password_to_file_shares.sql",
		"../../migrations/012_add_encrypted_password_fields.sql",
	}

	for _, file := range migrationFiles {
		content, err := os.ReadFile(file)
		if err != nil {
			// Skip if file doesn't exist
			continue
		}

		// Convert PostgreSQL SQL to SQLite
		sqliteSQL := ConvertPostgresToSQLite(string(content))

		// Execute the converted SQL
		if err := ExecuteSQLFile(db, sqliteSQL); err != nil {
			return fmt.Errorf("failed to execute migration %s: %w", file, err)
		}
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
		"SERIAL PRIMARY KEY":                     "INTEGER PRIMARY KEY AUTOINCREMENT",
		"TIMESTAMP WITH TIME ZONE":               "DATETIME",
		"TIMESTAMP WITH TIME ZONE DEFAULT NOW()": "DATETIME DEFAULT CURRENT_TIMESTAMP",
		"NOW()":                                  "CURRENT_TIMESTAMP",
		"BOOLEAN":                                "INTEGER", // SQLite uses INTEGER for boolean
		"BIGINT":                                 "INTEGER",
		"TRUE":                                   "1",
		"FALSE":                                  "0",
		"ON CONFLICT":                            "ON CONFLICT",                             // Keep as is, SQLite supports this
		"SPLIT_PART(email, '@', 1)":              "SUBSTR(email, 1, INSTR(email, '@') - 1)", // Convert PostgreSQL SPLIT_PART to SQLite SUBSTR
		"ADD COLUMN IF NOT EXISTS":               "ADD COLUMN",                              // SQLite doesn't support IF NOT EXISTS with ADD COLUMN
	}

	for pg, sqlite := range replacements {
		sqliteSQL = strings.ReplaceAll(sqliteSQL, pg, sqlite)
	}

	// Handle PostgreSQL DISTINCT ON - convert to a different approach
	// Replace DISTINCT ON pattern with a more complex SQLite-compatible query
	if strings.Contains(sqliteSQL, "DISTINCT ON") {
		sqliteSQL = convertDistinctOn(sqliteSQL)
	}

	// Handle ALTER TABLE ADD CONSTRAINT - SQLite doesn't support named constraints
	if strings.Contains(sqliteSQL, "ADD CONSTRAINT") {
		sqliteSQL = convertAddConstraint(sqliteSQL)
	}

	// Handle ALTER TABLE DROP CONSTRAINT - SQLite doesn't support this
	if strings.Contains(sqliteSQL, "DROP CONSTRAINT") {
		sqliteSQL = convertDropConstraint(sqliteSQL)
	}

	// Handle ALTER TABLE ADD COLUMN with UNIQUE constraint - SQLite doesn't support this
	if strings.Contains(sqliteSQL, "ADD COLUMN") && strings.Contains(sqliteSQL, "UNIQUE") {
		sqliteSQL = convertAddUniqueColumn(sqliteSQL)
	}

	// Handle ALTER COLUMN - SQLite doesn't support this
	if strings.Contains(sqliteSQL, "ALTER COLUMN") {
		sqliteSQL = convertAlterColumn(sqliteSQL)
	}

	// Remove PostgreSQL-specific constructs that don't apply to SQLite
	sqliteSQL = removePostgresSpecific(sqliteSQL)

	return sqliteSQL
}

// convertDistinctOn converts PostgreSQL DISTINCT ON queries to SQLite-compatible syntax
func convertDistinctOn(sql string) string {
	// This is a simple conversion for the specific case in the migration
	// For the DELETE statement with DISTINCT ON (user_id, file_id)
	if strings.Contains(sql, "SELECT DISTINCT ON (user_id, file_id) id") {
		return strings.ReplaceAll(sql,
			`DELETE FROM user_files
WHERE id NOT IN (
    SELECT DISTINCT ON (user_id, file_id) id
    FROM user_files
    ORDER BY user_id, file_id, created_at DESC
);`,
			`DELETE FROM user_files 
WHERE id NOT IN (
    SELECT MIN(id) 
    FROM user_files 
    GROUP BY user_id, file_id
);`)
	}
	return sql
}

// convertAddConstraint converts PostgreSQL ADD CONSTRAINT to SQLite-compatible syntax
func convertAddConstraint(sql string) string {
	// SQLite doesn't support ADD CONSTRAINT, so we convert to CREATE UNIQUE INDEX

	// Handle the specific case from migration 002
	if strings.Contains(sql, "ADD CONSTRAINT unique_user_file") {
		sql = strings.ReplaceAll(sql,
			`ALTER TABLE user_files
ADD CONSTRAINT unique_user_file
UNIQUE (user_id, file_id);`,
			`CREATE UNIQUE INDEX IF NOT EXISTS unique_user_file ON user_files (user_id, file_id);`)
	}

	// Handle the specific case from migration 003
	if strings.Contains(sql, "ADD CONSTRAINT user_files_user_content_unique") {
		sql = strings.ReplaceAll(sql,
			`ALTER TABLE user_files ADD CONSTRAINT user_files_user_content_unique 
    UNIQUE (user_id, file_id);`,
			`CREATE UNIQUE INDEX IF NOT EXISTS user_files_user_content_unique ON user_files (user_id, file_id);`)
	}

	return sql
}

// convertDropConstraint converts PostgreSQL DROP CONSTRAINT to SQLite-compatible syntax
func convertDropConstraint(sql string) string {
	// SQLite doesn't support DROP CONSTRAINT, so we convert to DROP INDEX
	if strings.Contains(sql, "DROP CONSTRAINT IF EXISTS files_content_hash_key") {
		return strings.ReplaceAll(sql,
			`ALTER TABLE files DROP CONSTRAINT IF EXISTS files_content_hash_key;`,
			`DROP INDEX IF EXISTS files_content_hash_key;`)
	}
	return sql
}

// convertAddUniqueColumn converts PostgreSQL ADD COLUMN with UNIQUE to SQLite-compatible syntax
func convertAddUniqueColumn(sql string) string {
	// SQLite can't add a UNIQUE column with a default value
	// We need to split this into ADD COLUMN and CREATE UNIQUE INDEX
	if strings.Contains(sql, "ADD COLUMN username VARCHAR(255) UNIQUE NOT NULL DEFAULT ''") {
		return strings.ReplaceAll(sql,
			`ALTER TABLE users ADD COLUMN username VARCHAR(255) UNIQUE NOT NULL DEFAULT '';`,
			`ALTER TABLE users ADD COLUMN username VARCHAR(255) NOT NULL DEFAULT '';
CREATE UNIQUE INDEX IF NOT EXISTS users_username_unique ON users(username);`)
	}
	return sql
}

// convertAlterColumn converts PostgreSQL ALTER COLUMN to SQLite-compatible syntax
func convertAlterColumn(sql string) string {
	// SQLite doesn't support ALTER COLUMN operations
	// For DROP DEFAULT, we can just skip it since it's mainly a schema constraint
	if strings.Contains(sql, "ALTER COLUMN username DROP DEFAULT") {
		return strings.ReplaceAll(sql,
			`ALTER TABLE users ALTER COLUMN username DROP DEFAULT;`,
			`-- SQLite doesn't support ALTER COLUMN, skipping DROP DEFAULT operation`)
	}

	if strings.Contains(sql, "ALTER COLUMN username SET NOT NULL") {
		return strings.ReplaceAll(sql,
			`ALTER TABLE users ALTER COLUMN username SET NOT NULL;`,
			`-- SQLite doesn't support ALTER COLUMN, skipping SET NOT NULL operation`)
	}

	return sql
}

// removePostgresSpecific removes PostgreSQL-specific constructs
func removePostgresSpecific(sql string) string {
	result := ""

	// Use a state machine to track where we are in the SQL
	inFunction := false
	dollarCount := 0

	lines := strings.Split(sql, "\n")

	for _, line := range lines {
		trimmed := strings.TrimSpace(line)

		// Skip PostgreSQL-specific lines
		if strings.Contains(line, "LANGUAGE plpgsql") ||
			strings.Contains(line, "language 'plpgsql'") ||
			strings.Contains(line, "CREATE TRIGGER") ||
			strings.Contains(line, "EXECUTE FUNCTION") ||
			strings.Contains(line, "USING GIN") { // Skip GIN indexes
			continue
		}

		// Start of function definition
		if strings.Contains(trimmed, "CREATE OR REPLACE FUNCTION") {
			inFunction = true
			continue
		}

		// If we're in a function, track $$ delimiters
		if inFunction {
			// Count $$ occurrences
			dollarCount += strings.Count(line, "$$")

			// Second $$ ends the function
			if dollarCount >= 2 && strings.Contains(line, "$$") {
				// End of function
				inFunction = false
				dollarCount = 0
				continue
			}

			// Skip everything inside function
			continue
		}

		// Add non-function lines to result
		result += line + "\n"
	}

	return result
}
