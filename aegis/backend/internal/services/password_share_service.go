package services

import (
	"crypto/rand"
	"encoding/base64"
	"encoding/hex"
	"time"

	"github.com/balkanid/aegis-backend/internal/database"
	apperrors "github.com/balkanid/aegis-backend/internal/errors"
	"github.com/balkanid/aegis-backend/internal/models"
	"github.com/balkanid/aegis-backend/internal/utils"
	"gorm.io/gorm"
)

// PasswordShareService handles password-based file sharing operations
type PasswordShareService struct {
	*BaseService
	cryptoConfig *utils.CryptoConfig
}

// NewPasswordShareService creates a new PasswordShareService
func NewPasswordShareService(db *database.DB) *PasswordShareService {
	return &PasswordShareService{
		BaseService:  NewBaseService(db),
		cryptoConfig: utils.DefaultCryptoConfig(),
	}
}

// CreateShare creates a new password-protected file share
func (s *PasswordShareService) CreateShare(userFileID uint, masterPassword string, maxDownloads int, expiresAt *time.Time) (*models.FileShare, error) {
	// Validate password strength
	if err := utils.ValidatePasswordStrength(masterPassword); err != nil {
		return nil, err
	}

	// Get the user file to access its encryption key
	var userFile models.UserFile
	if err := s.GetDB().GetDB().First(&userFile, userFileID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, apperrors.New(apperrors.ErrCodeNotFound, "file not found")
		}
		return nil, apperrors.Wrap(err, apperrors.ErrCodeInternal, "failed to retrieve file")
	}

	// Decode the file's encryption key
	fileKey, err := base64.StdEncoding.DecodeString(userFile.EncryptionKey)
	if err != nil {
		return nil, apperrors.Wrap(err, apperrors.ErrCodeInternal, "invalid file encryption key")
	}

	// Encrypt the file key with the master password
	encryptedKeyData, err := utils.EncryptFileKeyWithPassword(fileKey, masterPassword, s.cryptoConfig)
	if err != nil {
		return nil, apperrors.Wrap(err, apperrors.ErrCodeInternal, "failed to encrypt file key")
	}

	// Generate a unique share token
	shareToken, err := s.generateShareToken()
	if err != nil {
		return nil, err
	}

	// Create the file share record
	fileShare := &models.FileShare{
		UserFileID:    userFileID,
		ShareToken:    shareToken,
		EncryptedKey:  encryptedKeyData.EncryptedKey,
		Salt:          encryptedKeyData.Salt,
		IV:            encryptedKeyData.IV,
		MaxDownloads:  maxDownloads,
		DownloadCount: 0,
		ExpiresAt:     expiresAt,
	}

	// Save to database
	if err := s.GetDB().GetDB().Create(fileShare).Error; err != nil {
		return nil, apperrors.Wrap(err, apperrors.ErrCodeInternal, "failed to create file share")
	}

	// Update the user file to mark it as shared
	if err := s.GetDB().GetDB().Model(&userFile).Updates(map[string]interface{}{
		"is_shared":   true,
		"share_count": gorm.Expr("share_count + 1"),
	}).Error; err != nil {
		return nil, apperrors.Wrap(err, apperrors.ErrCodeInternal, "failed to update file share status")
	}

	return fileShare, nil
}

// GetShareByToken retrieves a file share by its token
func (s *PasswordShareService) GetShareByToken(token string) (*models.FileShare, error) {
	var fileShare models.FileShare
	if err := s.GetDB().GetDB().Preload("UserFile").Preload("UserFile.File").Where("share_token = ?", token).First(&fileShare).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, apperrors.New(apperrors.ErrCodeNotFound, "share not found")
		}
		return nil, apperrors.Wrap(err, apperrors.ErrCodeInternal, "failed to retrieve share")
	}

	// Check if share has expired
	if fileShare.ExpiresAt != nil && time.Now().After(*fileShare.ExpiresAt) {
		return nil, apperrors.New(apperrors.ErrCodeValidation, "share has expired")
	}

	// Check if download limit has been reached
	if fileShare.MaxDownloads != -1 && fileShare.DownloadCount >= fileShare.MaxDownloads {
		return nil, apperrors.New(apperrors.ErrCodeValidation, "download limit exceeded")
	}

	return &fileShare, nil
}

