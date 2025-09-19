package database

import (
	"fmt"
	"log"
	"strings"

	"github.com/balkanid/aegis-backend/internal/config"
	"github.com/balkanid/aegis-backend/internal/models"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

// Connect initializes the database connection
func (db *DB) Connect(cfg *config.Config) error {
	var err error

	// Configure GORM logger
	logLevel := logger.Silent
	if cfg.GinMode == "debug" {
		logLevel = logger.Info
	}

	// Modify database URL to disable PostgreSQL plan caching
	// Add parameters to prevent "cached plan must not change result type" errors
	dbURL := cfg.DatabaseURL
	if !strings.Contains(dbURL, "plan_cache_mode=") {
		if strings.Contains(dbURL, "?") {
			dbURL += "&plan_cache_mode=force_custom_plan"
		} else {
			dbURL += "?plan_cache_mode=force_custom_plan"
		}
	}

	db.db, err = gorm.Open(postgres.Open(dbURL), &gorm.Config{
		Logger:      logger.Default.LogMode(logLevel),
		PrepareStmt: false, // Disable prepared statements to avoid cached plan issues
	})
	if err != nil {
		return fmt.Errorf("failed to connect to database: %w", err)
	}

	log.Println("Successfully connected to database")

	// Run migrations (optional, since schema is created via SQL)
	// Comment out to avoid GORM compatibility issues
	// if err := AutoMigrate(); err != nil {
	// 	log.Printf("Warning: Failed to run migrations: %v", err)
	// }

	return nil
}

// AutoMigrate runs database migrations
func (db *DB) AutoMigrate() error {
	if db.db == nil {
		return fmt.Errorf("database connection not initialized")
	}

	err := db.db.AutoMigrate(
		&models.User{},
		&models.File{},
		&models.UserFile{},
		&models.Room{},
		&models.RoomMember{},
		&models.RoomFile{},
		&models.DownloadLog{},
	)
	if err != nil {
		return fmt.Errorf("failed to auto-migrate database: %w", err)
	}

	log.Println("Successfully ran database migrations")
	return nil
}

// Close closes the database connection
func (db *DB) Close() error {
	if db.db == nil {
		return nil
	}

	sqlDB, err := db.db.DB()
	if err != nil {
		return err
	}

	return sqlDB.Close()
}
