package graph

import (
	"github.com/balkanid/aegis-backend/internal/services"
)

// This file will not be regenerated automatically.
//
// It serves as dependency injection for your app, add any dependencies you require here.

type Resolver struct {
	FileService  *services.FileService
	UserService  *services.UserService
	RoomService  *services.RoomService
	AdminService *services.AdminService
	ShareService *services.ShareService
}
