package services

import (
	"crypto/rand"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net"
	"net/url"
	"strings"
	"sync"
	"time"

	"github.com/balkanid/aegis-backend/internal/database"
	apperrors "github.com/balkanid/aegis-backend/internal/errors"
	"github.com/balkanid/aegis-backend/internal/models"
	"github.com/balkanid/aegis-backend/internal/utils"
	"gorm.io/gorm"
)

//================================================================================
// Service Definition
//================================================================================

type ShareService struct {
	*BaseService
	baseURL           string
	cryptoConfig      *utils.CryptoConfig
	rateLimiter       *RateLimiter
	encryptionService *EncryptionService
	sharePasswordKey  []byte // Service-wide key for encrypting share passwords
}

func NewShareService(db *database.DB, baseURL string, encryptionService *EncryptionService) *ShareService {
	// Generate a service-wide key for encrypting share passwords
	// In production, this should be loaded from a secure key store
	sharePasswordKey, _ := utils.GenerateRandomKey(32)

	return &ShareService{
		BaseService:       NewBaseService(db),
		baseURL:           strings.TrimSuffix(baseURL, "/"),
		cryptoConfig:      utils.DefaultCryptoConfig(),
		rateLimiter:       NewRateLimiter(),
		encryptionService: encryptionService,
		sharePasswordKey:  sharePasswordKey,
	}
}

//================================================================================
// Password-based Sharing
//================================================================================

func (s *ShareService) CreateShare(userFileID uint, masterPassword string, maxDownloads int, expiresAt *time.Time, allowedUsernames []string) (*models.FileShare, error) {
	if err := utils.ValidatePasswordStrength(masterPassword); err != nil {
		return nil, err
	}

	var userFile models.UserFile
	if err := s.GetDB().GetDB().First(&userFile, userFileID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, apperrors.New(apperrors.ErrCodeNotFound, "file not found")
		}
		return nil, apperrors.Wrap(err, apperrors.ErrCodeInternal, "failed to retrieve file")
	}

	fileKey, err := base64.StdEncoding.DecodeString(userFile.EncryptionKey)
	if err != nil {
		return nil, apperrors.Wrap(err, apperrors.ErrCodeInternal, "invalid file encryption key")
	}

	// Generate envelope key
	envelopeKey, err := s.encryptionService.keyManager.GenerateEnvelopeKey()
	if err != nil {
		return nil, apperrors.Wrap(err, apperrors.ErrCodeInternal, "failed to generate envelope key")
	}

	// Encrypt envelope key with password using PBKDF2+AES-GCM
	encryptedEnvelopeKey, envelopeSalt, envelopeIV, err := s.encryptionService.EncryptEnvelopeKey(envelopeKey, masterPassword)
	if err != nil {
		return nil, apperrors.Wrap(err, apperrors.ErrCodeInternal, "failed to encrypt envelope key")
	}

	// Encrypt file key with envelope key
	encryptedFileKey, fileKeyIV, err := s.encryptionService.EncryptFileKey(fileKey, envelopeKey)
	if err != nil {
		return nil, apperrors.Wrap(err, apperrors.ErrCodeInternal, "failed to encrypt file key with envelope key")
	}

	shareToken, err := s.generateShareToken()
	if err != nil {
		return nil, err
	}

	// Encrypt the share password with a service key for storage
	encryptedPassword, passwordIV, err := s.encryptSharePassword(masterPassword)
	if err != nil {
		return nil, apperrors.Wrap(err, apperrors.ErrCodeInternal, "failed to encrypt share password")
	}

	fileShare := &models.FileShare{
		UserFileID:        userFileID,
		ShareToken:        shareToken,
		EncryptedKey:      encryptedFileKey,
		Salt:              "", // Keep for backward compatibility
		IV:                fileKeyIV,
		EnvelopeKey:       encryptedEnvelopeKey,
		EnvelopeSalt:      envelopeSalt,
		EnvelopeIV:        envelopeIV,
		EncryptedPassword: encryptedPassword,
		PasswordIV:        passwordIV,
		PlainTextPassword: masterPassword, // Store for display purposes
		MaxDownloads:      maxDownloads,
		DownloadCount:     0,
		ExpiresAt:         expiresAt,
		AllowedUsernames:  allowedUsernames,
	}

	if err := s.GetDB().GetDB().Create(fileShare).Error; err != nil {
		return nil, apperrors.Wrap(err, apperrors.ErrCodeInternal, "failed to create file share")
	}

	if err := s.GetDB().GetDB().Model(&userFile).Updates(map[string]interface{}{
		"is_shared":   true,
		"share_count": gorm.Expr("share_count + 1"),
	}).Error; err != nil {
		return nil, apperrors.Wrap(err, apperrors.ErrCodeInternal, "failed to update file share status")
	}

	return fileShare, nil
}

