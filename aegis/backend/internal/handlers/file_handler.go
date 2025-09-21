package handlers

import (
	"fmt"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"

	"github.com/balkanid/aegis-backend/internal/errors"
	"github.com/balkanid/aegis-backend/internal/middleware"
	"github.com/balkanid/aegis-backend/internal/models"
	"github.com/balkanid/aegis-backend/internal/services"
)

type FileHandler struct {
	fileService *services.FileService
	authService *services.AuthService
}

func NewFileHandler(fileService *services.FileService, authService *services.AuthService) *FileHandler {
	return &FileHandler{
		fileService: fileService,
		authService: authService,
	}
}

func (h *FileHandler) DownloadFile(c *gin.Context) {
	// Get authenticated user from middleware context
	user, err := middleware.GetUserFromContext(c.Request.Context())
	if err != nil {
		c.Error(errors.New(errors.ErrCodeUnauthorized, "Unauthorized"))
		return
	}

	fmt.Printf("DEBUG: Download request for file %s by user %d\n", c.Param("id"), user.ID)

	fileIDStr := c.Param("id")
	fileID, err := strconv.Atoi(fileIDStr)
	if err != nil {
		c.Error(errors.New(errors.ErrCodeInvalidArgument, "Invalid file ID"))
		return
	}

	// Get user file info for filename
	var userFile models.UserFile
	if err := h.fileService.GetDB().GetDB().Preload("File").Where("id = ? AND user_id = ?", fileID, user.ID).First(&userFile).Error; err != nil {
		c.Error(errors.New(errors.ErrCodeNotFound, "File not found"))
		return
	}

	// Get the file reader
	reader, mimeType, err := h.fileService.StreamFile(user.ID, uint(fileID))
	if err != nil {
		c.Error(errors.Wrap(err, errors.ErrCodeFileDownload, "Failed to get file"))
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
