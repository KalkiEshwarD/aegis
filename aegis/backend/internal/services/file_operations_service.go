package services

import (
	apperrors "github.com/balkanid/aegis-backend/internal/errors"

	"github.com/balkanid/aegis-backend/internal/database"
	"github.com/balkanid/aegis-backend/internal/models"
)

type FileOperationsService struct{
	*BaseService
}

func NewFileOperationsService(db *database.DB) *FileOperationsService {
	return &FileOperationsService{BaseService: NewBaseService(db)}
}

// MoveFile moves a file to a different folder
func (fos *FileOperationsService) MoveFile(userID, fileID uint, newFolderID *uint) error {
	db := fos.db.GetDB()

	// Get the file to check ownership
	var userFile models.UserFile
	if err := fos.ValidateOwnership(&userFile, fileID, userID); err != nil {
		return err
	}

	// Validate new folder ownership if provided
	if newFolderID != nil {
		var newFolder models.Folder
		if err := fos.ValidateOwnership(&newFolder, *newFolderID, userID); err != nil {
			return err
		}
	}

	// Update the folder_id
	if err := db.Model(&userFile).Update("folder_id", newFolderID).Error; err != nil {
		return apperrors.Wrap(err, apperrors.ErrCodeInternal, "failed to move file")
	}

	return nil
}