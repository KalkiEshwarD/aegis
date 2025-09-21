package services

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"fmt"

	"golang.org/x/crypto/pbkdf2"
)

// KeyManagementService handles cryptographic key operations
type KeyManagementService struct{}

// NewKeyManagementService creates a new key management service
func NewKeyManagementService() *KeyManagementService {
	return &KeyManagementService{}
}

// GenerateRandomKey generates a random key of specified length
func (k *KeyManagementService) GenerateRandomKey(length int) ([]byte, error) {
	key := make([]byte, length)
	_, err := rand.Read(key)
	if err != nil {
		return nil, fmt.Errorf("failed to generate random key: %w", err)
	}
	return key, nil
}

// GenerateEnvelopeKey generates a 32-byte envelope key
func (k *KeyManagementService) GenerateEnvelopeKey() ([]byte, error) {
	return k.GenerateRandomKey(32)
}

// GenerateSalt generates a random salt
func (k *KeyManagementService) GenerateSalt() ([]byte, error) {
	return k.GenerateRandomKey(16)
}

// GenerateIV generates a random initialization vector
func (k *KeyManagementService) GenerateIV() ([]byte, error) {
	return k.GenerateRandomKey(12) // 12 bytes for GCM
}

// DeriveKeyFromPassword derives a key from password using PBKDF2
func (k *KeyManagementService) DeriveKeyFromPassword(password string, salt []byte) []byte {
	return pbkdf2.Key([]byte(password), salt, 100000, 32, sha256.New)
}

// EncodeToHex converts bytes to hex string
func (k *KeyManagementService) EncodeToHex(data []byte) string {
	return hex.EncodeToString(data)
}

// DecodeFromHex converts hex string to bytes
func (k *KeyManagementService) DecodeFromHex(data string) ([]byte, error) {
	return hex.DecodeString(data)
}
