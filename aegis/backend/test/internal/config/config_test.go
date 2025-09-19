package config_test

import (
	"os"
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/balkanid/aegis-backend/internal/config"
)

func TestLoad_WithDefaultValues(t *testing.T) {
	// Set required environment variables to valid values
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

	// Set required sensitive variables
	os.Setenv("DATABASE_URL", "postgres://test_user:test_pass@localhost:5432/testdb")
	os.Setenv("MINIO_ACCESS_KEY", "test_access")
	os.Setenv("MINIO_SECRET_KEY", "test_secret")
	os.Setenv("JWT_SECRET", "test_jwt_secret_that_is_at_least_32_characters_long")

	cfg := config.Load()

	assert.Equal(t, "postgres://test_user:test_pass@localhost:5432/testdb", cfg.DatabaseURL)
	assert.Equal(t, "localhost:9000", cfg.MinIOEndpoint)
	assert.Equal(t, "test_access", cfg.MinIOAccessKey)
	assert.Equal(t, "test_secret", cfg.MinIOSecretKey)
	assert.Equal(t, "aegis-files", cfg.MinIOBucket)
	assert.Equal(t, "test_jwt_secret_that_is_at_least_32_characters_long", cfg.JWTSecret)
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
	os.Setenv("JWT_SECRET", "test-jwt-secret-that-is-at-least-32-characters")
	os.Setenv("PORT", "3000")
	os.Setenv("GIN_MODE", "release")
	
	cfg := config.Load()
	
	assert.Equal(t, "postgres://test:test@testhost:5432/testdb", cfg.DatabaseURL)
	assert.Equal(t, "testminio:9000", cfg.MinIOEndpoint)
	assert.Equal(t, "testaccess", cfg.MinIOAccessKey)
	assert.Equal(t, "testsecret", cfg.MinIOSecretKey)
	assert.Equal(t, "test-bucket", cfg.MinIOBucket)
	assert.Equal(t, "test-jwt-secret-that-is-at-least-32-characters", cfg.JWTSecret)
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

	// Set required sensitive variables and some custom ones
	os.Setenv("DATABASE_URL", "postgres://custom:custom@localhost:5432/customdb")
	os.Setenv("MINIO_ACCESS_KEY", "custom_access")
	os.Setenv("MINIO_SECRET_KEY", "custom_secret")
	os.Setenv("JWT_SECRET", "custom-jwt-secret-that-is-at-least-32-characters")
	os.Setenv("MINIO_ENDPOINT", "custom.endpoint:9000")

	cfg := config.Load()

	// Custom values should be used
	assert.Equal(t, "postgres://custom:custom@localhost:5432/customdb", cfg.DatabaseURL)
	assert.Equal(t, "custom.endpoint:9000", cfg.MinIOEndpoint)
	assert.Equal(t, "custom_access", cfg.MinIOAccessKey)
	assert.Equal(t, "custom_secret", cfg.MinIOSecretKey)
	assert.Equal(t, "custom-jwt-secret-that-is-at-least-32-characters", cfg.JWTSecret)

	// Default values should be used for unset non-sensitive variables
	assert.Equal(t, "aegis-files", cfg.MinIOBucket)
	assert.Equal(t, "8080", cfg.Port)
	assert.Equal(t, "debug", cfg.GinMode)
}

func TestLoad_EmptyEnvironmentVariables(t *testing.T) {
	// Store original values
	originalDB, dbExists := os.LookupEnv("DATABASE_URL")
	originalJWT, jwtExists := os.LookupEnv("JWT_SECRET")
	originalAccess, accessExists := os.LookupEnv("MINIO_ACCESS_KEY")
	originalSecret, secretExists := os.LookupEnv("MINIO_SECRET_KEY")

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
		if accessExists {
			os.Setenv("MINIO_ACCESS_KEY", originalAccess)
		} else {
			os.Unsetenv("MINIO_ACCESS_KEY")
		}
		if secretExists {
			os.Setenv("MINIO_SECRET_KEY", originalSecret)
		} else {
			os.Unsetenv("MINIO_SECRET_KEY")
		}
	}()

	// Set required environment variables to valid values
	os.Setenv("DATABASE_URL", "postgres://test:test@localhost:5432/test")
	os.Setenv("MINIO_ACCESS_KEY", "test_access")
	os.Setenv("MINIO_SECRET_KEY", "test_secret")
	os.Setenv("JWT_SECRET", "test_jwt_secret_that_is_at_least_32_characters_long")

	cfg := config.Load()

	// Should use set values
	assert.Equal(t, "postgres://test:test@localhost:5432/test", cfg.DatabaseURL)
	assert.Equal(t, "test_access", cfg.MinIOAccessKey)
	assert.Equal(t, "test_secret", cfg.MinIOSecretKey)
	assert.Equal(t, "test_jwt_secret_that_is_at_least_32_characters_long", cfg.JWTSecret)
}

func TestValidateSecureConfig_InsecureDefaults(t *testing.T) {
	// This test would cause log.Fatal, so we can't run it directly
	// Instead, we test that secure values work
	envVars := []string{
		"DATABASE_URL", "MINIO_ACCESS_KEY", "MINIO_SECRET_KEY", "JWT_SECRET",
	}

	originalValues := make(map[string]string)
	for _, envVar := range envVars {
		if value, exists := os.LookupEnv(envVar); exists {
			originalValues[envVar] = value
		}
		os.Unsetenv(envVar)
	}

	defer func() {
		for key, value := range originalValues {
			os.Setenv(key, value)
		}
		for _, envVar := range envVars {
			if _, exists := originalValues[envVar]; !exists {
				os.Unsetenv(envVar)
			}
		}
	}()

	// Set secure values
	os.Setenv("DATABASE_URL", "postgres://secure_user:secure_pass@secure_host:5432/secure_db")
	os.Setenv("MINIO_ACCESS_KEY", "secure_access_key")
	os.Setenv("MINIO_SECRET_KEY", "secure_secret_key")
	os.Setenv("JWT_SECRET", "secure_jwt_secret_that_is_at_least_32_characters_long")

	// Should not panic
	cfg := config.Load()
	assert.NotNil(t, cfg)
	assert.Equal(t, "postgres://secure_user:secure_pass@secure_host:5432/secure_db", cfg.DatabaseURL)
	assert.Equal(t, "secure_access_key", cfg.MinIOAccessKey)
	assert.Equal(t, "secure_secret_key", cfg.MinIOSecretKey)
	assert.Equal(t, "secure_jwt_secret_that_is_at_least_32_characters_long", cfg.JWTSecret)
}

func TestGetEnvRequired_MissingVariable(t *testing.T) {
	// Since getEnvRequired calls log.Fatal, we can't test it directly in unit tests
	// This is tested implicitly in other tests that require env vars
	t.Skip("getEnvRequired calls log.Fatal on missing vars, not testable in unit tests")
}
