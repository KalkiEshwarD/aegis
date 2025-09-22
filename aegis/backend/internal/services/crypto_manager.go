package services

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"fmt"

	"golang.org/x/crypto/nacl/secretbox"
	"golang.org/x/crypto/pbkdf2"

	"github.com/balkanid/aegis-backend/internal/config"
	apperrors "github.com/balkanid/aegis-backend/internal/errors"
)

// CryptoManager provides a centralized interface for all cryptographic operations
// It consolidates encryption, decryption, key management, and crypto utilities
type CryptoManager struct {
	config *config.CryptoConfig
}

// EncryptedKeyData represents encrypted key data with metadata
type EncryptedKeyData struct {
	EncryptedKey string `json:"encrypted_key"`
	Salt         string `json:"salt"`
	IV           string `json:"iv"`
}

// FileEncryptionResult represents the result of file encryption
type FileEncryptionResult struct {
	EncryptedData []byte
	Nonce         []byte
}

// NewCryptoManager creates a new centralized crypto manager
func NewCryptoManager() (*CryptoManager, error) {
	// Load configuration from environment or use defaults
	cryptoConfig := config.LoadCryptoConfigFromEnv()

	// Validate configuration
	if err := config.ValidateCryptoConfig(cryptoConfig); err != nil {
		return nil, fmt.Errorf("invalid crypto configuration: %w", err)
	}

	// Generate share password key if not provided
	if cryptoConfig.SharePasswordKey == nil {
		sharePasswordKey := make([]byte, cryptoConfig.KeyLength)
		if _, err := rand.Read(sharePasswordKey); err != nil {
			return nil, fmt.Errorf("failed to generate share password key: %w", err)
		}
		cryptoConfig.SharePasswordKey = sharePasswordKey
	}

	return &CryptoManager{
		config: cryptoConfig,
	}, nil
}

// NewCryptoManagerWithConfig creates a new crypto manager with custom configuration
func NewCryptoManagerWithConfig(cryptoConfig *config.CryptoConfig) (*CryptoManager, error) {
	// Validate configuration
	if err := config.ValidateCryptoConfig(cryptoConfig); err != nil {
		return nil, fmt.Errorf("invalid crypto configuration: %w", err)
	}

	// Generate share password key if not provided
	if cryptoConfig.SharePasswordKey == nil {
		sharePasswordKey := make([]byte, cryptoConfig.KeyLength)
		if _, err := rand.Read(sharePasswordKey); err != nil {
			return nil, fmt.Errorf("failed to generate share password key: %w", err)
		}
		cryptoConfig.SharePasswordKey = sharePasswordKey
	}

	return &CryptoManager{
		config: cryptoConfig,
	}, nil
}

//================================================================================
// Key Generation and Management
//================================================================================

// GenerateRandomKey generates a cryptographically secure random key
func (c *CryptoManager) GenerateRandomKey(length int) ([]byte, error) {
	key := make([]byte, length)
	if _, err := rand.Read(key); err != nil {
		return nil, fmt.Errorf("failed to generate random key: %w", err)
	}
	return key, nil
}

// GenerateFileKey generates a 32-byte file encryption key
func (c *CryptoManager) GenerateFileKey() ([]byte, error) {
	return c.GenerateRandomKey(c.config.SecretboxKeyLength)
}

// GenerateEnvelopeKey generates a 32-byte envelope key for layered encryption
func (c *CryptoManager) GenerateEnvelopeKey() ([]byte, error) {
	return c.GenerateRandomKey(c.config.KeyLength)
}

// GenerateSalt generates a random salt for key derivation
func (c *CryptoManager) GenerateSalt() ([]byte, error) {
	return c.GenerateRandomKey(c.config.SaltLength)
}

// GenerateNonce generates a random nonce for NaCl secretbox
func (c *CryptoManager) GenerateNonce() ([]byte, error) {
	return c.GenerateRandomKey(c.config.SecretboxNonceLength)
}

// GenerateIV generates a random initialization vector for AES-GCM
func (c *CryptoManager) GenerateIV() ([]byte, error) {
	return c.GenerateRandomKey(c.config.AESGCMIVLength)
}

//================================================================================
// Password-Based Key Derivation
//================================================================================

// DeriveKeyFromPassword derives a cryptographic key from a password using PBKDF2
func (c *CryptoManager) DeriveKeyFromPassword(password string, salt []byte) []byte {
	return pbkdf2.Key([]byte(password), salt, c.config.PBKDF2Iterations, c.config.KeyLength, sha256.New)
}

