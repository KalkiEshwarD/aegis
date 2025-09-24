package graph

import (
	"github.com/balkanid/aegis-backend/internal/database"
	"github.com/balkanid/aegis-backend/internal/services"
)

// This file will not be regenerated automatically.
//
// It serves as dependency injection for your app, add any dependencies you require here.

type Resolver struct {
	DB                 *database.DB
	FileService        *services.FileService
	UserService        *services.UserService
	RoomService        *services.RoomService
	AdminService       *services.AdminService
	ShareService       *services.ShareService
	KeyRotationService *services.KeyRotationService
	CryptoManager      *services.CryptoManager
}
