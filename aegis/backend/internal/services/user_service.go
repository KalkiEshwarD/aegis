package services

import (
	"crypto/sha256"
	"encoding/hex"
	"errors"

	apperrors "github.com/balkanid/aegis-backend/internal/errors"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"

	"github.com/balkanid/aegis-backend/internal/database"
	"github.com/balkanid/aegis-backend/internal/models"
	"github.com/balkanid/aegis-backend/internal/utils"
)

type UserService struct {
	authService *AuthService
	db          *database.DB
}

func NewUserService(authService *AuthService, db *database.DB) *UserService {
	return &UserService{authService: authService, db: db}
}

// Register creates a new user account
func (s *UserService) Register(username, email, password string) (*models.User, string, error) {
	// Validate username
	usernameResult := utils.ValidateUsername(username)
	if usernameResult.HasErrors() {
		return nil, "", apperrors.New(apperrors.ErrCodeInvalidArgument, usernameResult.Errors[0])
	}

	// Validate email
	emailResult := utils.ValidateEmail(email)
	if emailResult.HasErrors() {
		return nil, "", apperrors.New(apperrors.ErrCodeInvalidArgument, emailResult.Errors[0])
	}

	// Validate password
	passwordResult := utils.ValidatePassword(password, utils.DefaultPasswordRequirements())
	if passwordResult.HasErrors() {
		return nil, "", apperrors.New(apperrors.ErrCodeInvalidArgument, passwordResult.Errors[0])
	}

	// Check if user already exists
	var existingUser models.User
	if err := s.db.GetDB().Where("email = ?", email).First(&existingUser).Error; err == nil {
		return nil, "", apperrors.New(apperrors.ErrCodeConflict, "user with this email already exists")
	}
	if err := s.db.GetDB().Where("username = ?", username).First(&existingUser).Error; err == nil {
		return nil, "", apperrors.New(apperrors.ErrCodeConflict, "user with this username already exists")
	}

	// Hash password
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return nil, "", apperrors.Wrap(err, apperrors.ErrCodeInternal, "failed to hash password")
	}

	// Create user
	user := &models.User{
		Username:     username,
		Email:        email,
		PasswordHash: string(hashedPassword),
		StorageQuota: 104857600, // 100MB default
		UsedStorage:  0,
		IsAdmin:      false,
	}

	if err := s.db.GetDB().Create(user).Error; err != nil {
		return nil, "", apperrors.Wrap(err, apperrors.ErrCodeInternal, "failed to create user")
	}

	// Generate JWT token
	token, err := s.authService.GenerateToken(user)
	if err != nil {
		return nil, "", apperrors.Wrap(err, apperrors.ErrCodeInternal, "failed to generate token")
	}

	return user, token, nil
}

// Login authenticates a user and returns a JWT token
func (s *UserService) Login(identifier, password string) (*models.User, string, error) {
	// Find user by email or username
	var user models.User
	if err := s.db.GetDB().Where("email = ? OR username = ?", identifier, identifier).First(&user).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, "", apperrors.New(apperrors.ErrCodeUnauthorized, "invalid credentials")
		}
		return nil, "", apperrors.Wrap(err, apperrors.ErrCodeInternal, "database error")
	}

	// Verify password
	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(password)); err != nil {
		return nil, "", apperrors.New(apperrors.ErrCodeUnauthorized, "invalid credentials")
	}

	// Generate JWT token
	token, err := s.authService.GenerateToken(&user)
	if err != nil {
		return nil, "", apperrors.Wrap(err, apperrors.ErrCodeInternal, "failed to generate token")
	}

	return &user, token, nil
}

// GetUserStats returns storage statistics for a user
func (s *UserService) GetUserStats(userID uint) (*UserStats, error) {
	var user models.User
	if err := s.db.GetDB().First(&user, userID).Error; err != nil {
		return nil, apperrors.Wrap(err, apperrors.ErrCodeNotFound, "user not found")
	}

	// Count total files (excluding soft-deleted)
	var fileCount int64
	s.db.GetDB().Model(&models.UserFile{}).Where("user_id = ? AND deleted_at IS NULL", userID).Count(&fileCount)

	// Calculate actual storage used (sum of all file sizes the user has access to, excluding soft-deleted)
	var usedStorage int64
	s.db.GetDB().Table("user_files").
		Select("COALESCE(SUM(files.size_bytes), 0)").
		Joins("JOIN files ON user_files.file_id = files.id").
		Where("user_files.user_id = ? AND user_files.deleted_at IS NULL", userID).
		Scan(&usedStorage)

	// No deduplication - each file upload creates a separate copy
	storageSavings := int64(0)

	return &UserStats{
		TotalFiles:     int(fileCount),
		UsedStorage:    int(usedStorage),
		StorageQuota:   int(user.StorageQuota),
		StorageSavings: int(storageSavings),
	}, nil
}

// UpdateStorageUsage updates the user's storage usage
func (s *UserService) UpdateStorageUsage(userID uint, deltaBytes int64) error {
	return s.db.GetDB().Model(&models.User{}).
		Where("id = ?", userID).
		UpdateColumn("used_storage", gorm.Expr("used_storage + ?", deltaBytes)).Error
}

// CheckStorageQuota checks if the user has enough storage space
func (s *UserService) CheckStorageQuota(userID uint, additionalBytes int64) error {
	var user models.User
	if err := s.db.GetDB().First(&user, userID).Error; err != nil {
		return apperrors.Wrap(err, apperrors.ErrCodeNotFound, "user not found")
	}

	// Calculate current storage usage dynamically (excluding soft-deleted files)
	var currentUsage int64
	s.db.GetDB().Table("user_files").
		Select("COALESCE(SUM(files.size_bytes), 0)").
		Joins("JOIN files ON user_files.file_id = files.id").
		Where("user_files.user_id = ? AND user_files.deleted_at IS NULL", userID).
		Scan(&currentUsage)

	if currentUsage+additionalBytes > user.StorageQuota {
		return apperrors.New(apperrors.ErrCodeForbidden, "storage quota exceeded")
	}

	return nil
}

// PromoteToAdmin promotes a user to admin status
func (s *UserService) PromoteToAdmin(userID uint) error {
	return s.db.GetDB().Model(&models.User{}).
		Where("id = ?", userID).
		Update("is_admin", true).Error
}

// DeleteUser soft deletes a user account
func (s *UserService) DeleteUser(userID uint) error {
	return s.db.GetDB().Delete(&models.User{}, userID).Error
}

// GetAllUsers returns all users (admin only)
func (s *UserService) GetAllUsers() ([]*models.User, error) {
	var users []*models.User
	err := s.db.GetDB().Find(&users).Error
	return users, err
}

// HashSHA256 creates a SHA-256 hash of the input
func HashSHA256(data []byte) string {
	hash := sha256.Sum256(data)
	return hex.EncodeToString(hash[:])
}

// UserStats represents user storage statistics
type UserStats struct {
	TotalFiles     int `json:"total_files"`
	UsedStorage    int `json:"used_storage"`
	StorageQuota   int `json:"storage_quota"`
	StorageSavings int `json:"storage_savings"`
}