// ValidatePasswordStrength validates password strength for security
func (c *CryptoManager) ValidatePasswordStrength(password string) error {
	if len(password) < 8 {
		return apperrors.New(apperrors.ErrCodeValidation, "password must be at least 8 characters long")
	}

	hasUpper := false
	hasLower := false
	hasDigit := false
	hasSpecial := false

	for _, char := range password {
		switch {
		case char >= 'A' && char <= 'Z':
			hasUpper = true
		case char >= 'a' && char <= 'z':
			hasLower = true
		case char >= '0' && char <= '9':
			hasDigit = true
		case char == '!' || char == '@' || char == '#' || char == '$' || char == '%' || char == '^' || char == '&' || char == '*':
			hasSpecial = true
		}
	}

	if !hasUpper || !hasLower || !hasDigit || !hasSpecial {
		return apperrors.New(apperrors.ErrCodeValidation, "password must contain uppercase, lowercase, digit, and special character")
	}

	return nil
}

//================================================================================
// File Encryption (NaCl Secretbox)
//================================================================================

// EncryptFile encrypts file data using NaCl secretbox (compatible with TweetNaCl frontend)
func (c *CryptoManager) EncryptFile(data []byte, key []byte) (*FileEncryptionResult, error) {
	if len(key) != c.config.SecretboxKeyLength {
		return nil, fmt.Errorf("invalid key length: expected %d, got %d", c.config.SecretboxKeyLength, len(key))
	}

	// Generate nonce
	nonce, err := c.GenerateNonce()
	if err != nil {
		return nil, fmt.Errorf("failed to generate nonce: %w", err)
	}

	// Prepare key and nonce arrays
	var secretboxKey [32]byte
	var secretboxNonce [24]byte
	copy(secretboxKey[:], key)
	copy(secretboxNonce[:], nonce)

	// Encrypt data
	encryptedData := secretbox.Seal(nil, data, &secretboxNonce, &secretboxKey)

	return &FileEncryptionResult{
		EncryptedData: encryptedData,
		Nonce:         nonce,
	}, nil
}

// DecryptFile decrypts file data using NaCl secretbox
func (c *CryptoManager) DecryptFile(encryptedData []byte, nonce []byte, key []byte) ([]byte, error) {
	if len(key) != c.config.SecretboxKeyLength {
		return nil, fmt.Errorf("invalid key length: expected %d, got %d", c.config.SecretboxKeyLength, len(key))
	}

	if len(nonce) != c.config.SecretboxNonceLength {
		return nil, fmt.Errorf("invalid nonce length: expected %d, got %d", c.config.SecretboxNonceLength, len(nonce))
	}

	// Prepare key and nonce arrays
	var secretboxKey [32]byte
	var secretboxNonce [24]byte
	copy(secretboxKey[:], key)
	copy(secretboxNonce[:], nonce)

	// Decrypt data
	decryptedData, ok := secretbox.Open(nil, encryptedData, &secretboxNonce, &secretboxKey)
	if !ok {
		return nil, fmt.Errorf("failed to decrypt file data")
	}

	return decryptedData, nil
}

// DecryptFileWithNoncePrefix decrypts file data where nonce is prefixed to encrypted data
func (c *CryptoManager) DecryptFileWithNoncePrefix(encryptedDataWithNonce []byte, key []byte) ([]byte, error) {
	if len(encryptedDataWithNonce) < c.config.SecretboxNonceLength {
		return nil, fmt.Errorf("encrypted data too short: expected at least %d bytes", c.config.SecretboxNonceLength)
	}

	// Extract nonce from prefix
	nonce := encryptedDataWithNonce[:c.config.SecretboxNonceLength]
	ciphertext := encryptedDataWithNonce[c.config.SecretboxNonceLength:]

	return c.DecryptFile(ciphertext, nonce, key)
}

//================================================================================
// AES-GCM Encryption (for envelope keys and sensitive data)
//================================================================================

// EncryptWithAESGCM encrypts data using AES-GCM
func (c *CryptoManager) EncryptWithAESGCM(data []byte, key []byte, iv []byte) ([]byte, error) {
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, fmt.Errorf("failed to create AES cipher: %w", err)
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, fmt.Errorf("failed to create GCM: %w", err)
	}

	ciphertext := gcm.Seal(nil, iv, data, nil)
	return ciphertext, nil
}