func (s *ShareService) UpdateShare(userID uint, shareID uint, masterPassword *string, maxDownloads *int, expiresAt *time.Time, allowedUsernames *[]string) (*models.FileShare, error) {
	// Get the existing share
	var fileShare models.FileShare
	err := s.GetDB().GetDB().
		Preload("UserFile").
		Where("id = ?", shareID).
		First(&fileShare).Error

	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, apperrors.New(apperrors.ErrCodeNotFound, "share not found")
		}
		return nil, apperrors.Wrap(err, apperrors.ErrCodeInternal, "failed to retrieve share")
	}

	// Verify ownership
	if fileShare.UserFile.UserID != userID {
		return nil, apperrors.New(apperrors.ErrCodeForbidden, "you don't have permission to update this share")
	}

	updates := make(map[string]interface{})

	// Update password if provided
	if masterPassword != nil {
		if err := utils.ValidatePasswordStrength(*masterPassword); err != nil {
			return nil, err
		}

		fileKey, err := base64.StdEncoding.DecodeString(fileShare.UserFile.EncryptionKey)
		if err != nil {
			return nil, apperrors.Wrap(err, apperrors.ErrCodeInternal, "invalid file encryption key")
		}

		encryptedKeyData, err := utils.EncryptFileKeyWithPassword(fileKey, *masterPassword, s.cryptoConfig)
		if err != nil {
			return nil, apperrors.Wrap(err, apperrors.ErrCodeInternal, "failed to encrypt file key")
		}

		updates["encrypted_key"] = encryptedKeyData.EncryptedKey
		updates["salt"] = encryptedKeyData.Salt
		updates["iv"] = encryptedKeyData.IV
		updates["plain_text_password"] = *masterPassword // Update plain text password for display
	}

	// Update max downloads if provided
	if maxDownloads != nil {
		updates["max_downloads"] = *maxDownloads
	}

	// Update expiration if provided
	if expiresAt != nil {
		updates["expires_at"] = *expiresAt
	}

	// Update allowed usernames if provided
	if allowedUsernames != nil {
		// Manually marshal to JSON for proper storage
		usernamesJSON, err := json.Marshal(*allowedUsernames)
		if err != nil {
			return nil, apperrors.Wrap(err, apperrors.ErrCodeInternal, "failed to marshal allowed usernames")
		}
		updates["allowed_usernames"] = string(usernamesJSON)
	}

	// Update the share
	if len(updates) > 0 {
		updates["updated_at"] = time.Now()
		err = s.GetDB().GetDB().Model(&fileShare).Updates(updates).Error
		if err != nil {
			return nil, apperrors.Wrap(err, apperrors.ErrCodeInternal, "failed to update share")
		}
	}

	// Reload the share with updated data
	err = s.GetDB().GetDB().
		Preload("UserFile").
		Preload("UserFile.File").
		Where("id = ?", shareID).
		First(&fileShare).Error

	if err != nil {
		return nil, apperrors.Wrap(err, apperrors.ErrCodeInternal, "failed to reload updated share")
	}

	return &fileShare, nil
}

