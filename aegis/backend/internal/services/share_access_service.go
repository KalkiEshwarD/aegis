package services

import (
	"errors"
	"net"
	"strings"
	"sync"
	"time"

	apperrors "github.com/balkanid/aegis-backend/internal/errors"
	"github.com/balkanid/aegis-backend/internal/database"
	"github.com/balkanid/aegis-backend/internal/models"
)

// RateLimiter implements a simple token bucket rate limiter
type RateLimiter struct {
	buckets map[string]*TokenBucket
	mutex   sync.RWMutex
}

// TokenBucket represents a token bucket for rate limiting
type TokenBucket struct {
	tokens     float64
	lastRefill time.Time
}

// NewRateLimiter creates a new rate limiter
func NewRateLimiter() *RateLimiter {
	return &RateLimiter{
		buckets: make(map[string]*TokenBucket),
	}
}

// Allow checks if a request is allowed based on rate limiting
func (rl *RateLimiter) Allow(ipAddress, token string) bool {
	key := ipAddress + ":" + token

	rl.mutex.Lock()
	defer rl.mutex.Unlock()

	bucket, exists := rl.buckets[key]
	if !exists {
		// Create new bucket - allow initial request
		rl.buckets[key] = &TokenBucket{
			tokens:     9, // Allow 10 requests per minute initially (1 already used)
			lastRefill: time.Now(),
		}
		return true
	}

	// Refill tokens based on time passed
	now := time.Now()
	timePassed := now.Sub(bucket.lastRefill)
	tokensToAdd := timePassed.Minutes() * 10 // 10 tokens per minute

	bucket.tokens = min(bucket.tokens+tokensToAdd, 10) // Max 10 tokens
	bucket.lastRefill = now

	if bucket.tokens >= 1 {
		bucket.tokens--
		return true
	}

	return false
}

// min returns the minimum of two float64 values
func min(a, b float64) float64 {
	if a < b {
		return a
	}
	return b
}

// ShareAccessService handles access control and rate limiting for file shares
type ShareAccessService struct {
	*BaseService
	rateLimiter *RateLimiter
}

// NewShareAccessService creates a new ShareAccessService
func NewShareAccessService(db *database.DB) *ShareAccessService {
	return &ShareAccessService{
		BaseService: NewBaseService(db),
		rateLimiter: NewRateLimiter(),
	}
}

// ResetRateLimiter resets the rate limiter (for testing)
func (s *ShareAccessService) ResetRateLimiter() {
	s.rateLimiter = NewRateLimiter()
}

// AccessAttempt represents an attempt to access a shared file
type AccessAttempt struct {
	IPAddress   string
	UserAgent   string
	Token       string
	Success     bool
	FailureReason string
}

// ValidateAccess validates access to a shared file
func (s *ShareAccessService) ValidateAccess(attempt *AccessAttempt) (*models.FileShare, error) {
	// Rate limiting check
	if !s.rateLimiter.Allow(attempt.IPAddress, attempt.Token) {
		return nil, apperrors.New(apperrors.ErrCodeValidation, "rate limit exceeded - too many access attempts")
	}

	// Get the file share
	var fileShare models.FileShare
	if err := s.GetDB().GetDB().Preload("UserFile").Preload("UserFile.File").Where("share_token = ?", attempt.Token).First(&fileShare).Error; err != nil {
		s.logAccessAttempt(&fileShare, attempt, false, "share not found")
		return nil, errors.New("share not found")
	}

	// Check if share has expired
	if fileShare.ExpiresAt != nil && time.Now().After(*fileShare.ExpiresAt) {
		s.logAccessAttempt(&fileShare, attempt, false, "share expired")
		return nil, apperrors.New(apperrors.ErrCodeValidation, "share has expired")
	}

	// Check download limit
	if fileShare.MaxDownloads != -1 && fileShare.DownloadCount >= fileShare.MaxDownloads {
		s.logAccessAttempt(&fileShare, attempt, false, "download limit exceeded")
		return nil, apperrors.New(apperrors.ErrCodeValidation, "download limit exceeded")
	}

	// Log successful access attempt (password validation happens later)
	s.logAccessAttempt(&fileShare, attempt, true, "")

	return &fileShare, nil
}

// LogSuccessfulDownload logs a successful download
func (s *ShareAccessService) LogSuccessfulDownload(fileShareID uint, attempt *AccessAttempt) error {
	// Increment download count
	if err := s.GetDB().GetDB().Model(&models.FileShare{}).Where("id = ?", fileShareID).Update("download_count", s.GetDB().GetDB().Model(&models.FileShare{}).Select("download_count + 1")).Error; err != nil {
		return apperrors.Wrap(err, apperrors.ErrCodeInternal, "failed to increment download count")
	}

	// Log successful download
	attempt.Success = true
	attempt.FailureReason = ""
	s.logAccessAttemptByID(fileShareID, attempt)

	return nil
}

// LogFailedDownload logs a failed download attempt
func (s *ShareAccessService) LogFailedDownload(fileShareID uint, attempt *AccessAttempt, reason string) {
	attempt.Success = false
	attempt.FailureReason = reason
	s.logAccessAttemptByID(fileShareID, attempt)
}

// IsRateLimited checks if an IP address is currently rate limited
func (s *ShareAccessService) IsRateLimited(ipAddress, token string) bool {
	return !s.rateLimiter.Allow(ipAddress, token)
}

