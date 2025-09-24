package services

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"time"

	"github.com/balkanid/aegis-backend/internal/database"
	"github.com/balkanid/aegis-backend/internal/models"
	apperrors "github.com/balkanid/aegis-backend/internal/errors"
	"gorm.io/gorm"
)

// KeyRotationService handles envelope key rotation operations
type KeyRotationService struct {
	*BaseService
	cryptoManager *CryptoManager
}

// KeyRotationStatus represents the status of a key rotation operation
type KeyRotationStatus string

const (
	KeyRotationStatusPending    KeyRotationStatus = "PENDING"
	KeyRotationStatusInProgress KeyRotationStatus = "IN_PROGRESS"
	KeyRotationStatusCompleted  KeyRotationStatus = "COMPLETED"
	KeyRotationStatusFailed     KeyRotationStatus = "FAILED"
	KeyRotationStatusRolledBack KeyRotationStatus = "ROLLED_BACK"
)

// KeyRotationResult represents the result of a key rotation operation
type KeyRotationResult struct {
	RotationID         string             `json:"rotation_id"`
	Status             KeyRotationStatus  `json:"status"`
	TotalFilesAffected int                `json:"total_files_affected"`
	FilesProcessed     int                `json:"files_processed"`
	ErrorMessage       string             `json:"error_message,omitempty"`
}

// NewKeyRotationService creates a new key rotation service
func NewKeyRotationService(db *database.DB, cryptoManager *CryptoManager) *KeyRotationService {
	return &KeyRotationService{
		BaseService:   NewBaseService(db),
		cryptoManager: cryptoManager,
	}
}

// generateRotationID generates a unique rotation ID
func (s *KeyRotationService) generateRotationID() (string, error) {
	bytes := make([]byte, 32)
	if _, err := rand.Read(bytes); err != nil {
		return "", fmt.Errorf("failed to generate rotation ID: %w", err)
	}
	return hex.EncodeToString(bytes), nil
}

// RotateEnvelopeKey initiates envelope key rotation for a user
func (s *KeyRotationService) RotateEnvelopeKey(userID uint) (*KeyRotationResult, error) {
	db := s.GetDB().GetDB()

	// Check if there's already an active rotation for this user
	var existingRotation models.KeyRotation
	err := db.Where("user_id = ? AND status IN (?, ?)",
		userID, KeyRotationStatusPending, KeyRotationStatusInProgress).First(&existingRotation).Error
	if err == nil {
		return nil, apperrors.New(apperrors.ErrCodeConflict, "active key rotation already exists for this user")
	} else if err != gorm.ErrRecordNotFound {
		return nil, apperrors.Wrap(err, apperrors.ErrCodeInternal, "failed to check existing rotations")
	}

	// Get user information
	var user models.User
	if err := db.First(&user, userID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, apperrors.New(apperrors.ErrCodeNotFound, "user not found")
		}
		return nil, apperrors.Wrap(err, apperrors.ErrCodeInternal, "failed to get user")
	}

	// Count total files that need rotation
	var totalFiles int64
	if err := db.Model(&models.UserFile{}).Where("user_id = ?", userID).Count(&totalFiles).Error; err != nil {
		return nil, apperrors.Wrap(err, apperrors.ErrCodeInternal, "failed to count user files")
	}

	// Generate rotation ID
	rotationID, err := s.generateRotationID()
	if err != nil {
		return nil, apperrors.Wrap(err, apperrors.ErrCodeInternal, "failed to generate rotation ID")
	}

	// Create rotation record
	rotation := models.KeyRotation{
		UserID:               userID,
		RotationID:           rotationID,
		Status:               string(KeyRotationStatusPending),
		OldEnvelopeKeyVersion: user.EnvelopeKeyVersion,
		NewEnvelopeKeyVersion: user.EnvelopeKeyVersion + 1,
		TotalFilesAffected:   int(totalFiles),
		FilesProcessed:       0,
		StartedAt:            time.Now(),
	}

	if err := db.Create(&rotation).Error; err != nil {
		return nil, apperrors.Wrap(err, apperrors.ErrCodeInternal, "failed to create rotation record")
	}

	// Start the rotation process asynchronously
	go s.performKeyRotation(rotationID)

	return &KeyRotationResult{
		RotationID:         rotationID,
		Status:             KeyRotationStatusPending,
		TotalFilesAffected: int(totalFiles),
		FilesProcessed:     0,
	}, nil
}

