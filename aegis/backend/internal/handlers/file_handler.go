package handlers

import (
	"fmt"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"

	"github.com/balkanid/aegis-backend/internal/database"
	"github.com/balkanid/aegis-backend/internal/middleware"
	"github.com/balkanid/aegis-backend/internal/models"
	"github.com/balkanid/aegis-backend/internal/services"
)

type FileHandler struct {
	storageService *services.StorageService
}

func NewFileHandler(storageService *services.StorageService) *FileHandler {
	return &FileHandler{
		storageService: storageService,
	}
}

func (h *FileHandler) DownloadFile(c *gin.Context) {
	// Check for token in query parameter
	tokenString := c.Query("token")
	fmt.Printf("DEBUG: Download request for file %s, token: %s\n", c.Param("id"), tokenString)
	var user *models.User
	var err error

	if tokenString != "" {
		// Validate token from query parameter
		token, err := jwt.ParseWithClaims(tokenString, &middleware.Claims{}, func(token *jwt.Token) (interface{}, error) {
			if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, jwt.ErrSignatureInvalid
			}
			// Get JWT secret from config - need to access config
			// For now, hardcode or find another way
			return []byte("super_secure_jwt_secret_key_for_development_only_12345678901234567890"), nil
		})

		if err != nil || !token.Valid {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid download token"})
			return
		}

		if claims, ok := token.Claims.(*middleware.Claims); ok {
			// Verify user still exists
			var dbUser models.User
			if err := h.storageService.db.GetDB().First(&dbUser, claims.UserID).Error; err != nil {
				c.JSON(http.StatusUnauthorized, gin.H{"error": "User not found"})
				return
			}
			user = &dbUser
		} else {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid token claims"})
			return
		}
	} else {
		// Fallback to auth middleware
		user, err = middleware.GetUserFromContext(c.Request.Context())
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
			return
		}
	}

	fileIDStr := c.Param("id")
	fileID, err := strconv.Atoi(fileIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid file ID"})
		return
	}

	// Get user file info for filename
	var userFile models.UserFile
	if err := h.storageService.db.GetDB().Preload("File").Where("id = ? AND user_id = ?", fileID, user.ID).First(&userFile).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "File not found"})
		return
	}

	// Get the file reader
	reader, mimeType, err := h.storageService.StreamFile(user.ID, uint(fileID))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get file"})
		return
	}
	defer reader.Close()

	// For simplicity, read all content (not ideal for large files, but works for now)
	var content []byte
	buf := make([]byte, 1024)
	for {
		n, err := reader.Read(buf)
		if n > 0 {
			content = append(content, buf[:n]...)
		}
		if err != nil {
			break
		}
	}

	// Set headers
	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=%s", userFile.Filename))
	c.Header("Content-Type", mimeType)
	c.Header("Content-Length", strconv.Itoa(len(content)))

	// Send the file
	c.Data(http.StatusOK, mimeType, content)
}