func (s *ShareService) GetShareByToken(token string) (*models.FileShare, error) {
	var fileShare models.FileShare
	if err := s.GetDB().GetDB().Preload("UserFile").Preload("UserFile.File").Where("share_token = ?", token).First(&fileShare).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, apperrors.New(apperrors.ErrCodeNotFound, "share not found")
		}
		return nil, apperrors.Wrap(err, apperrors.ErrCodeInternal, "failed to retrieve share")
	}

	if fileShare.ExpiresAt != nil && time.Now().After(*fileShare.ExpiresAt) {
		return nil, apperrors.New(apperrors.ErrCodeValidation, "share has expired")
	}

	if fileShare.MaxDownloads != -1 && fileShare.DownloadCount >= fileShare.MaxDownloads {
		return nil, apperrors.New(apperrors.ErrCodeValidation, "download limit exceeded")
	}

	return &fileShare, nil
}

func (s *ShareService) DecryptFileKey(fileShare *models.FileShare, masterPassword string) ([]byte, error) {
	// Use envelope key decryption for new shares
	if fileShare.EnvelopeKey != "" && fileShare.EnvelopeSalt != "" && fileShare.EnvelopeIV != "" {
		// Decrypt envelope key with password
		envelopeKey, err := s.encryptionService.DecryptEnvelopeKey(fileShare.EnvelopeKey, fileShare.EnvelopeSalt, fileShare.EnvelopeIV, masterPassword)
		if err != nil {
			return nil, apperrors.Wrap(err, apperrors.ErrCodeInternal, "failed to decrypt envelope key")
		}

		// Decrypt file key with envelope key
		fileKey, err := s.encryptionService.DecryptFileKey(fileShare.EncryptedKey, fileShare.IV, envelopeKey)
		if err != nil {
			return nil, apperrors.Wrap(err, apperrors.ErrCodeInternal, "failed to decrypt file key")
		}

		return fileKey, nil
	}

	// Fallback to legacy decryption for backward compatibility
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

func (s *ShareService) IncrementDownloadCount(shareID uint) error {
	if err := s.GetDB().GetDB().Model(&models.FileShare{}).Where("id = ?", shareID).Update("download_count", gorm.Expr("download_count + 1")).Error; err != nil {
		return apperrors.Wrap(err, apperrors.ErrCodeInternal, "failed to increment download count")
	}
	return nil
}

func (s *ShareService) DeleteShare(userID, shareID uint) error {
	var fileShare models.FileShare
	if err := s.GetDB().GetDB().Preload("UserFile").First(&fileShare, shareID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return apperrors.New(apperrors.ErrCodeNotFound, "share not found")
		}
		return apperrors.Wrap(err, apperrors.ErrCodeInternal, "failed to retrieve share")
	}

	if err := s.ValidateOwnership(&models.UserFile{}, fileShare.UserFileID, userID); err != nil {
		return err
	}

	if err := s.GetDB().GetDB().Delete(&fileShare).Error; err != nil {
		return apperrors.Wrap(err, apperrors.ErrCodeInternal, "failed to delete share")
	}

	if err := s.GetDB().GetDB().Model(&models.UserFile{}).Where("id = ?", fileShare.UserFileID).Update("share_count", gorm.Expr("CASE WHEN share_count > 0 THEN share_count - 1 ELSE 0 END")).Error; err != nil {
		return apperrors.Wrap(err, apperrors.ErrCodeInternal, "failed to update share count")
	}

	var shareCount int64
	s.GetDB().GetDB().Model(&models.FileShare{}).Where("user_file_id = ?", fileShare.UserFileID).Count(&shareCount)
	if shareCount == 0 {
		if err := s.GetDB().GetDB().Model(&models.UserFile{}).Where("id = ?", fileShare.UserFileID).Update("is_shared", false).Error; err != nil {
			return apperrors.Wrap(err, apperrors.ErrCodeInternal, "failed to update file share status")
		}
	}

	return nil
}