// performKeyRotation performs the actual key rotation in the background
func (s *KeyRotationService) performKeyRotation(rotationID string) {
	db := s.GetDB().GetDB()

	// Update status to in progress
	if err := db.Model(&models.KeyRotation{}).Where("rotation_id = ?", rotationID).
		Updates(map[string]interface{}{
			"status": string(KeyRotationStatusInProgress),
		}).Error; err != nil {
		s.failRotation(rotationID, fmt.Sprintf("failed to update status: %v", err))
		return
	}

	// Get rotation details
	var rotation models.KeyRotation
	if err := db.Where("rotation_id = ?", rotationID).First(&rotation).Error; err != nil {
		s.failRotation(rotationID, fmt.Sprintf("failed to get rotation: %v", err))
		return
	}

	// Get user
	var user models.User
	if err := db.First(&user, rotation.UserID).Error; err != nil {
		s.failRotation(rotationID, fmt.Sprintf("failed to get user: %v", err))
		return
	}

	// Generate new envelope key
	newEnvelopeKey, err := s.cryptoManager.GenerateEnvelopeKey()
	if err != nil {
		s.failRotation(rotationID, fmt.Sprintf("failed to generate new envelope key: %v", err))
		return
	}

	// Encrypt the new envelope key (using a service key or user password - for now using service key)
	// TODO: In production, this should be encrypted with user's password or a derived key
	newEnvelopeKeyHex := s.cryptoManager.EncodeToHex(newEnvelopeKey)
	saltHex := s.cryptoManager.EncodeToHex([]byte("service_salt")) // TODO: Generate proper salt
	ivHex := s.cryptoManager.EncodeToHex([]byte("service_iv"))     // TODO: Generate proper IV

	// Update user's envelope key
	if err := db.Model(&user).Updates(map[string]interface{}{
		"envelope_key":            newEnvelopeKeyHex,
		"envelope_key_version":    rotation.NewEnvelopeKeyVersion,
		"envelope_key_salt":       saltHex,
		"envelope_key_iv":         ivHex,
		"envelope_key_updated_at": time.Now(),
	}).Error; err != nil {
		s.failRotation(rotationID, fmt.Sprintf("failed to update user envelope key: %v", err))
		return
	}

	// Process files in batches
	batchSize := 10 // Configurable batch size
	offset := 0

	for {
		var userFiles []models.UserFile
		if err := db.Where("user_id = ?", user.ID).
			Offset(offset).Limit(batchSize).Find(&userFiles).Error; err != nil {
			s.failRotation(rotationID, fmt.Sprintf("failed to get user files batch: %v", err))
			return
		}

		if len(userFiles) == 0 {
			break // No more files
		}

		// Process each file in the batch
		for _, userFile := range userFiles {
			if err := s.rotateFileKey(&userFile, newEnvelopeKey, rotationID, db); err != nil {
				s.failRotation(rotationID, fmt.Sprintf("failed to rotate file key for file %d: %v", userFile.ID, err))
				return
			}
		}

		offset += batchSize

		// Update progress
		if err := db.Model(&models.KeyRotation{}).Where("rotation_id = ?", rotationID).
			Update("files_processed", offset).Error; err != nil {
			s.failRotation(rotationID, fmt.Sprintf("failed to update progress: %v", err))
			return
		}
	}

	// Mark rotation as completed
	if err := db.Model(&models.KeyRotation{}).Where("rotation_id = ?", rotationID).
		Updates(map[string]interface{}{
			"status":       string(KeyRotationStatusCompleted),
			"completed_at": time.Now(),
		}).Error; err != nil {
		s.failRotation(rotationID, fmt.Sprintf("failed to mark rotation as completed: %v", err))
		return
	}
}

// rotateFileKey rotates the encryption key for a single file
func (s *KeyRotationService) rotateFileKey(userFile *models.UserFile, newEnvelopeKey []byte, rotationID string, db *gorm.DB) error {
	// Get the old envelope key from user (before rotation)
	var user models.User
	if err := db.First(&user, userFile.UserID).Error; err != nil {
		return fmt.Errorf("failed to get user: %w", err)
	}

	// Decode old envelope key
	oldEnvelopeKey, err := s.cryptoManager.DecodeFromHex(user.EnvelopeKey)
	if err != nil {
		return fmt.Errorf("failed to decode old envelope key: %w", err)
	}

	// Decrypt the file's encryption key using old envelope key
	fileKey, err := s.cryptoManager.DecryptFileKey(userFile.EncryptionKey, "", oldEnvelopeKey) // IV not stored, using empty for now
	if err != nil {
		return fmt.Errorf("failed to decrypt file key: %w", err)
	}

	// Re-encrypt the file key with new envelope key
	newEncryptedKey, _, err := s.cryptoManager.EncryptFileKey(fileKey, newEnvelopeKey)
	if err != nil {
		return fmt.Errorf("failed to re-encrypt file key: %w", err)
	}

	// Create backup before updating
	backup := models.KeyRotationBackup{
		RotationID:       rotationID,
		UserFileID:       userFile.ID,
		OldEncryptionKey: userFile.EncryptionKey,
		OldKeyIV:         "", // IV not stored in current model
		BackupCreatedAt:  time.Now(),
	}

	if err := db.Create(&backup).Error; err != nil {
		return fmt.Errorf("failed to create backup: %w", err)
	}

	// Update the file with new encrypted key
	if err := db.Model(userFile).Update("encryption_key", newEncryptedKey).Error; err != nil {
		return fmt.Errorf("failed to update file encryption key: %w", err)
	}

	return nil
}

