package services

import (
	"fmt"

	"github.com/balkanid/aegis-backend/internal/database"
	"github.com/balkanid/aegis-backend/internal/models"
)

type AdminService struct{
	db *database.DB
}

func NewAdminService(db *database.DB) *AdminService {
	return &AdminService{db: db}
}

// GetDashboardStats returns system-wide statistics
func (as *AdminService) GetDashboardStats() (*AdminDashboard, error) {
	db := as.db.GetDB()

	var totalUsers int64
	var totalFiles int64
	var totalStorageUsed int64

	// Count total users
	db.Model(&models.User{}).Count(&totalUsers)

	// Count total files
	db.Model(&models.UserFile{}).Count(&totalFiles)

	// Calculate total storage used
	db.Model(&models.User{}).Select("COALESCE(SUM(used_storage), 0)").Scan(&totalStorageUsed)

	// Get recent uploads (last 10)
	var recentUploads []*models.UserFile
	db.Preload("User").Preload("File").
		Order("created_at DESC").
		Limit(10).
		Find(&recentUploads)

	// Debug logging
	fmt.Printf("DEBUG: AdminService - TotalUsers: %d, TotalFiles: %d, TotalStorageUsed: %d, RecentUploads: %d\n",
		totalUsers, totalFiles, totalStorageUsed, len(recentUploads))

	return &AdminDashboard{
		TotalUsers:       int(totalUsers),
		TotalFiles:       int(totalFiles),
		TotalStorageUsed: int(totalStorageUsed),
		RecentUploads:    recentUploads,
	}, nil
}

// AdminDashboard represents admin dashboard data
type AdminDashboard struct {
	TotalUsers       int                `json:"total_users"`
	TotalFiles       int                `json:"total_files"`
	TotalStorageUsed int                `json:"total_storage_used"`
	RecentUploads    []*models.UserFile `json:"recent_uploads"`
}
