package services

import (
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"regexp"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"

	"github.com/balkanid/aegis-backend/internal/config"
	"github.com/balkanid/aegis-backend/internal/database"
	"github.com/balkanid/aegis-backend/internal/middleware"
	"github.com/balkanid/aegis-backend/internal/models"
)

type UserService struct {
	cfg *config.Config
}

func NewUserService(cfg *config.Config) *UserService {
	return &UserService{cfg: cfg}
}

// Register creates a new user account
func (s *UserService) Register(username, email, password string) (*models.User, string, error) {
	// Validate username
	if username == "" {
		return nil, "", errors.New("username is required")
	}
	if len(username) < 3 || len(username) > 50 {
		return nil, "", errors.New("username must be between 3 and 50 characters")
	}
	if matched, _ := regexp.MatchString("^[a-zA-Z0-9]+$", username); !matched {
		return nil, "", errors.New("username must contain only alphanumeric characters")
	}

	// Validate email
	if email == "" {
		return nil, "", errors.New("email is required")
	}
	emailRegex := regexp.MustCompile(`^[^\s@]+@[^\s@]+\.[^\s@]+$`)
	if !emailRegex.MatchString(email) {
		return nil, "", errors.New("invalid email format")
	}

	// Validate password
	if len(password) < 8 {
		return nil, "", errors.New("password must be at least 8 characters long")
	}

	// Check for required character types
	hasLower := regexp.MustCompile(`[a-z]`).MatchString(password)
	hasUpper := regexp.MustCompile(`[A-Z]`).MatchString(password)
	hasDigit := regexp.MustCompile(`\d`).MatchString(password)
	hasSpecial := regexp.MustCompile(`[@$!%*?&]`).MatchString(password)

	if !hasLower || !hasUpper || !hasDigit || !hasSpecial {
		return nil, "", errors.New("password must contain at least one uppercase letter, one lowercase letter, one number, and one special character")
	}

	// Check if user already exists
	var existingUser models.User
	if err := database.GetDB().Where("email = ?", email).First(&existingUser).Error; err == nil {
		return nil, "", errors.New("user with this email already exists")
	}
	if err := database.GetDB().Where("username = ?", username).First(&existingUser).Error; err == nil {
		return nil, "", errors.New("user with this username already exists")
	}

	// Hash password
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return nil, "", fmt.Errorf("failed to hash password: %w", err)
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

	if err := database.GetDB().Create(user).Error; err != nil {
		return nil, "", fmt.Errorf("failed to create user: %w", err)
	}

	// Generate JWT token
	token, err := s.generateToken(user)
	if err != nil {
		return nil, "", fmt.Errorf("failed to generate token: %w", err)
	}

	return user, token, nil
}

// Login authenticates a user and returns a JWT token
func (s *UserService) Login(identifier, password string) (*models.User, string, error) {
	// Find user by email or username
	var user models.User
	if err := database.GetDB().Where("email = ? OR username = ?", identifier, identifier).First(&user).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, "", errors.New("invalid credentials")
		}
		return nil, "", fmt.Errorf("database error: %w", err)
	}

	// Verify password
	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(password)); err != nil {
		return nil, "", errors.New("invalid credentials")
	}

	// Generate JWT token
	token, err := s.generateToken(&user)
	if err != nil {
		return nil, "", fmt.Errorf("failed to generate token: %w", err)
	}

	return &user, token, nil
}

// generateToken creates a JWT token for the user
func (s *UserService) generateToken(user *models.User) (string, error) {
	claims := &middleware.Claims{
		UserID:  user.ID,
		Email:   user.Email,
		IsAdmin: user.IsAdmin,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(24 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(s.cfg.JWTSecret))
}

// GetUserStats returns storage statistics for a user
func (s *UserService) GetUserStats(userID uint) (*UserStats, error) {
	var user models.User
	if err := database.GetDB().First(&user, userID).Error; err != nil {
		return nil, fmt.Errorf("user not found: %w", err)
	}

	// Count total files (excluding soft-deleted)
	var fileCount int64
	database.GetDB().Model(&models.UserFile{}).Where("user_id = ? AND deleted_at IS NULL", userID).Count(&fileCount)

	// Calculate actual storage used (sum of all file sizes the user has access to, excluding soft-deleted)
	var usedStorage int64
	database.GetDB().Table("user_files").
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
	return database.GetDB().Model(&models.User{}).
		Where("id = ?", userID).
		UpdateColumn("used_storage", gorm.Expr("used_storage + ?", deltaBytes)).Error
}

// CheckStorageQuota checks if the user has enough storage space
func (s *UserService) CheckStorageQuota(userID uint, additionalBytes int64) error {
	var user models.User
	if err := database.GetDB().First(&user, userID).Error; err != nil {
		return fmt.Errorf("user not found: %w", err)
	}

	// Calculate current storage usage dynamically (excluding soft-deleted files)
	var currentUsage int64
	database.GetDB().Table("user_files").
		Select("COALESCE(SUM(files.size_bytes), 0)").
		Joins("JOIN files ON user_files.file_id = files.id").
		Where("user_files.user_id = ? AND user_files.deleted_at IS NULL", userID).
		Scan(&currentUsage)

	if currentUsage+additionalBytes > user.StorageQuota {
		return errors.New("storage quota exceeded")
	}

	return nil
}

// PromoteToAdmin promotes a user to admin status
func (s *UserService) PromoteToAdmin(userID uint) error {
	return database.GetDB().Model(&models.User{}).
		Where("id = ?", userID).
		Update("is_admin", true).Error
}

// DeleteUser soft deletes a user account
func (s *UserService) DeleteUser(userID uint) error {
	return database.GetDB().Delete(&models.User{}, userID).Error
}

// GetAllUsers returns all users (admin only)
func (s *UserService) GetAllUsers() ([]*models.User, error) {
	var users []*models.User
	err := database.GetDB().Find(&users).Error
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