// failRotation marks a rotation as failed
func (s *KeyRotationService) failRotation(rotationID, errorMessage string) {
	db := s.GetDB().GetDB()
	db.Model(&models.KeyRotation{}).Where("rotation_id = ?", rotationID).
		Updates(map[string]interface{}{
			"status":        string(KeyRotationStatusFailed),
			"error_message": errorMessage,
			"failed_at":     time.Now(),
		})
}

// RollbackRotation rolls back a completed key rotation
func (s *KeyRotationService) RollbackRotation(rotationID string, userID uint) error {
	db := s.GetDB().GetDB()

	// Get rotation details
	var rotation models.KeyRotation
	if err := db.Where("rotation_id = ? AND user_id = ?", rotationID, userID).First(&rotation).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return apperrors.New(apperrors.ErrCodeNotFound, "rotation not found")
		}
		return apperrors.Wrap(err, apperrors.ErrCodeInternal, "failed to get rotation")
	}

	// Only allow rollback of completed rotations
	if rotation.Status != string(KeyRotationStatusCompleted) {
		return apperrors.New(apperrors.ErrCodeInvalidArgument, "can only rollback completed rotations")
	}

	// Update status to rolled back
	if err := db.Model(&rotation).Updates(map[string]interface{}{
		"status": string(KeyRotationStatusRolledBack),
	}).Error; err != nil {
		return apperrors.Wrap(err, apperrors.ErrCodeInternal, "failed to update rotation status")
	}

	// Get all backups for this rotation
	var backups []models.KeyRotationBackup
	if err := db.Where("rotation_id = ?", rotationID).Find(&backups).Error; err != nil {
		return apperrors.Wrap(err, apperrors.ErrCodeInternal, "failed to get backups")
	}

	// Restore each file from backup
	for _, backup := range backups {
		if err := db.Model(&models.UserFile{}).Where("id = ?", backup.UserFileID).
			Update("encryption_key", backup.OldEncryptionKey).Error; err != nil {
			return apperrors.Wrap(err, apperrors.ErrCodeInternal, "failed to restore file encryption key")
		}
	}

	// Restore user's envelope key to previous version
	if err := db.Model(&models.User{}).Where("id = ?", userID).Updates(map[string]interface{}{
		"envelope_key_version": rotation.OldEnvelopeKeyVersion,
	}).Error; err != nil {
		return apperrors.Wrap(err, apperrors.ErrCodeInternal, "failed to restore envelope key version")
	}

	// Clean up backups
	if err := db.Where("rotation_id = ?", rotationID).Delete(&models.KeyRotationBackup{}).Error; err != nil {
		// Log error but don't fail the rollback
		fmt.Printf("Warning: failed to clean up backups: %v\n", err)
	}

	return nil
}

// GetRotationStatus gets the status of a key rotation
func (s *KeyRotationService) GetRotationStatus(rotationID string, userID uint) (*KeyRotationResult, error) {
	db := s.GetDB().GetDB()

	var rotation models.KeyRotation
	if err := db.Where("rotation_id = ? AND user_id = ?", rotationID, userID).First(&rotation).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, apperrors.New(apperrors.ErrCodeNotFound, "rotation not found")
		}
		return nil, apperrors.Wrap(err, apperrors.ErrCodeInternal, "failed to get rotation")
	}

	return &KeyRotationResult{
		RotationID:         rotation.RotationID,
		Status:             KeyRotationStatus(rotation.Status),
		TotalFilesAffected: rotation.TotalFilesAffected,
		FilesProcessed:     rotation.FilesProcessed,
		ErrorMessage:       rotation.ErrorMessage,
	}, nil
}