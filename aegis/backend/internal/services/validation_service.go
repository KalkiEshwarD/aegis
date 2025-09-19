package services

import (
	apperrors "github.com/balkanid/aegis-backend/internal/errors"

	"github.com/balkanid/aegis-backend/internal/database"
)

type ValidationService struct{
	*BaseService
}

func NewValidationService(db *database.DB) *ValidationService {
	return &ValidationService{BaseService: NewBaseService(db)}
}

// CheckDuplicateName checks for duplicate names in the specified table and field
// for a given user, optionally within a parent container (folder for files, parent folder for folders)
// excludeID can be used to exclude a specific record (useful for rename operations)
func (vs *ValidationService) CheckDuplicateName(tableName, fieldName, parentFieldName string, userID uint, name string, parentID *uint, excludeID *uint) error {
	db := vs.db.GetDB()

	// Build the query dynamically
	query := db.Table(tableName).Where(fieldName+" = ? AND user_id = ?", name, userID)

	// Add parent condition if provided
	if parentID != nil {
		query = query.Where(parentFieldName+" = ?", *parentID)
	} else {
		query = query.Where(parentFieldName+" IS NULL")
	}

	// Exclude specific ID if provided (for rename operations)
	if excludeID != nil {
		query = query.Where("id != ?", *excludeID)
	}

	var count int64
	if err := query.Count(&count).Error; err != nil {
		return apperrors.Wrap(err, apperrors.ErrCodeInternal, "database error")
	}

	if count > 0 {
		return apperrors.New(apperrors.ErrCodeConflict, fieldName+" with this name already exists in the specified location")
	}

	return nil
}