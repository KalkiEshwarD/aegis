package database

import (
	"fmt"

	"github.com/balkanid/aegis-backend/internal/config"
	"gorm.io/gorm"
)

// DB is the database service.
type DB struct {
	db *gorm.DB
}

// NewDB creates a new database service.
func NewDB(db *gorm.DB) *DB {
	return &DB{db: db}
}

// GetDB returns the database instance.
func (db *DB) GetDB() *gorm.DB {
	return db.db
}

// Global database instance for backward compatibility with tests
var globalDB *DB

// SetDB sets the global database instance
func SetDB(db interface{}) {
	if dbService, ok := db.(*DB); ok {
		globalDB = dbService
	} else if gormDB, ok := db.(*gorm.DB); ok {
		globalDB = &DB{db: gormDB}
	}
}

// GetDB returns the global database instance
func GetDB() *gorm.DB {
	if globalDB == nil {
		return nil
	}
	return globalDB.GetDB()
}

// Connect initializes the global database connection
func Connect(cfg *config.Config) error {
	db := &DB{}
	err := db.Connect(cfg)
	if err != nil {
		return err
	}
	globalDB = db
	return nil
}

// AutoMigrate runs database migrations on the global database
func AutoMigrate() error {
	if globalDB == nil {
		return fmt.Errorf("database connection not initialized")
	}
	return globalDB.AutoMigrate()
}

// Close closes the global database connection
func Close() error {
	if globalDB == nil {
		return nil
	}
	return globalDB.Close()
}