// DecryptFileKey decrypts the file encryption key using the master password
func (s *PasswordShareService) DecryptFileKey(fileShare *models.FileShare, masterPassword string) ([]byte, error) {
	encryptedKeyData := &utils.EncryptedKeyData{
		EncryptedKey: fileShare.EncryptedKey,
		Salt:         fileShare.Salt,
		IV:           fileShare.IV,
	}

	fileKey, err := utils.DecryptFileKeyWithPassword(encryptedKeyData, masterPassword, s.cryptoConfig)
	if err != nil {
		return nil, err
	}

	return fileKey, nil
}

// IncrementDownloadCount increments the download count for a share
func (s *PasswordShareService) IncrementDownloadCount(shareID uint) error {
	if err := s.GetDB().GetDB().Model(&models.FileShare{}).Where("id = ?", shareID).Update("download_count", gorm.Expr("download_count + 1")).Error; err != nil {
		return apperrors.Wrap(err, apperrors.ErrCodeInternal, "failed to increment download count")
	}
	return nil
}

// DeleteShare deletes a file share
func (s *PasswordShareService) DeleteShare(userID, shareID uint) error {
	// First get the share to validate ownership
	var fileShare models.FileShare
	if err := s.GetDB().GetDB().Preload("UserFile").First(&fileShare, shareID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return apperrors.New(apperrors.ErrCodeNotFound, "share not found")
		}
		return apperrors.Wrap(err, apperrors.ErrCodeInternal, "failed to retrieve share")
	}

	// Validate ownership through the user file
	if err := s.ValidateOwnership(&models.UserFile{}, fileShare.UserFileID, userID); err != nil {
		return err
	}

	// Delete the share
	if err := s.GetDB().GetDB().Delete(&fileShare).Error; err != nil {
		return apperrors.Wrap(err, apperrors.ErrCodeInternal, "failed to delete share")
	}

	// Update the user file share count (decrement, but not below 0)
	if err := s.GetDB().GetDB().Model(&models.UserFile{}).Where("id = ?", fileShare.UserFileID).Update("share_count", gorm.Expr("CASE WHEN share_count > 0 THEN share_count - 1 ELSE 0 END")).Error; err != nil {
		return apperrors.Wrap(err, apperrors.ErrCodeInternal, "failed to update share count")
	}

	// Check if this was the last share for the file
	var shareCount int64
	s.GetDB().GetDB().Model(&models.FileShare{}).Where("user_file_id = ?", fileShare.UserFileID).Count(&shareCount)
	if shareCount == 0 {
		if err := s.GetDB().GetDB().Model(&models.UserFile{}).Where("id = ?", fileShare.UserFileID).Update("is_shared", false).Error; err != nil {
			return apperrors.Wrap(err, apperrors.ErrCodeInternal, "failed to update file share status")
		}
	}

	return nil
}

// GetUserShares retrieves all shares for a user's files
func (s *PasswordShareService) GetUserShares(userID uint) ([]*models.FileShare, error) {
	var shares []*models.FileShare
	if err := s.GetDB().GetDB().
		Joins("JOIN user_files ON file_shares.user_file_id = user_files.id").
		Where("user_files.user_id = ?", userID).
		Preload("UserFile").
		Preload("UserFile.File").
		Find(&shares).Error; err != nil {
		return nil, apperrors.Wrap(err, apperrors.ErrCodeInternal, "failed to retrieve user shares")
	}

	return shares, nil
}

// generateShareToken generates a unique share token
func (s *PasswordShareService) generateShareToken() (string, error) {
	const tokenLength = 32
	tokenBytes := make([]byte, tokenLength)

	for {
		if _, err := rand.Read(tokenBytes); err != nil {
			return "", apperrors.Wrap(err, apperrors.ErrCodeInternal, "failed to generate token")
		}

		token := hex.EncodeToString(tokenBytes)

		// Check if token is unique
		var count int64
		if err := s.GetDB().GetDB().Model(&models.FileShare{}).Where("share_token = ?", token).Count(&count).Error; err != nil {
			return "", apperrors.Wrap(err, apperrors.ErrCodeInternal, "failed to check token uniqueness")
		}

		if count == 0 {
			return token, nil
		}
	}
}