// GetAccessStats returns access statistics for a file share
func (s *ShareAccessService) GetAccessStats(shareID uint) (*AccessStats, error) {
	var stats AccessStats

	// Get total attempts
	if err := s.GetDB().GetDB().Model(&models.ShareAccessLog{}).Where("file_share_id = ?", shareID).Count(&stats.TotalAttempts).Error; err != nil {
		return nil, apperrors.Wrap(err, apperrors.ErrCodeInternal, "failed to get total attempts")
	}

	// Get successful attempts
	if err := s.GetDB().GetDB().Model(&models.ShareAccessLog{}).Where("file_share_id = ? AND success = true", shareID).Count(&stats.SuccessfulAttempts).Error; err != nil {
		return nil, apperrors.Wrap(err, apperrors.ErrCodeInternal, "failed to get successful attempts")
	}

	// Get failed attempts
	if err := s.GetDB().GetDB().Model(&models.ShareAccessLog{}).Where("file_share_id = ? AND success = false", shareID).Count(&stats.FailedAttempts).Error; err != nil {
		return nil, apperrors.Wrap(err, apperrors.ErrCodeInternal, "failed to get failed attempts")
	}

	// Get recent attempts (last 24 hours)
	oneDayAgo := time.Now().Add(-24 * time.Hour)
	if err := s.GetDB().GetDB().Model(&models.ShareAccessLog{}).Where("file_share_id = ? AND attempted_at >= ?", shareID, oneDayAgo).Count(&stats.RecentAttempts).Error; err != nil {
		return nil, apperrors.Wrap(err, apperrors.ErrCodeInternal, "failed to get recent attempts")
	}

	// Get unique IP addresses
	if err := s.GetDB().GetDB().Model(&models.ShareAccessLog{}).Where("file_share_id = ?", shareID).Select("count(distinct ip_address)").Scan(&stats.UniqueIPs).Error; err != nil {
		return nil, apperrors.Wrap(err, apperrors.ErrCodeInternal, "failed to get unique IPs")
	}

	return &stats, nil
}

// AccessStats contains statistics about access attempts
type AccessStats struct {
	TotalAttempts      int64 `json:"total_attempts"`
	SuccessfulAttempts int64 `json:"successful_attempts"`
	FailedAttempts     int64 `json:"failed_attempts"`
	RecentAttempts     int64 `json:"recent_attempts"`
	UniqueIPs          int64 `json:"unique_ips"`
}

// CleanOldLogs removes access logs older than the specified duration
func (s *ShareAccessService) CleanOldLogs(maxAge time.Duration) error {
	cutoffTime := time.Now().Add(-maxAge)

	if err := s.GetDB().GetDB().Where("attempted_at < ?", cutoffTime).Delete(&models.ShareAccessLog{}).Error; err != nil {
		return apperrors.Wrap(err, apperrors.ErrCodeInternal, "failed to clean old access logs")
	}

	return nil
}

// BlockIP blocks an IP address from accessing shares
func (s *ShareAccessService) BlockIP(ipAddress string, reason string, duration time.Duration) error {
	// This is a simple implementation - in production, you'd want a more sophisticated blocking system
	blockUntil := time.Now().Add(duration)

	// For now, we'll just log this action
	// In a real implementation, you'd store blocked IPs in a separate table
	_ = blockUntil
	_ = reason

	return nil
}

// IsIPBlocked checks if an IP address is blocked
func (s *ShareAccessService) IsIPBlocked(ipAddress string) bool {
	// This is a placeholder - implement actual blocking logic
	return false
}

// logAccessAttempt logs an access attempt
func (s *ShareAccessService) logAccessAttempt(fileShare *models.FileShare, attempt *AccessAttempt, success bool, failureReason string) {
	if fileShare == nil {
		return
	}

	accessLog := &models.ShareAccessLog{
		FileShareID:  fileShare.ID,
		IPAddress:    s.sanitizeIPAddress(attempt.IPAddress),
		UserAgent:    s.sanitizeUserAgent(attempt.UserAgent),
		AttemptedAt:  time.Now(),
		Success:      success,
		FailureReason: failureReason,
	}

	// Create synchronously for reliable testing
	s.GetDB().GetDB().Create(accessLog)
}

// logAccessAttemptByID logs an access attempt by share ID
func (s *ShareAccessService) logAccessAttemptByID(fileShareID uint, attempt *AccessAttempt) {
	accessLog := &models.ShareAccessLog{
		FileShareID:  fileShareID,
		IPAddress:    s.sanitizeIPAddress(attempt.IPAddress),
		UserAgent:    s.sanitizeUserAgent(attempt.UserAgent),
		AttemptedAt:  time.Now(),
		Success:      attempt.Success,
		FailureReason: attempt.FailureReason,
	}

	// Create synchronously for reliable testing
	s.GetDB().GetDB().Create(accessLog)
}

// sanitizeIPAddress sanitizes and validates an IP address
func (s *ShareAccessService) sanitizeIPAddress(ip string) string {
	if ip == "" {
		return "unknown"
	}

	// Parse and validate IP address
	if parsedIP := net.ParseIP(ip); parsedIP != nil {
		return parsedIP.String()
	}

	return "invalid"
}

// sanitizeUserAgent sanitizes a user agent string
func (s *ShareAccessService) sanitizeUserAgent(userAgent string) string {
	if userAgent == "" {
		return "unknown"
	}

	// Limit length and remove potentially dangerous characters
	if len(userAgent) > 500 {
		userAgent = userAgent[:500]
	}

	// Remove null bytes and other control characters
	userAgent = strings.Map(func(r rune) rune {
		if r < 32 || r == 127 {
			return -1
		}
		return r
	}, userAgent)

	return userAgent
}