package utils

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"

	apperrors "github.com/balkanid/aegis-backend/internal/errors"
	"golang.org/x/crypto/pbkdf2"
)

// CryptoConfig holds configuration for cryptographic operations
type CryptoConfig struct {
	PBKDF2Iterations int
	KeyLength        int
	SaltLength       int
	IVLength         int
}

// DefaultCryptoConfig returns the default crypto configuration
func DefaultCryptoConfig() *CryptoConfig {
	return &CryptoConfig{
		PBKDF2Iterations: 100000,
		KeyLength:        32, // 256 bits
		SaltLength:       16, // 128 bits
		IVLength:         12, // 96 bits for AES-GCM
	}
}

// GenerateSalt generates a random salt for PBKDF2
func GenerateSalt(length int) ([]byte, error) {
	salt := make([]byte, length)
	if _, err := rand.Read(salt); err != nil {
		return nil, apperrors.Wrap(err, apperrors.ErrCodeInternal, "failed to generate salt")
	}
	return salt, nil
}

// DeriveKeyFromPassword derives a cryptographic key from a password using PBKDF2
func DeriveKeyFromPassword(password string, salt []byte, config *CryptoConfig) ([]byte, error) {
	if config == nil {
		config = DefaultCryptoConfig()
	}

	passwordBytes := []byte(password)
	derivedKey := pbkdf2.Key(passwordBytes, salt, config.PBKDF2Iterations, config.KeyLength, sha256.New)

	return derivedKey, nil
}

// EncryptFileKeyWithPassword encrypts a file encryption key with a master password
func EncryptFileKeyWithPassword(fileKey []byte, masterPassword string, config *CryptoConfig) (*EncryptedKeyData, error) {
	if config == nil {
		config = DefaultCryptoConfig()
	}

	// Generate salt and derive key
	salt, err := GenerateSalt(config.SaltLength)
	if err != nil {
		return nil, err
	}

	derivedKey, err := DeriveKeyFromPassword(masterPassword, salt, config)
	if err != nil {
		return nil, err
	}

	// Generate IV
	iv := make([]byte, config.IVLength)
	if _, err := rand.Read(iv); err != nil {
		return nil, apperrors.Wrap(err, apperrors.ErrCodeInternal, "failed to generate IV")
	}

	// Create AES-GCM cipher
	block, err := aes.NewCipher(derivedKey)
	if err != nil {
		return nil, apperrors.Wrap(err, apperrors.ErrCodeInternal, "failed to create AES cipher")
	}

	aesGCM, err := cipher.NewGCM(block)
	if err != nil {
		return nil, apperrors.Wrap(err, apperrors.ErrCodeInternal, "failed to create AES-GCM")
	}

	// Encrypt the file key
	ciphertext := aesGCM.Seal(nil, iv, fileKey, nil)

	return &EncryptedKeyData{
		EncryptedKey: base64.StdEncoding.EncodeToString(ciphertext),
		Salt:         base64.StdEncoding.EncodeToString(salt),
		IV:           base64.StdEncoding.EncodeToString(iv),
	}, nil
}

// DecryptFileKeyWithPassword decrypts a file encryption key with a master password
func DecryptFileKeyWithPassword(encryptedKeyData *EncryptedKeyData, masterPassword string, config *CryptoConfig) ([]byte, error) {
	if config == nil {
		config = DefaultCryptoConfig()
	}

	// Decode base64 strings
	salt, err := base64.StdEncoding.DecodeString(encryptedKeyData.Salt)
	if err != nil {
		return nil, apperrors.New(apperrors.ErrCodeValidation, "invalid salt encoding")
	}

	iv, err := base64.StdEncoding.DecodeString(encryptedKeyData.IV)
	if err != nil {
		return nil, apperrors.New(apperrors.ErrCodeValidation, "invalid IV encoding")
	}

	encryptedKey, err := base64.StdEncoding.DecodeString(encryptedKeyData.EncryptedKey)
	if err != nil {
		return nil, apperrors.New(apperrors.ErrCodeValidation, "invalid encrypted key encoding")
	}

	// Derive key from password
	derivedKey, err := DeriveKeyFromPassword(masterPassword, salt, config)
	if err != nil {
		return nil, err
	}

	// Create AES-GCM cipher
	block, err := aes.NewCipher(derivedKey)
	if err != nil {
		return nil, apperrors.Wrap(err, apperrors.ErrCodeInternal, "failed to create AES cipher")
	}

	aesGCM, err := cipher.NewGCM(block)
	if err != nil {
		return nil, apperrors.Wrap(err, apperrors.ErrCodeInternal, "failed to create AES-GCM")
	}

	// Decrypt the file key
	plaintext, err := aesGCM.Open(nil, iv, encryptedKey, nil)
	if err != nil {
		return nil, apperrors.New(apperrors.ErrCodeValidation, "failed to decrypt file key - invalid password or corrupted data")
	}

	return plaintext, nil
}

// EncryptedKeyData holds the encrypted key data
type EncryptedKeyData struct {
	EncryptedKey string `json:"encrypted_key"`
	Salt         string `json:"salt"`
	IV           string `json:"iv"`
}

// GenerateRandomKey generates a random encryption key
func GenerateRandomKey(length int) ([]byte, error) {
	key := make([]byte, length)
	if _, err := rand.Read(key); err != nil {
		return nil, apperrors.Wrap(err, apperrors.ErrCodeInternal, "failed to generate random key")
	}
	return key, nil
}

// ValidatePasswordStrength performs comprehensive password strength validation for share passwords
func ValidatePasswordStrength(password string) error {
	// Use stricter requirements for share passwords
	reqs := PasswordRequirements{
		MinLength:     12, // Stricter than default 8
		RequireUpper:  true,
		RequireLower:  true,
		RequireDigit:  true,
		RequireSpecial: true,
		SpecialChars:  "!@#$%^&*()_+-=[]{}|;:,.<>?",
	}

	err := ValidatePassword(password, reqs)
	if err != nil {
		return apperrors.New(apperrors.ErrCodeValidation, "password does not meet security requirements: "+err.Error())
	}

	return nil
}

// HashPassword hashes a password using PBKDF2 for storage
func HashPassword(password string, salt []byte) string {
	derivedKey := pbkdf2.Key([]byte(password), salt, 100000, 32, sha256.New)
	return base64.StdEncoding.EncodeToString(derivedKey)
}

// VerifyPassword verifies a password against a hash
func VerifyPassword(password, hashedPassword string, salt []byte) bool {
	expectedHash := HashPassword(password, salt)
	return expectedHash == hashedPassword
}