func (s *ShareService) GetUserShares(userID uint) ([]*models.FileShare, error) {
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

func (s *ShareService) encryptSharePassword(password string) (encryptedPassword string, iv string, err error) {
	return utils.EncryptSharePassword(password, s.sharePasswordKey)
}

func (s *ShareService) decryptSharePassword(encryptedPassword, iv string) (string, error) {
	return utils.DecryptSharePassword(encryptedPassword, iv, s.sharePasswordKey)
}

func (s *ShareService) generateShareToken() (string, error) {
	const tokenLength = 32
	tokenBytes := make([]byte, tokenLength)

	for {
		if _, err := rand.Read(tokenBytes); err != nil {
			return "", apperrors.Wrap(err, apperrors.ErrCodeInternal, "failed to generate token")
		}

		token := hex.EncodeToString(tokenBytes)

		var count int64
		if err := s.GetDB().GetDB().Model(&models.FileShare{}).Where("share_token = ?", token).Count(&count).Error; err != nil {
			return "", apperrors.Wrap(err, apperrors.ErrCodeInternal, "failed to check token uniqueness")
		}

		if count == 0 {
			return token, nil
		}
	}
}

//================================================================================
// Share Link Generation
//================================================================================

func (s *ShareService) GenerateShareLink(fileShare *models.FileShare) (string, error) {
	if fileShare == nil {
		return "", apperrors.New(apperrors.ErrCodeValidation, "file share cannot be nil")
	}

	shareURL := fmt.Sprintf("%s/v1/share/%s", s.baseURL, fileShare.ShareToken)

	if _, err := url.Parse(shareURL); err != nil {
		return "", apperrors.Wrap(err, apperrors.ErrCodeInternal, "failed to generate valid share URL")
	}

	return shareURL, nil
}

func (s *ShareService) ValidateShareToken(token string) (*models.FileShare, error) {
	if token == "" {
		return nil, apperrors.New(apperrors.ErrCodeValidation, "share token cannot be empty")
	}

	if len(token) != 64 {
		return nil, apperrors.New(apperrors.ErrCodeValidation, "invalid share token format")
	}

	if _, err := hex.DecodeString(token); err != nil {
		return nil, apperrors.New(apperrors.ErrCodeValidation, "invalid share token format")
	}

	var fileShare models.FileShare
	if err := s.GetDB().GetDB().Preload("UserFile").Preload("UserFile.File").Where("share_token = ?", token).First(&fileShare).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, apperrors.New(apperrors.ErrCodeNotFound, "share not found")
		}
		return nil, apperrors.Wrap(err, apperrors.ErrCodeInternal, "failed to retrieve share")
	}

	if s.IsExpired(&fileShare) {
		return nil, apperrors.New(apperrors.ErrCodeValidation, "share has expired")
	}

	if s.IsDownloadLimitReached(&fileShare) {
		return nil, apperrors.New(apperrors.ErrCodeValidation, "download limit exceeded")
	}

	return &fileShare, nil
}

