package services

import (
	"errors"

	apperrors "github.com/balkanid/aegis-backend/internal/errors"
	"gorm.io/gorm"

	"github.com/balkanid/aegis-backend/internal/database"
)

type BaseService struct {
	db *database.DB
}

func NewBaseService(db *database.DB) *BaseService {
	return &BaseService{db: db}
}

// ValidateOwnership performs a standard ownership check query for models with id and user_id fields
func (bs *BaseService) ValidateOwnership(model interface{}, id, userID uint) error {
	db := bs.db.GetDB()

	if err := db.Where("id = ? AND user_id = ?", id, userID).First(model).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return apperrors.New(apperrors.ErrCodeNotFound, "not found or access denied")
		}
		return apperrors.Wrap(err, apperrors.ErrCodeInternal, "database error")
	}

	return nil
}