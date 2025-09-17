package handlers

import (
	"fmt"
	"net/http"
	"strconv"

	"github.com/balkanid/aegis-backend/internal/database"
	"github.com/balkanid/aegis-backend/internal/middleware"
	"github.com/balkanid/aegis-backend/internal/models"
	"github.com/balkanid/aegis-backend/internal/services"
	"github.com/gin-gonic/gin"
)

type FileHandler struct {
	fileService *services.FileService
}

func NewFileHandler(fileService *services.FileService) *FileHandler {
	return &FileHandler{
		fileService: fileService,
	}
}

func (h *FileHandler) DownloadFile(c *gin.Context) {
	// Get user from context
	user, err := middleware.GetUserFromContext(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	fileIDStr := c.Param("id")
	fileID, err := strconv.Atoi(fileIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid file ID"})
		return
	}

	// Get user file info for filename
	db := database.GetDB()
	var userFile models.UserFile
	if err := db.Preload("File").Where("id = ? AND user_id = ?", fileID, user.ID).First(&userFile).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "File not found"})
		return
	}

	// Get the file reader
	reader, mimeType, err := h.fileService.StreamFile(user.ID, uint(fileID))
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