// DecryptWithAESGCM decrypts data using AES-GCM
func (c *CryptoManager) DecryptWithAESGCM(ciphertext []byte, key []byte, iv []byte) ([]byte, error) {
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, fmt.Errorf("failed to create AES cipher: %w", err)
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, fmt.Errorf("failed to create GCM: %w", err)
	}

	plaintext, err := gcm.Open(nil, iv, ciphertext, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to decrypt: %w", err)
	}

	return plaintext, nil
}

//================================================================================
// Envelope Encryption (Password-Protected Key Encryption)
//================================================================================

// EncryptEnvelopeKey encrypts an envelope key with a password-derived key
func (c *CryptoManager) EncryptEnvelopeKey(envelopeKey []byte, password string) (encryptedKey, salt, iv string, err error) {
	// Generate salt and IV
	saltBytes, err := c.GenerateSalt()
	if err != nil {
		return "", "", "", fmt.Errorf("failed to generate salt: %w", err)
	}

	ivBytes, err := c.GenerateIV()
	if err != nil {
		return "", "", "", fmt.Errorf("failed to generate IV: %w", err)
	}

	// Derive key from password
	derivedKey := c.DeriveKeyFromPassword(password, saltBytes)

	// Encrypt envelope key
	encryptedBytes, err := c.EncryptWithAESGCM(envelopeKey, derivedKey, ivBytes)
	if err != nil {
		return "", "", "", fmt.Errorf("failed to encrypt envelope key: %w", err)
	}

	return c.EncodeToHex(encryptedBytes),
		c.EncodeToHex(saltBytes),
		c.EncodeToHex(ivBytes),
		nil
}

// DecryptEnvelopeKey decrypts an envelope key with a password
func (c *CryptoManager) DecryptEnvelopeKey(encryptedKey, salt, iv, password string) ([]byte, error) {
	// Decode hex strings
	encryptedBytes, err := c.DecodeFromHex(encryptedKey)
	if err != nil {
		return nil, fmt.Errorf("failed to decode encrypted key: %w", err)
	}

	saltBytes, err := c.DecodeFromHex(salt)
	if err != nil {
		return nil, fmt.Errorf("failed to decode salt: %w", err)
	}

	ivBytes, err := c.DecodeFromHex(iv)
	if err != nil {
		return nil, fmt.Errorf("failed to decode IV: %w", err)
	}

	// Derive key from password
	derivedKey := c.DeriveKeyFromPassword(password, saltBytes)

	// Decrypt envelope key
	envelopeKey, err := c.DecryptWithAESGCM(encryptedBytes, derivedKey, ivBytes)
	if err != nil {
		return nil, fmt.Errorf("failed to decrypt envelope key: %w", err)
	}

	return envelopeKey, nil
}

//================================================================================
// File Key Encryption (with Envelope Keys)
//================================================================================

// EncryptFileKey encrypts a file key with an envelope key
func (c *CryptoManager) EncryptFileKey(fileKey []byte, envelopeKey []byte) (encryptedKey, iv string, err error) {
	// Generate IV
	ivBytes, err := c.GenerateIV()
	if err != nil {
		return "", "", fmt.Errorf("failed to generate IV: %w", err)
	}

	// Encrypt file key
	encryptedBytes, err := c.EncryptWithAESGCM(fileKey, envelopeKey, ivBytes)
	if err != nil {
		return "", "", fmt.Errorf("failed to encrypt file key: %w", err)
	}

	return c.EncodeToHex(encryptedBytes),
		c.EncodeToHex(ivBytes),
		nil
}

// DecryptFileKey decrypts a file key with an envelope key
func (c *CryptoManager) DecryptFileKey(encryptedKey, iv string, envelopeKey []byte) ([]byte, error) {
	// Decode hex strings
	encryptedBytes, err := c.DecodeFromHex(encryptedKey)
	if err != nil {
		return nil, fmt.Errorf("failed to decode encrypted key: %w", err)
	}

	ivBytes, err := c.DecodeFromHex(iv)
	if err != nil {
		return nil, fmt.Errorf("failed to decode IV: %w", err)
	}

	// Decrypt file key
	fileKey, err := c.DecryptWithAESGCM(encryptedBytes, envelopeKey, ivBytes)
	if err != nil {
		return nil, fmt.Errorf("failed to decrypt file key: %w", err)
	}

	return fileKey, nil
}

//================================================================================
// Share Password Encryption (for secure storage)
//================================================================================

