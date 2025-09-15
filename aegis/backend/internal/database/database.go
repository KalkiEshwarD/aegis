package database

import (
	"fmt"
	"log"

	"github.com/balkanid/aegis-backend/internal/config"
	"github.com/balkanid/aegis-backend/internal/models"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

var DB *gorm.DB

// Connect initializes the database connection
func Connect(cfg *config.Config) error {
	var err error

	// Configure GORM logger
	logLevel := logger.Silent
	if cfg.GinMode == "debug" {
		logLevel = logger.Info
	}

	DB, err = gorm.Open(postgres.Open(cfg.DatabaseURL), &gorm.Config{
		Logger: logger.Default.LogMode(logLevel),
	})
	if err != nil {
		return fmt.Errorf("failed to connect to database: %w", err)
	}

	log.Println("Successfully connected to database")
	return nil
}

// AutoMigrate runs database migrations
func AutoMigrate() error {
	if DB == nil {
		return fmt.Errorf("database connection not initialized")
	}

	err := DB.AutoMigrate(
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

// GetDB returns the database instance
func GetDB() *gorm.DB {
	return DB
}

// Close closes the database connection
func Close() error {
	if DB == nil {
		return nil
	}

	sqlDB, err := DB.DB()
	if err != nil {
		return err
	}

	return sqlDB.Close()
}
