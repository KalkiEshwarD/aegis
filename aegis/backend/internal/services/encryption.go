package services

import (
	"crypto/aes"
	"crypto/cipher"
	"fmt"
)

// EncryptionService handles encryption and decryption operations
type EncryptionService struct {
	keyManager *KeyManagementService
}

// NewEncryptionService creates a new encryption service
func NewEncryptionService(keyManager *KeyManagementService) *EncryptionService {
	return &EncryptionService{
		keyManager: keyManager,
	}
}

// EncryptWithAESGCM encrypts data using AES-GCM
func (e *EncryptionService) EncryptWithAESGCM(data []byte, key []byte, iv []byte) ([]byte, error) {
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
func (e *EncryptionService) DecryptWithAESGCM(ciphertext []byte, key []byte, iv []byte) ([]byte, error) {
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

// EncryptEnvelopeKey encrypts envelope key with password-derived key
func (e *EncryptionService) EncryptEnvelopeKey(envelopeKey []byte, password string) (encryptedKey, salt, iv string, err error) {
	// Generate salt and IV
	saltBytes, err := e.keyManager.GenerateSalt()
	if err != nil {
		return "", "", "", fmt.Errorf("failed to generate salt: %w", err)
	}

	ivBytes, err := e.keyManager.GenerateIV()
	if err != nil {
		return "", "", "", fmt.Errorf("failed to generate IV: %w", err)
	}

	// Derive key from password
	derivedKey := e.keyManager.DeriveKeyFromPassword(password, saltBytes)

	// Encrypt envelope key
	encryptedBytes, err := e.EncryptWithAESGCM(envelopeKey, derivedKey, ivBytes)
	if err != nil {
		return "", "", "", fmt.Errorf("failed to encrypt envelope key: %w", err)
	}

	return e.keyManager.EncodeToHex(encryptedBytes),
		e.keyManager.EncodeToHex(saltBytes),
		e.keyManager.EncodeToHex(ivBytes),
		nil
}

// DecryptEnvelopeKey decrypts envelope key with password
func (e *EncryptionService) DecryptEnvelopeKey(encryptedKey, salt, iv, password string) ([]byte, error) {
	// Decode hex strings
	encryptedBytes, err := e.keyManager.DecodeFromHex(encryptedKey)
	if err != nil {
		return nil, fmt.Errorf("failed to decode encrypted key: %w", err)
	}

	saltBytes, err := e.keyManager.DecodeFromHex(salt)
	if err != nil {
		return nil, fmt.Errorf("failed to decode salt: %w", err)
	}

	ivBytes, err := e.keyManager.DecodeFromHex(iv)
	if err != nil {
		return nil, fmt.Errorf("failed to decode IV: %w", err)
	}

	// Derive key from password
	derivedKey := e.keyManager.DeriveKeyFromPassword(password, saltBytes)

	// Decrypt envelope key
	envelopeKey, err := e.DecryptWithAESGCM(encryptedBytes, derivedKey, ivBytes)
	if err != nil {
		return nil, fmt.Errorf("failed to decrypt envelope key: %w", err)
	}

	return envelopeKey, nil
}

// EncryptFileKey encrypts file key with envelope key
func (e *EncryptionService) EncryptFileKey(fileKey []byte, envelopeKey []byte) (encryptedKey, iv string, err error) {
	// Generate IV
	ivBytes, err := e.keyManager.GenerateIV()
	if err != nil {
		return "", "", fmt.Errorf("failed to generate IV: %w", err)
	}

	// Encrypt file key
	encryptedBytes, err := e.EncryptWithAESGCM(fileKey, envelopeKey, ivBytes)
	if err != nil {
		return "", "", fmt.Errorf("failed to encrypt file key: %w", err)
	}

	return e.keyManager.EncodeToHex(encryptedBytes),
		e.keyManager.EncodeToHex(ivBytes),
		nil
}

// DecryptFileKey decrypts file key with envelope key
func (e *EncryptionService) DecryptFileKey(encryptedKey, iv string, envelopeKey []byte) ([]byte, error) {
	// Decode hex strings
	encryptedBytes, err := e.keyManager.DecodeFromHex(encryptedKey)
	if err != nil {
		return nil, fmt.Errorf("failed to decode encrypted key: %w", err)
	}

	ivBytes, err := e.keyManager.DecodeFromHex(iv)
	if err != nil {
		return nil, fmt.Errorf("failed to decode IV: %w", err)
	}

	// Decrypt file key
	fileKey, err := e.DecryptWithAESGCM(encryptedBytes, envelopeKey, ivBytes)
	if err != nil {
		return nil, fmt.Errorf("failed to decrypt file key: %w", err)
	}

	return fileKey, nil
}
