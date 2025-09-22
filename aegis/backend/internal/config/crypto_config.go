package config

import (
	"encoding/base64"
	"fmt"
	"os"
	"strconv"
)

// CryptoConfig holds configuration for all cryptographic operations
type CryptoConfig struct {
	// PBKDF2 configuration
	PBKDF2Iterations int
	KeyLength        int
	SaltLength       int
	
	// AES-GCM configuration
	AESGCMIVLength int
	
	// NaCl secretbox configuration
	SecretboxKeyLength   int
	SecretboxNonceLength int
	
	// Service-wide keys (loaded from environment or generated)
	SharePasswordKey []byte
	
	// Encryption algorithms
	FileEncryptionAlgorithm string // "nacl-secretbox" or "aes-gcm"
	KeyEncryptionAlgorithm  string // "aes-gcm" for envelope encryption
}

// DefaultCryptoConfig returns the default crypto configuration
func DefaultCryptoConfig() *CryptoConfig {
	return &CryptoConfig{
		PBKDF2Iterations:        100000,
		KeyLength:               32, // 256 bits
		SaltLength:              16, // 128 bits
		AESGCMIVLength:          12, // 96 bits for AES-GCM
		SecretboxKeyLength:      32, // NaCl secretbox key length
		SecretboxNonceLength:    24, // NaCl secretbox nonce length
		SharePasswordKey:        nil, // Will be loaded/generated
		FileEncryptionAlgorithm: "nacl-secretbox",
		KeyEncryptionAlgorithm:  "aes-gcm",
	}
}

// LoadCryptoConfigFromEnv loads crypto configuration from environment variables
func LoadCryptoConfigFromEnv() *CryptoConfig {
	config := DefaultCryptoConfig()
	
	// Load PBKDF2 iterations from environment
	if iterations := os.Getenv("AEGIS_PBKDF2_ITERATIONS"); iterations != "" {
		if parsed, err := strconv.Atoi(iterations); err == nil && parsed > 0 {
			config.PBKDF2Iterations = parsed
		}
	}
	
	// Load key length from environment
	if keyLen := os.Getenv("AEGIS_KEY_LENGTH"); keyLen != "" {
		if parsed, err := strconv.Atoi(keyLen); err == nil && parsed > 0 {
			config.KeyLength = parsed
		}
	}
	
	// Load share password key from environment (base64 encoded)
	if shareKey := os.Getenv("AEGIS_SHARE_PASSWORD_KEY"); shareKey != "" {
		if decoded, err := base64.StdEncoding.DecodeString(shareKey); err == nil && len(decoded) == config.KeyLength {
			config.SharePasswordKey = decoded
		}
	}
	
	// Load file encryption algorithm preference
	if algo := os.Getenv("AEGIS_FILE_ENCRYPTION_ALGORITHM"); algo != "" {
		if algo == "nacl-secretbox" || algo == "aes-gcm" {
			config.FileEncryptionAlgorithm = algo
		}
	}
	
	return config
}

// ValidateCryptoConfig validates the crypto configuration
func ValidateCryptoConfig(config *CryptoConfig) error {
	if config.PBKDF2Iterations < 10000 {
		return fmt.Errorf("PBKDF2 iterations too low: %d (minimum 10000)", config.PBKDF2Iterations)
	}
	
	if config.KeyLength < 16 {
		return fmt.Errorf("key length too short: %d (minimum 16)", config.KeyLength)
	}
	
	if config.SaltLength < 8 {
		return fmt.Errorf("salt length too short: %d (minimum 8)", config.SaltLength)
	}
	
	if config.FileEncryptionAlgorithm != "nacl-secretbox" && config.FileEncryptionAlgorithm != "aes-gcm" {
		return fmt.Errorf("unsupported file encryption algorithm: %s", config.FileEncryptionAlgorithm)
	}
	
	if config.KeyEncryptionAlgorithm != "aes-gcm" {
		return fmt.Errorf("unsupported key encryption algorithm: %s", config.KeyEncryptionAlgorithm)
	}
	
	return nil
}

// Environment variable documentation:
//
// AEGIS_PBKDF2_ITERATIONS: Number of PBKDF2 iterations (default: 100000)
// AEGIS_KEY_LENGTH: Length of encryption keys in bytes (default: 32)
// AEGIS_SHARE_PASSWORD_KEY: Base64-encoded 32-byte key for share password encryption
// AEGIS_FILE_ENCRYPTION_ALGORITHM: File encryption algorithm ("nacl-secretbox" or "aes-gcm", default: "nacl-secretbox")
//
// Example environment setup:
// export AEGIS_PBKDF2_ITERATIONS=100000
// export AEGIS_KEY_LENGTH=32
// export AEGIS_SHARE_PASSWORD_KEY="$(openssl rand -base64 32)"
// export AEGIS_FILE_ENCRYPTION_ALGORITHM="nacl-secretbox"