package config

import (
	"log"
	"os"
	"strconv"
	"strings"
)

type Config struct {
	DatabaseURL        string
	MinIOEndpoint      string
	MinIOAccessKey     string
	MinIOSecretKey     string
	MinIOBucket        string
	JWTSecret          string
	Port               string
	GinMode            string
	CORSAllowedOrigins string
	BaseURL            string
}

func Load() *Config {
	config := &Config{
		DatabaseURL:        getEnvRequired("DATABASE_URL"),
		MinIOEndpoint:      getEnv("MINIO_ENDPOINT", "localhost:9000"),
		MinIOAccessKey:     getEnvRequired("MINIO_ACCESS_KEY"),
		MinIOSecretKey:     getEnvRequired("MINIO_SECRET_KEY"),
		MinIOBucket:        getEnv("MINIO_BUCKET", "aegis-files"),
		JWTSecret:          getEnvRequired("JWT_SECRET"),
		Port:               getEnv("PORT", "8080"),
		GinMode:            getEnv("GIN_MODE", "debug"),
		CORSAllowedOrigins: getEnv("CORS_ALLOWED_ORIGINS", "http://localhost:3000"),
		BaseURL:            getEnv("BASE_URL", "http://localhost:8080"),
	}

	// Validate that sensitive values are not using known insecure defaults
	validateSecureConfig(config)

	return config
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func getEnvRequired(key string) string {
	value := os.Getenv(key)
	if value == "" {
		log.Fatalf("Required environment variable %s is not set", key)
	}
	return value
}

func validateSecureConfig(config *Config) {
	// Check for known insecure defaults
	insecureDefaults := map[string]string{
		"DATABASE_URL":    "postgres://aegis_user:aegis_password@localhost:5432/aegis?sslmode=disable",
		"MINIO_ACCESS_KEY": "minioadmin",
		"MINIO_SECRET_KEY": "minioadmin123",
		"JWT_SECRET":      "your-super-secret-jwt-key-change-in-production",
	}

	for envVar, insecureValue := range insecureDefaults {
		var currentValue string
		switch envVar {
		case "DATABASE_URL":
			currentValue = config.DatabaseURL
		case "MINIO_ACCESS_KEY":
			currentValue = config.MinIOAccessKey
		case "MINIO_SECRET_KEY":
			currentValue = config.MinIOSecretKey
		case "JWT_SECRET":
			currentValue = config.JWTSecret
		}
		if currentValue == insecureValue {
			log.Fatalf("SECURITY ERROR: %s is set to insecure default value. Please set a secure value for %s", envVar, envVar)
		}
	}

	// Additional validation checks
	validateConfigValues(config)
}

func validateConfigValues(config *Config) {
	// Validate JWT secret length
	if len(config.JWTSecret) < 32 {
		log.Fatalf("SECURITY ERROR: JWT_SECRET must be at least 32 characters long for security")
	}

	// Validate MinIO endpoint format
	if config.MinIOEndpoint != "" && !strings.Contains(config.MinIOEndpoint, ":") {
		log.Printf("WARNING: MinIO endpoint '%s' does not contain a port number", config.MinIOEndpoint)
	}

	// Validate BaseURL format
	if config.BaseURL != "" {
		if !strings.HasPrefix(config.BaseURL, "http://") && !strings.HasPrefix(config.BaseURL, "https://") {
			log.Fatalf("CONFIG ERROR: BASE_URL must start with http:// or https://")
		}
	}

	// Validate CORS origins
	if config.CORSAllowedOrigins != "" {
		origins := strings.Split(config.CORSAllowedOrigins, ",")
		for _, origin := range origins {
			origin = strings.TrimSpace(origin)
			if origin != "" && !strings.HasPrefix(origin, "http://") && !strings.HasPrefix(origin, "https://") {
				log.Printf("WARNING: CORS origin '%s' does not start with http:// or https://", origin)
			}
		}
	}

	// Validate port format
	if config.Port != "" {
		if port := config.Port; port != "" {
			if _, err := strconv.Atoi(port); err != nil {
				log.Fatalf("CONFIG ERROR: PORT must be a valid number, got '%s'", port)
			}
		}
	}
}
