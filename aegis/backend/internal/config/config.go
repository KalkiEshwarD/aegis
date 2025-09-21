package config

import (
	"log"
	"os"
	"strconv"
	"strings"
)

type FilesEndpoints struct {
	Base     string
	Download string
}

type ShareEndpoints struct {
	Base   string
	Access string
}

type SharedEndpoints struct {
	Base string
}

type HealthEndpoints struct {
	Base string
}

type GraphQLEndpoints struct {
	Base string
}

type APIEndpoints struct {
	Base   string
	Files  FilesEndpoints
	Share  ShareEndpoints
	Shared SharedEndpoints
	Health HealthEndpoints
	GraphQL GraphQLEndpoints
}

type Config struct {
	DatabaseURL             string
	MinIOEndpoint           string
	MinIOAccessKey          string
	MinIOSecretKey          string
	MinIOBucket             string
	JWTSecret               string
	Port                    string
	GinMode                 string
	CORSAllowedOrigins      string
	BaseURL                 string
	RateLimitRequestsPerSecond float64
	RateLimitBurst          int
	APIEndpoints            APIEndpoints
}

func Load() *Config {
	log.Println("DEBUG: Loading configuration...")

	config := &Config{
		DatabaseURL:             getEnvRequired("DATABASE_URL"),
		MinIOEndpoint:           getEnv("MINIO_ENDPOINT", "localhost:9000"),
		MinIOAccessKey:          getEnvRequired("MINIO_ACCESS_KEY"),
		MinIOSecretKey:          getEnvRequired("MINIO_SECRET_KEY"),
		MinIOBucket:             getEnv("MINIO_BUCKET", "aegis-files"),
		JWTSecret:               getEnvRequired("JWT_SECRET"),
		Port:                    getEnv("PORT", "8080"),
		GinMode:                 getEnv("GIN_MODE", "debug"),
		CORSAllowedOrigins:      getEnv("CORS_ALLOWED_ORIGINS", "http://localhost:3000"),
		BaseURL:                 getEnv("BASE_URL", "http://localhost:8080"),
		RateLimitRequestsPerSecond: getEnvFloat("RATE_LIMIT_REQUESTS_PER_SECOND", 10.0),
		RateLimitBurst:          getEnvInt("RATE_LIMIT_BURST", 20),
		APIEndpoints: APIEndpoints{
			Base: "/v1/api",
			Files: FilesEndpoints{
				Base:     "/v1/api/files",
				Download: "/v1/api/files/:id/download",
			},
			Share: ShareEndpoints{
				Base:   "/v1/share",
				Access: "/v1/share/:token/access",
			},
			Shared: SharedEndpoints{
				Base: "/v1/shared",
			},
			Health: HealthEndpoints{
				Base: "/v1/health",
			},
			GraphQL: GraphQLEndpoints{
				Base: "/v1/graphql",
			},
		},
	}

	log.Printf("DEBUG: Configuration loaded - Port: %s, CORS Origins: %s, BaseURL: %s", config.Port, config.CORSAllowedOrigins, config.BaseURL)
	log.Printf("DEBUG: JWT Secret length: %d characters", len(config.JWTSecret))

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

func getEnvFloat(key string, defaultValue float64) float64 {
	if value := os.Getenv(key); value != "" {
		if parsed, err := strconv.ParseFloat(value, 64); err == nil {
			return parsed
		}
		log.Printf("WARNING: Invalid float value for %s: %s, using default %.2f", key, value, defaultValue)
	}
	return defaultValue
}

func getEnvInt(key string, defaultValue int) int {
	if value := os.Getenv(key); value != "" {
		if parsed, err := strconv.Atoi(value); err == nil {
			return parsed
		}
		log.Printf("WARNING: Invalid int value for %s: %s, using default %d", key, value, defaultValue)
	}
	return defaultValue
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
