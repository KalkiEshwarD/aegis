package config

import (
	"log"
	"os"
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
}