func (s *ShareService) GetShareMetadata(token string) (*ShareMetadata, error) {
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

func (s *ShareService) IsExpired(fileShare *models.FileShare) bool {
	if fileShare.ExpiresAt == nil {
		return false
	}
	return time.Now().After(*fileShare.ExpiresAt)
}

func (s *ShareService) IsDownloadLimitReached(fileShare *models.FileShare) bool {
	if fileShare.MaxDownloads == -1 {
		return false
	}
	return fileShare.DownloadCount >= fileShare.MaxDownloads
}

func (s *ShareService) GetRemainingDownloads(fileShare *models.FileShare) int {
	if fileShare.MaxDownloads == -1 {
		return -1 // Unlimited
	}
	remaining := fileShare.MaxDownloads - fileShare.DownloadCount
	if remaining < 0 {
		return 0
	}
	return remaining
}

func (s *ShareService) GetShareExpiryInfo(fileShare *models.FileShare) *ShareExpiryInfo {
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

func (s *ShareService) GenerateSecureToken() (string, error) {
	const tokenLength = 32
	tokenBytes := make([]byte, tokenLength)

	if _, err := rand.Read(tokenBytes); err != nil {
		return "", apperrors.Wrap(err, apperrors.ErrCodeInternal, "failed to generate secure token")
	}

	return hex.EncodeToString(tokenBytes), nil
}

func (s *ShareService) ValidateShareURL(shareURL string) (string, error) {
	_, err := url.Parse(shareURL)
	if err != nil {
		return "", apperrors.Wrap(err, apperrors.ErrCodeValidation, "invalid share URL format")
	}

	expectedPrefix := s.baseURL + "/v1/share/"
	if !strings.HasPrefix(shareURL, expectedPrefix) {
		return "", apperrors.New(apperrors.ErrCodeValidation, "invalid share URL format")
	}

	token := strings.TrimPrefix(shareURL, expectedPrefix)
	if token == "" {
		return "", apperrors.New(apperrors.ErrCodeValidation, "share token missing from URL")
	}

	return token, nil
}

//================================================================================
// Access Control & Rate Limiting
//================================================================================

func (s *ShareService) ValidateAccess(attempt *AccessAttempt) (*models.FileShare, error) {
	if !s.rateLimiter.Allow(attempt.IPAddress, attempt.Token) {
		return nil, apperrors.New(apperrors.ErrCodeValidation, "rate limit exceeded - too many access attempts")
	}

	var fileShare models.FileShare
	if err := s.GetDB().GetDB().Preload("UserFile").Preload("UserFile.File").Where("share_token = ?", attempt.Token).First(&fileShare).Error; err != nil {
		s.logAccessAttempt(&fileShare, attempt, false, "share not found")
		return nil, apperrors.New(apperrors.ErrCodeNotFound, "share not found")
	}

	if s.IsExpired(&fileShare) {
		s.logAccessAttempt(&fileShare, attempt, false, "share expired")
		return nil, apperrors.New(apperrors.ErrCodeValidation, "share has expired")
	}

	if s.IsDownloadLimitReached(&fileShare) {
		s.logAccessAttempt(&fileShare, attempt, false, "download limit exceeded")
		return nil, apperrors.New(apperrors.ErrCodeValidation, "download limit exceeded")
	}

	s.logAccessAttempt(&fileShare, attempt, true, "")

	return &fileShare, nil
}

func (s *ShareService) LogSuccessfulDownload(fileShareID uint, attempt *AccessAttempt) error {
	if err := s.GetDB().GetDB().Model(&models.FileShare{}).Where("id = ?", fileShareID).Update("download_count", gorm.Expr("download_count + 1")).Error; err != nil {
		return apperrors.Wrap(err, apperrors.ErrCodeInternal, "failed to increment download count")
	}

	attempt.Success = true
	attempt.FailureReason = ""
	s.logAccessAttemptByID(fileShareID, attempt)

	return nil
}

func (s *ShareService) LogFailedDownload(fileShareID uint, attempt *AccessAttempt, reason string) {
	attempt.Success = false
	attempt.FailureReason = reason
	s.logAccessAttemptByID(fileShareID, attempt)
}

func (s *ShareService) IsRateLimited(ipAddress, token string) bool {
	return !s.rateLimiter.Allow(ipAddress, token)
}

func (s *ShareService) GetAccessStats(shareID uint) (*AccessStats, error) {
	var stats AccessStats

	if err := s.GetDB().GetDB().Model(&models.ShareAccessLog{}).Where("file_share_id = ?", shareID).Count(&stats.TotalAttempts).Error; err != nil {
		return nil, apperrors.Wrap(err, apperrors.ErrCodeInternal, "failed to get total attempts")
	}

	if err := s.GetDB().GetDB().Model(&models.ShareAccessLog{}).Where("file_share_id = ? AND success = true", shareID).Count(&stats.SuccessfulAttempts).Error; err != nil {
		return nil, apperrors.Wrap(err, apperrors.ErrCodeInternal, "failed to get successful attempts")
	}

	if err := s.GetDB().GetDB().Model(&models.ShareAccessLog{}).Where("file_share_id = ? AND success = false", shareID).Count(&stats.FailedAttempts).Error; err != nil {
		return nil, apperrors.Wrap(err, apperrors.ErrCodeInternal, "failed to get failed attempts")
	}

	if err := s.GetDB().GetDB().Model(&models.ShareAccessLog{}).Where("file_share_id = ? AND attempted_at >= ?", shareID, time.Now().Add(-24*time.Hour)).Count(&stats.RecentAttempts).Error; err != nil {
		return nil, apperrors.Wrap(err, apperrors.ErrCodeInternal, "failed to get recent attempts")
	}

	if err := s.GetDB().GetDB().Model(&models.ShareAccessLog{}).Where("file_share_id = ?", shareID).Select("count(distinct ip_address)").Scan(&stats.UniqueIPs).Error; err != nil {
		return nil, apperrors.Wrap(err, apperrors.ErrCodeInternal, "failed to get unique IPs")
	}

	return &stats, nil
}

func (s *ShareService) CleanOldLogs(maxAge time.Duration) error {
	cutoffTime := time.Now().Add(-maxAge)

	if err := s.GetDB().GetDB().Where("attempted_at < ?", cutoffTime).Delete(&models.ShareAccessLog{}).Error; err != nil {
		return apperrors.Wrap(err, apperrors.ErrCodeInternal, "failed to clean old access logs")
	}

	return nil
}

func (s *ShareService) BlockIP(ipAddress string, reason string, duration time.Duration) error {
	_ = time.Now().Add(duration)
	return nil
}

func (s *ShareService) IsIPBlocked(ipAddress string) bool {
	return false
}

func (s *ShareService) logAccessAttempt(fileShare *models.FileShare, attempt *AccessAttempt, success bool, failureReason string) {
	if fileShare == nil {
		return
	}

	accessLog := &models.ShareAccessLog{
		FileShareID:   fileShare.ID,
		IPAddress:     s.sanitizeIPAddress(attempt.IPAddress),
		UserAgent:     s.sanitizeUserAgent(attempt.UserAgent),
		AttemptedAt:   time.Now(),
		Success:       success,
		FailureReason: failureReason,
	}

	s.GetDB().GetDB().Create(accessLog)
}

func (s *ShareService) logAccessAttemptByID(fileShareID uint, attempt *AccessAttempt) {
	accessLog := &models.ShareAccessLog{
		FileShareID:   fileShareID,
		IPAddress:     s.sanitizeIPAddress(attempt.IPAddress),
		UserAgent:     s.sanitizeUserAgent(attempt.UserAgent),
		AttemptedAt:   time.Now(),
		Success:       attempt.Success,
		FailureReason: attempt.FailureReason,
	}

	s.GetDB().GetDB().Create(accessLog)
}

func (s *ShareService) sanitizeIPAddress(ip string) string {
	if ip == "" {
		return "unknown"
	}

	if parsedIP := net.ParseIP(ip); parsedIP != nil {
		return parsedIP.String()
	}

	return "invalid"
}

func (s *ShareService) sanitizeUserAgent(userAgent string) string {
	if userAgent == "" {
		return "unknown"
	}

	if len(userAgent) > 500 {
		userAgent = userAgent[:500]
	}

	userAgent = strings.Map(func(r rune) rune {
		if r < 32 || r == 127 {
			return -1
		}
		return r
	}, userAgent)

	return userAgent
}

//================================================================================
// Helper Structs & Rate Limiter
//================================================================================

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

type ShareExpiryInfo struct {
	Expires         bool           `json:"expires"`
	Expired         bool           `json:"expired"`
	ExpiresAt       *time.Time     `json:"expires_at"`
	TimeUntilExpiry *time.Duration `json:"time_until_expiry"`
}

type AccessAttempt struct {
	IPAddress     string
	UserAgent     string
	Token         string
	Success       bool
	FailureReason string
}

type AccessStats struct {
	TotalAttempts      int64 `json:"total_attempts"`
	SuccessfulAttempts int64 `json:"successful_attempts"`
	FailedAttempts     int64 `json:"failed_attempts"`
	RecentAttempts     int64 `json:"recent_attempts"`
	UniqueIPs          int64 `json:"unique_ips"`
}

type RateLimiter struct {
	buckets map[string]*TokenBucket
	mutex   sync.RWMutex
}

type TokenBucket struct {
	tokens     float64
	lastRefill time.Time
}

func NewRateLimiter() *RateLimiter {
	return &RateLimiter{
		buckets: make(map[string]*TokenBucket),
	}
}

func (rl *RateLimiter) Allow(ipAddress, token string) bool {
	key := ipAddress + ":" + token

	rl.mutex.Lock()
	defer rl.mutex.Unlock()

	bucket, exists := rl.buckets[key]
	if !exists {
		rl.buckets[key] = &TokenBucket{
			tokens:     9,
			lastRefill: time.Now(),
		}
		return true
	}

	now := time.Now()
	timePassed := now.Sub(bucket.lastRefill)
	tokensToAdd := timePassed.Minutes() * 10

	bucket.tokens = min(bucket.tokens+tokensToAdd, 10)
	bucket.lastRefill = now

	if bucket.tokens >= 1 {
		bucket.tokens--
		return true
	}

	return false
}

func min(a, b float64) float64 {
	if a < b {
		return a
	}
	return b
}

//================================================================================
// Shared With Me Functionality
//================================================================================

func (s *ShareService) GetSharedWithMeFiles(userID uint) ([]*SharedWithMeFile, error) {
	var sharedAccess []models.SharedFileAccess

	// Get all shared files accessed by this user
	err := s.GetDB().GetDB().
		Preload("FileShare").
		Preload("FileShare.UserFile").
		Preload("FileShare.UserFile.File").
		Preload("FileShare.UserFile.User").
		Where("user_id = ?", userID).
		Find(&sharedAccess).Error

	if err != nil {
		return nil, apperrors.Wrap(err, apperrors.ErrCodeInternal, "failed to get shared files")
	}

	var result []*SharedWithMeFile
	for _, access := range sharedAccess {
		if access.FileShare.UserFile.DeletedAt.Valid {
			continue // Skip deleted files
		}

		// Check if share is still valid
		if s.IsExpired(&access.FileShare) {
			continue // Skip expired shares
		}

		sharedFile := &SharedWithMeFile{
			ID:            fmt.Sprintf("%d", access.ID),
			Filename:      access.FileShare.UserFile.Filename,
			MimeType:      access.FileShare.UserFile.MimeType,
			SizeBytes:     int(access.FileShare.UserFile.File.SizeBytes),
			ShareToken:    access.ShareToken,
			SharedBy:      &access.FileShare.UserFile.User,
			FirstAccessAt: access.FirstAccessAt,
			LastAccessAt:  access.LastAccessAt,
			AccessCount:   access.AccessCount,
			MaxDownloads:  access.FileShare.MaxDownloads,
			DownloadCount: access.FileShare.DownloadCount,
			ExpiresAt:     access.FileShare.ExpiresAt,
			CreatedAt:     access.FileShare.CreatedAt,
		}

		result = append(result, sharedFile)
	}

	return result, nil
}

func (s *ShareService) RecordUserAccess(userID *uint, fileShareID uint, shareToken, ipAddress, userAgent string) error {
	// Check if user access record already exists
	var existingAccess models.SharedFileAccess
	err := s.GetDB().GetDB().Where("user_id = ? AND file_share_id = ?", userID, fileShareID).First(&existingAccess).Error

	if err == gorm.ErrRecordNotFound {
		// Create new access record
		newAccess := models.SharedFileAccess{
			UserID:        userID,
			FileShareID:   fileShareID,
			ShareToken:    shareToken,
			FirstAccessAt: time.Now(),
			LastAccessAt:  time.Now(),
			AccessCount:   1,
			IPAddress:     ipAddress,
			UserAgent:     userAgent,
		}

		return s.GetDB().GetDB().Create(&newAccess).Error
	} else if err != nil {
		return err
	} else {
		// Update existing access record
		return s.GetDB().GetDB().Model(&existingAccess).Updates(map[string]interface{}{
			"last_access_at": time.Now(),
			"access_count":   gorm.Expr("access_count + 1"),
			"ip_address":     ipAddress,
			"user_agent":     userAgent,
		}).Error
	}
}

// SharedWithMeFile represents a file shared with a user
type SharedWithMeFile struct {
	ID            string       `json:"id"`
	Filename      string       `json:"filename"`
	MimeType      string       `json:"mime_type"`
	SizeBytes     int          `json:"size_bytes"`
	ShareToken    string       `json:"share_token"`
	SharedBy      *models.User `json:"shared_by"`
	FirstAccessAt time.Time    `json:"first_access_at"`
	LastAccessAt  time.Time    `json:"last_access_at"`
	AccessCount   int          `json:"access_count"`
	MaxDownloads  int          `json:"max_downloads"`
	DownloadCount int          `json:"download_count"`
	ExpiresAt     *time.Time   `json:"expires_at"`
	CreatedAt     time.Time    `json:"created_at"`
}
