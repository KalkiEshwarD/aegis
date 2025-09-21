package middleware

import (
	"strings"

	"github.com/gin-gonic/gin"
)

// SecurityHeaders adds security headers to HTTP responses
func SecurityHeaders() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Prevent clickjacking attacks
		c.Header("X-Frame-Options", "DENY")

		// Prevent MIME type sniffing
		c.Header("X-Content-Type-Options", "nosniff")

		// Enable XSS filtering
		c.Header("X-XSS-Protection", "1; mode=block")

		// Referrer Policy
		c.Header("Referrer-Policy", "strict-origin-when-cross-origin")

		// Permissions Policy (formerly Feature Policy)
		c.Header("Permissions-Policy", "camera=(), microphone=(), geolocation=()")

		// Content Security Policy - restrict to self for API endpoints
		c.Header("Content-Security-Policy", "default-src 'self'")

		// HSTS (HTTP Strict Transport Security) - only for HTTPS
		if c.Request.TLS != nil {
			c.Header("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
		}

		c.Next()
	}
}

// ShareSecurityHeaders adds additional security headers specifically for file sharing endpoints
func ShareSecurityHeaders() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Additional headers for share endpoints
		if strings.Contains(c.Request.URL.Path, "/share") || strings.Contains(c.Request.URL.Path, "/download") {
			// Disable caching for sensitive share endpoints
			c.Header("Cache-Control", "no-cache, no-store, must-revalidate")
			c.Header("Pragma", "no-cache")
			c.Header("Expires", "0")

			// Prevent search engines from indexing share pages
			c.Header("X-Robots-Tag", "noindex, nofollow, noarchive, nosnippet")

			// Additional CSP for share endpoints
			c.Header("Content-Security-Policy", "default-src 'self'; script-src 'none'; style-src 'none'; img-src 'none'; font-src 'none'; connect-src 'none'; media-src 'none'; object-src 'none'; frame-src 'none'; form-action 'self'")
		}

		c.Next()
	}
}