package config

import (
	"log"
	"os"
)

type Config struct {
	DatabaseURL    string
	MinIOEndpoint  string
	MinIOAccessKey string
	MinIOSecretKey string
	MinIOBucket    string
	JWTSecret      string
	Port           string
	GinMode        string
}

func Load() *Config {
	config := &Config{
		DatabaseURL:    getEnv("DATABASE_URL", "postgres://aegis_user:aegis_password@localhost:5432/aegis?sslmode=disable"),
		MinIOEndpoint:  getEnv("MINIO_ENDPOINT", "localhost:9000"),
		MinIOAccessKey: getEnv("MINIO_ACCESS_KEY", "minioadmin"),
		MinIOSecretKey: getEnv("MINIO_SECRET_KEY", "minioadmin123"),
		MinIOBucket:    getEnv("MINIO_BUCKET", "aegis-files"),
		JWTSecret:      getEnv("JWT_SECRET", "your-super-secret-jwt-key-change-in-production"),
		Port:           getEnv("PORT", "8080"),
		GinMode:        getEnv("GIN_MODE", "debug"),
	}

	// Validate required environment variables
	if config.JWTSecret == "your-super-secret-jwt-key-change-in-production" {
		log.Println("WARNING: Using default JWT secret. Change JWT_SECRET environment variable in production!")
	}

	return config
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}