// EncryptSharePassword encrypts a share password for secure storage
func (c *CryptoManager) EncryptSharePassword(password string) (string, string, error) {
	// Generate IV
	iv, err := c.GenerateIV()
	if err != nil {
		return "", "", fmt.Errorf("failed to generate IV: %w", err)
	}

	// Encrypt password with service key
	encryptedBytes, err := c.EncryptWithAESGCM([]byte(password), c.config.SharePasswordKey, iv)
	if err != nil {
		return "", "", fmt.Errorf("failed to encrypt password: %w", err)
	}

	return base64.StdEncoding.EncodeToString(encryptedBytes),
		base64.StdEncoding.EncodeToString(iv),
		nil
}

// DecryptSharePassword decrypts a stored share password
func (c *CryptoManager) DecryptSharePassword(encryptedPassword, iv string) (string, error) {
	// Decode base64 strings
	encryptedBytes, err := base64.StdEncoding.DecodeString(encryptedPassword)
	if err != nil {
		return "", fmt.Errorf("failed to decode encrypted password: %w", err)
	}

	ivBytes, err := base64.StdEncoding.DecodeString(iv)
	if err != nil {
		return "", fmt.Errorf("failed to decode IV: %w", err)
	}

	// Decrypt password
	passwordBytes, err := c.DecryptWithAESGCM(encryptedBytes, c.config.SharePasswordKey, ivBytes)
	if err != nil {
		return "", fmt.Errorf("failed to decrypt password: %w", err)
	}

	return string(passwordBytes), nil
}

//================================================================================
// Utility Functions
//================================================================================

// EncodeToHex converts bytes to hex string
func (c *CryptoManager) EncodeToHex(data []byte) string {
	return hex.EncodeToString(data)
}

// DecodeFromHex converts hex string to bytes
func (c *CryptoManager) DecodeFromHex(hexString string) ([]byte, error) {
	return hex.DecodeString(hexString)
}

// EncodeToBase64 converts bytes to base64 string
func (c *CryptoManager) EncodeToBase64(data []byte) string {
	return base64.StdEncoding.EncodeToString(data)
}

// DecodeFromBase64 converts base64 string to bytes
func (c *CryptoManager) DecodeFromBase64(base64String string) ([]byte, error) {
	return base64.StdEncoding.DecodeString(base64String)
}

// GetConfig returns the crypto configuration
func (c *CryptoManager) GetConfig() *config.CryptoConfig {
	return c.config
}

// SetSharePasswordKey allows updating the service-wide share password key
// This should only be used during initialization or key rotation
func (c *CryptoManager) SetSharePasswordKey(key []byte) error {
	if len(key) != c.config.KeyLength {
		return fmt.Errorf("invalid key length: expected %d, got %d", c.config.KeyLength, len(key))
	}
	c.config.SharePasswordKey = make([]byte, len(key))
	copy(c.config.SharePasswordKey, key)
	return nil
}

//================================================================================
// Legacy Password-Based File Key Encryption (for backward compatibility)
//================================================================================

// EncryptFileKeyWithPassword encrypts a file key with a password (legacy method)
func (c *CryptoManager) EncryptFileKeyWithPassword(fileKey []byte, password string) (*EncryptedKeyData, error) {
	// Generate salt
	salt, err := c.GenerateSalt()
	if err != nil {
		return nil, err
	}

	// Derive key from password
	derivedKey := c.DeriveKeyFromPassword(password, salt)

	// Generate IV
	iv, err := c.GenerateIV()
	if err != nil {
		return nil, err
	}

	// Encrypt file key
	encryptedBytes, err := c.EncryptWithAESGCM(fileKey, derivedKey, iv)
	if err != nil {
		return nil, err
	}

	return &EncryptedKeyData{
		EncryptedKey: c.EncodeToBase64(encryptedBytes),
		Salt:         c.EncodeToBase64(salt),
		IV:           c.EncodeToBase64(iv),
	}, nil
}

// DecryptFileKeyWithPassword decrypts a file key with a password (legacy method)
func (c *CryptoManager) DecryptFileKeyWithPassword(encryptedKeyData *EncryptedKeyData, password string) ([]byte, error) {
	// Decode base64 strings
	encryptedBytes, err := c.DecodeFromBase64(encryptedKeyData.EncryptedKey)
	if err != nil {
		return nil, err
	}

	salt, err := c.DecodeFromBase64(encryptedKeyData.Salt)
	if err != nil {
		return nil, err
	}

	iv, err := c.DecodeFromBase64(encryptedKeyData.IV)
	if err != nil {
		return nil, err
	}

	// Derive key from password
	derivedKey := c.DeriveKeyFromPassword(password, salt)

	// Decrypt file key
	fileKey, err := c.DecryptWithAESGCM(encryptedBytes, derivedKey, iv)
	if err != nil {
		return nil, err
	}

	return fileKey, nil
}
