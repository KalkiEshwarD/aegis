package database

import (
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
