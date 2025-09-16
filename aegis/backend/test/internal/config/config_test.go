package config_test

import (
	"os"
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/balkanid/aegis-backend/internal/config"
)

func TestLoad_WithDefaultValues(t *testing.T) {
	// Clear all relevant environment variables
	envVars := []string{
		"DATABASE_URL", "MINIO_ENDPOINT", "MINIO_ACCESS_KEY", "MINIO_SECRET_KEY",
		"MINIO_BUCKET", "JWT_SECRET", "PORT", "GIN_MODE",
	}
	
	originalValues := make(map[string]string)
	for _, envVar := range envVars {
		if value, exists := os.LookupEnv(envVar); exists {
			originalValues[envVar] = value
		}
		os.Unsetenv(envVar)
	}
	
	defer func() {
		// Restore original values
		for key, value := range originalValues {
			os.Setenv(key, value)
		}
		for _, envVar := range envVars {
			if _, exists := originalValues[envVar]; !exists {
				os.Unsetenv(envVar)
			}
		}
	}()
	
	cfg := config.Load()
	
	assert.Equal(t, "postgres://aegis_user:aegis_password@localhost:5432/aegis?sslmode=disable", cfg.DatabaseURL)
	assert.Equal(t, "localhost:9000", cfg.MinIOEndpoint)
	assert.Equal(t, "minioadmin", cfg.MinIOAccessKey)
	assert.Equal(t, "minioadmin123", cfg.MinIOSecretKey)
	assert.Equal(t, "aegis-files", cfg.MinIOBucket)
	assert.Equal(t, "your-super-secret-jwt-key-change-in-production", cfg.JWTSecret)
	assert.Equal(t, "8080", cfg.Port)
	assert.Equal(t, "debug", cfg.GinMode)
}

func TestLoad_WithEnvironmentVariables(t *testing.T) {
	// Store original values
	envVars := []string{
		"DATABASE_URL", "MINIO_ENDPOINT", "MINIO_ACCESS_KEY", "MINIO_SECRET_KEY",
		"MINIO_BUCKET", "JWT_SECRET", "PORT", "GIN_MODE",
	}
	
	originalValues := make(map[string]string)
	for _, envVar := range envVars {
		if value, exists := os.LookupEnv(envVar); exists {
			originalValues[envVar] = value
		}
	}
	
	defer func() {
		// Restore original values
		for _, envVar := range envVars {
			if value, exists := originalValues[envVar]; exists {
				os.Setenv(envVar, value)
			} else {
				os.Unsetenv(envVar)
			}
		}
	}()
	
	// Set custom environment variables
	os.Setenv("DATABASE_URL", "postgres://test:test@testhost:5432/testdb")
	os.Setenv("MINIO_ENDPOINT", "testminio:9000")
	os.Setenv("MINIO_ACCESS_KEY", "testaccess")
	os.Setenv("MINIO_SECRET_KEY", "testsecret")
	os.Setenv("MINIO_BUCKET", "test-bucket")
	os.Setenv("JWT_SECRET", "test-jwt-secret")
	os.Setenv("PORT", "3000")
	os.Setenv("GIN_MODE", "release")
	
	cfg := config.Load()
	
	assert.Equal(t, "postgres://test:test@testhost:5432/testdb", cfg.DatabaseURL)
	assert.Equal(t, "testminio:9000", cfg.MinIOEndpoint)
	assert.Equal(t, "testaccess", cfg.MinIOAccessKey)
	assert.Equal(t, "testsecret", cfg.MinIOSecretKey)
	assert.Equal(t, "test-bucket", cfg.MinIOBucket)
	assert.Equal(t, "test-jwt-secret", cfg.JWTSecret)
	assert.Equal(t, "3000", cfg.Port)
	assert.Equal(t, "release", cfg.GinMode)
}

func TestLoad_PartialEnvironmentVariables(t *testing.T) {
	// Store original values
	envVars := []string{
		"DATABASE_URL", "MINIO_ENDPOINT", "MINIO_ACCESS_KEY", "MINIO_SECRET_KEY",
		"MINIO_BUCKET", "JWT_SECRET", "PORT", "GIN_MODE",
	}
	
	originalValues := make(map[string]string)
	for _, envVar := range envVars {
		if value, exists := os.LookupEnv(envVar); exists {
			originalValues[envVar] = value
		}
		os.Unsetenv(envVar)
	}
	
	defer func() {
		// Restore original values
		for key, value := range originalValues {
			os.Setenv(key, value)
		}
		for _, envVar := range envVars {
			if _, exists := originalValues[envVar]; !exists {
				os.Unsetenv(envVar)
			}
		}
	}()
	
	// Set only some environment variables
	os.Setenv("DATABASE_URL", "postgres://custom:custom@localhost:5432/customdb")
	os.Setenv("JWT_SECRET", "custom-jwt-secret")
	
	cfg := config.Load()
	
	// Custom values should be used
	assert.Equal(t, "postgres://custom:custom@localhost:5432/customdb", cfg.DatabaseURL)
	assert.Equal(t, "custom-jwt-secret", cfg.JWTSecret)
	
	// Default values should be used for unset variables
	assert.Equal(t, "localhost:9000", cfg.MinIOEndpoint)
	assert.Equal(t, "minioadmin", cfg.MinIOAccessKey)
	assert.Equal(t, "minioadmin123", cfg.MinIOSecretKey)
	assert.Equal(t, "aegis-files", cfg.MinIOBucket)
	assert.Equal(t, "8080", cfg.Port)
	assert.Equal(t, "debug", cfg.GinMode)
}

func TestLoad_EmptyEnvironmentVariables(t *testing.T) {
	// Store original values
	originalDB, dbExists := os.LookupEnv("DATABASE_URL")
	originalJWT, jwtExists := os.LookupEnv("JWT_SECRET")
	
	defer func() {
		if dbExists {
			os.Setenv("DATABASE_URL", originalDB)
		} else {
			os.Unsetenv("DATABASE_URL")
		}
		if jwtExists {
			os.Setenv("JWT_SECRET", originalJWT)
		} else {
			os.Unsetenv("JWT_SECRET")
		}
	}()
	
	// Set empty environment variables (should fall back to defaults)
	os.Setenv("DATABASE_URL", "")
	os.Setenv("JWT_SECRET", "")
	
	cfg := config.Load()
	
	// Should use default values even when env vars are empty
	assert.Equal(t, "postgres://aegis_user:aegis_password@localhost:5432/aegis?sslmode=disable", cfg.DatabaseURL)
	assert.Equal(t, "your-super-secret-jwt-key-change-in-production", cfg.JWTSecret)
}
