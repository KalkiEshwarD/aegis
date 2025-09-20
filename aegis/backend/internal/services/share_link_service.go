package services

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"net/url"
	"strings"
	"time"

	apperrors "github.com/balkanid/aegis-backend/internal/errors"
	"github.com/balkanid/aegis-backend/internal/database"
	"github.com/balkanid/aegis-backend/internal/models"
	"gorm.io/gorm"
)

// ShareLinkService handles share link generation and validation
type ShareLinkService struct {
	*BaseService
	baseURL string
}

// NewShareLinkService creates a new ShareLinkService
func NewShareLinkService(db *database.DB, baseURL string) *ShareLinkService {
	return &ShareLinkService{
		BaseService: NewBaseService(db),
		baseURL:     strings.TrimSuffix(baseURL, "/"),
	}
}

// GenerateShareLink generates a shareable link for a file share
func (s *ShareLinkService) GenerateShareLink(fileShare *models.FileShare) (string, error) {
	if fileShare == nil {
		return "", apperrors.New(apperrors.ErrCodeValidation, "file share cannot be nil")
	}

	// Construct the share URL
	shareURL := fmt.Sprintf("%s/share/%s", s.baseURL, fileShare.ShareToken)

	// Validate the generated URL
	if _, err := url.Parse(shareURL); err != nil {
		return "", apperrors.Wrap(err, apperrors.ErrCodeInternal, "failed to generate valid share URL")
	}

	return shareURL, nil
}

// ValidateShareToken validates a share token and returns the associated file share
func (s *ShareLinkService) ValidateShareToken(token string) (*models.FileShare, error) {
	if token == "" {
		return nil, apperrors.New(apperrors.ErrCodeValidation, "share token cannot be empty")
	}

	// Validate token format (should be hex)
	if len(token) != 64 { // 32 bytes * 2 hex chars per byte
		return nil, apperrors.New(apperrors.ErrCodeValidation, "invalid share token format")
	}

	if _, err := hex.DecodeString(token); err != nil {
		return nil, apperrors.New(apperrors.ErrCodeValidation, "invalid share token format")
	}

	// Get the file share from database
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

// GetShareMetadata returns metadata about a share without requiring password
func (s *ShareLinkService) GetShareMetadata(token string) (*ShareMetadata, error) {
	fileShare, err := s.ValidateShareToken(token)
	if err != nil {
		return nil, err
	}

	metadata := &ShareMetadata{
		Token:         fileShare.ShareToken,
		Filename:      fileShare.UserFile.Filename,
		MimeType:      fileShare.UserFile.MimeType,
		SizeBytes:     fileShare.UserFile.File.SizeBytes,
		MaxDownloads:  fileShare.MaxDownloads,
		DownloadCount: fileShare.DownloadCount,
		ExpiresAt:     fileShare.ExpiresAt,
		CreatedAt:     fileShare.CreatedAt,
	}

	return metadata, nil
}

// ShareMetadata contains public information about a file share
type ShareMetadata struct {
	Token         string     `json:"token"`
	Filename      string     `json:"filename"`
	MimeType      string     `json:"mime_type"`
	SizeBytes     int64      `json:"size_bytes"`
	MaxDownloads  int        `json:"max_downloads"`
	DownloadCount int        `json:"download_count"`
	ExpiresAt     *time.Time `json:"expires_at"`
	CreatedAt     time.Time  `json:"created_at"`
}

// IsExpired checks if a share has expired
func (s *ShareLinkService) IsExpired(fileShare *models.FileShare) bool {
	if fileShare.ExpiresAt == nil {
		return false
	}
	return time.Now().After(*fileShare.ExpiresAt)
}

// IsDownloadLimitReached checks if the download limit has been reached
func (s *ShareLinkService) IsDownloadLimitReached(fileShare *models.FileShare) bool {
	if fileShare.MaxDownloads == -1 {
		return false
	}
	return fileShare.DownloadCount >= fileShare.MaxDownloads
}

// GetRemainingDownloads returns the number of remaining downloads
func (s *ShareLinkService) GetRemainingDownloads(fileShare *models.FileShare) int {
	if fileShare.MaxDownloads == -1 {
		return -1 // Unlimited
	}
	remaining := fileShare.MaxDownloads - fileShare.DownloadCount
	if remaining < 0 {
		return 0
	}
	return remaining
}

// GetShareExpiryInfo returns information about when the share expires
func (s *ShareLinkService) GetShareExpiryInfo(fileShare *models.FileShare) *ShareExpiryInfo {
	if fileShare.ExpiresAt == nil {
		return &ShareExpiryInfo{
			Expires: false,
		}
	}

	now := time.Now()
	expires := now.After(*fileShare.ExpiresAt)

	var timeUntilExpiry *time.Duration
	if !expires {
		duration := fileShare.ExpiresAt.Sub(now)
		timeUntilExpiry = &duration
	}

	return &ShareExpiryInfo{
		Expires:         true,
		Expired:         expires,
		ExpiresAt:       fileShare.ExpiresAt,
		TimeUntilExpiry: timeUntilExpiry,
	}
}

// ShareExpiryInfo contains information about share expiration
type ShareExpiryInfo struct {
	Expires         bool             `json:"expires"`
	Expired         bool             `json:"expired"`
	ExpiresAt       *time.Time       `json:"expires_at"`
	TimeUntilExpiry *time.Duration   `json:"time_until_expiry"`
}

// GenerateSecureToken generates a cryptographically secure random token
func (s *ShareLinkService) GenerateSecureToken() (string, error) {
	const tokenLength = 32
	tokenBytes := make([]byte, tokenLength)

	if _, err := rand.Read(tokenBytes); err != nil {
		return "", apperrors.Wrap(err, apperrors.ErrCodeInternal, "failed to generate secure token")
	}

	return hex.EncodeToString(tokenBytes), nil
}

// ValidateShareURL validates if a URL is a valid share URL
func (s *ShareLinkService) ValidateShareURL(shareURL string) (string, error) {
	_, err := url.Parse(shareURL)
	if err != nil {
		return "", apperrors.Wrap(err, apperrors.ErrCodeValidation, "invalid share URL format")
	}

	// Check if URL matches expected pattern
	expectedPrefix := s.baseURL + "/share/"
	if !strings.HasPrefix(shareURL, expectedPrefix) {
		return "", apperrors.New(apperrors.ErrCodeValidation, "invalid share URL format")
	}

	// Extract token from URL
	token := strings.TrimPrefix(shareURL, expectedPrefix)
	if token == "" {
		return "", apperrors.New(apperrors.ErrCodeValidation, "share token missing from URL")
	}

	return token, nil
}