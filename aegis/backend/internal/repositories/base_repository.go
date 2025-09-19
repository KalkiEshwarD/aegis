package repositories

import (
	"errors"

	apperrors "github.com/balkanid/aegis-backend/internal/errors"
	"gorm.io/gorm"

	"github.com/balkanid/aegis-backend/internal/database"
)

// BaseRepository provides common database operations
type BaseRepository struct {
	db *database.DB
}

// NewBaseRepository creates a new base repository
func NewBaseRepository(db *database.DB) *BaseRepository {
	return &BaseRepository{db: db}
}

// ValidateOwnership performs a standard ownership check query for models with id and user_id fields
func (br *BaseRepository) ValidateOwnership(model interface{}, id, userID uint) error {
	db := br.db.GetDB()

	if err := db.Where("id = ? AND user_id = ?", id, userID).First(model).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return apperrors.New(apperrors.ErrCodeNotFound, "not found or access denied")
		}
		return apperrors.Wrap(err, apperrors.ErrCodeInternal, "database error")
	}

	return nil
}

// GetDB returns the database instance
func (br *BaseRepository) GetDB() *gorm.DB {
	return br.db.GetDB()
}