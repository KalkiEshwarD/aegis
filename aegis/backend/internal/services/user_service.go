package services

import (
	"errors"
	"log"
	"strings"
	"time"

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
	if result := utils.ValidateUsername(username); result.HasErrors() {
		return nil, "", apperrors.New(apperrors.ErrCodeInvalidArgument, "username validation failed: "+strings.Join(result.Errors, ", "))
	}

	// Validate email
	if result := utils.ValidateEmail(email); result.HasErrors() {
		return nil, "", apperrors.New(apperrors.ErrCodeInvalidArgument, "email validation failed: "+strings.Join(result.Errors, ", "))
	}

	// Validate password
	if result := utils.ValidatePassword(password, utils.DefaultPasswordRequirements()); result.HasErrors() {
		return nil, "", apperrors.New(apperrors.ErrCodeInvalidArgument, "password validation failed: "+strings.Join(result.Errors, ", "))
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
	log.Printf("DEBUG: UserService.Login called with identifier: %s", identifier)

	// Find user by email or username
	var user models.User
	if err := s.db.GetDB().Where("email = ? OR username = ?", identifier, identifier).First(&user).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			log.Printf("DEBUG: User not found with identifier: %s", identifier)
			return nil, "", apperrors.New(apperrors.ErrCodeUnauthorized, "invalid credentials")
		}
		log.Printf("DEBUG: Database error during user lookup: %v", err)
		return nil, "", apperrors.Wrap(err, apperrors.ErrCodeInternal, "database error")
	}

	log.Printf("DEBUG: User found: ID=%d, Email=%s, Username=%s", user.ID, user.Email, user.Username)

	// Verify password
	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(password)); err != nil {
		log.Printf("DEBUG: Password verification failed for user: %s", user.Email)
		return nil, "", apperrors.New(apperrors.ErrCodeUnauthorized, "invalid credentials")
	}

	log.Printf("DEBUG: Password verified successfully for user: %s", user.Email)

	// Generate JWT token
	token, err := s.authService.GenerateToken(&user)
	if err != nil {
		log.Printf("DEBUG: Failed to generate JWT token: %v", err)
		return nil, "", apperrors.Wrap(err, apperrors.ErrCodeInternal, "failed to generate token")
	}

	log.Printf("DEBUG: Login successful, JWT token generated for user: %s", user.Email)
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

	// Calculate actual storage used (sum of all file sizes the user has access to, including trashed files)
	var usedStorage int64
	s.db.GetDB().Table("user_files").
		Select("COALESCE(SUM(files.size_bytes), 0)").
		Joins("JOIN files ON user_files.file_id = files.id").
		Where("user_files.user_id = ?", userID).
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

	// Calculate current storage usage dynamically (including trashed files)
	var currentUsage int64
	s.db.GetDB().Table("user_files").
		Select("COALESCE(SUM(files.size_bytes), 0)").
		Joins("JOIN files ON user_files.file_id = files.id").
		Where("user_files.user_id = ?", userID).
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

// SearchUsers returns users matching the search term for autocomplete
func (s *UserService) SearchUsers(search string) ([]*models.User, error) {
	var users []*models.User
	query := s.db.GetDB()

	if search != "" {
		searchTerm := "%" + search + "%"
		query = query.Where("username ILIKE ? OR email ILIKE ?", searchTerm, searchTerm)
	}

	// Limit results for autocomplete
	err := query.Limit(10).Find(&users).Error
	return users, err
}

// UpdateProfile updates user profile information
func (s *UserService) UpdateProfile(userID uint, username, email, currentPassword, newPassword string) (*models.User, error) {
	// Get current user
	var user models.User
	if err := s.db.GetDB().First(&user, userID).Error; err != nil {
		return nil, apperrors.Wrap(err, apperrors.ErrCodeNotFound, "user not found")
	}

	// If changing password, verify current password
	if newPassword != "" {
		if currentPassword == "" {
			return nil, apperrors.New(apperrors.ErrCodeInvalidArgument, "current password is required when changing password")
		}
		if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(currentPassword)); err != nil {
			return nil, apperrors.New(apperrors.ErrCodeUnauthorized, "current password is incorrect")
		}
	}

	// Check username uniqueness if changing
	if username != "" && username != user.Username {
		if result := utils.ValidateUsername(username); result.HasErrors() {
			return nil, apperrors.New(apperrors.ErrCodeInvalidArgument, "username validation failed: "+strings.Join(result.Errors, ", "))
		}
		var existingUser models.User
		if err := s.db.GetDB().Where("username = ? AND id != ?", username, userID).First(&existingUser).Error; err == nil {
			return nil, apperrors.New(apperrors.ErrCodeConflict, "username already taken")
		}
		user.Username = username
	}

	// Check email uniqueness if changing
	if email != "" && email != user.Email {
		if result := utils.ValidateEmail(email); result.HasErrors() {
			return nil, apperrors.New(apperrors.ErrCodeInvalidArgument, "email validation failed: "+strings.Join(result.Errors, ", "))
		}
		var existingUser models.User
		if err := s.db.GetDB().Where("email = ? AND id != ?", email, userID).First(&existingUser).Error; err == nil {
			return nil, apperrors.New(apperrors.ErrCodeConflict, "email already taken")
		}
		user.Email = email
	}

	// Hash new password if provided
	if newPassword != "" {
		if result := utils.ValidatePassword(newPassword, utils.DefaultPasswordRequirements()); result.HasErrors() {
			return nil, apperrors.New(apperrors.ErrCodeInvalidArgument, "password validation failed: "+strings.Join(result.Errors, ", "))
		}
		hashedPassword, err := bcrypt.GenerateFromPassword([]byte(newPassword), bcrypt.DefaultCost)
		if err != nil {
			return nil, apperrors.Wrap(err, apperrors.ErrCodeInternal, "failed to hash password")
		}
		user.PasswordHash = string(hashedPassword)
	}

	// Update user
	user.UpdatedAt = time.Now()
	if err := s.db.GetDB().Save(&user).Error; err != nil {
		return nil, apperrors.Wrap(err, apperrors.ErrCodeInternal, "failed to update user")
	}

	return &user, nil
}

// UserStats represents user storage statistics
type UserStats struct {
	TotalFiles     int `json:"total_files"`
	UsedStorage    int `json:"used_storage"`
	StorageQuota   int `json:"storage_quota"`
	StorageSavings int `json:"storage_savings"`
}
