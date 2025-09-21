package middleware

import (
	"net/http"
	"sync"

	"github.com/balkanid/aegis-backend/internal/config"
	"github.com/gin-gonic/gin"
	"golang.org/x/time/rate"
)

// RateLimiter holds the rate limiters for different IPs
type RateLimiter struct {
	limiters map[string]*rate.Limiter
	mu       sync.RWMutex
	rate     rate.Limit
	burst    int
}

// NewRateLimiter creates a new rate limiter instance
func NewRateLimiter(requestsPerSecond float64, burst int) *RateLimiter {
	return &RateLimiter{
		limiters: make(map[string]*rate.Limiter),
		rate:     rate.Limit(requestsPerSecond),
		burst:    burst,
	}
}

// getLimiter returns the rate limiter for the given IP, creating one if it doesn't exist
func (rl *RateLimiter) getLimiter(ip string) *rate.Limiter {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	limiter, exists := rl.limiters[ip]
	if !exists {
		limiter = rate.NewLimiter(rl.rate, rl.burst)
		rl.limiters[ip] = limiter
	}

	return limiter
}

// RateLimitMiddleware creates a Gin middleware for rate limiting
func RateLimitMiddleware(cfg *config.Config) gin.HandlerFunc {
	rl := NewRateLimiter(cfg.RateLimitRequestsPerSecond, cfg.RateLimitBurst)

	return func(c *gin.Context) {
		ip := c.ClientIP()
		limiter := rl.getLimiter(ip)

		if !limiter.Allow() {
			c.Header("Retry-After", "60") // Suggest retry after 60 seconds
			c.JSON(http.StatusTooManyRequests, gin.H{
				"error": "Too many requests",
				"message": "Rate limit exceeded. Please try again later.",
			})
			c.Abort()
			return
		}

		c.Next()
	}
}