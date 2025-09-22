// Central configuration for all cryptographic operations in the frontend
// This aligns with the backend CryptoManager configuration

export interface CryptoConfig {
  // PBKDF2 configuration
  pbkdf2Iterations: number;
  keyLength: number;
  saltLength: number;
  
  // AES-GCM configuration
  aesGcmIvLength: number;
  
  // NaCl secretbox configuration
  secretboxKeyLength: number;
  secretboxNonceLength: number;
  
  // Encryption algorithms
  fileEncryptionAlgorithm: 'nacl-secretbox' | 'aes-gcm';
  keyEncryptionAlgorithm: 'aes-gcm';
}

// Default configuration that matches backend defaults
export const DEFAULT_CRYPTO_CONFIG: CryptoConfig = {
  pbkdf2Iterations: 100000,
  keyLength: 32, // 256 bits
  saltLength: 16, // 128 bits
  aesGcmIvLength: 12, // 96 bits for AES-GCM
  secretboxKeyLength: 32, // NaCl secretbox key length
  secretboxNonceLength: 24, // NaCl secretbox nonce length
  fileEncryptionAlgorithm: 'nacl-secretbox',
  keyEncryptionAlgorithm: 'aes-gcm',
};

// Configuration that can be loaded from environment or build-time settings
export const CRYPTO_CONFIG: CryptoConfig = {
  ...DEFAULT_CRYPTO_CONFIG,
  // Override with environment-specific settings if available
  pbkdf2Iterations: process.env.REACT_APP_PBKDF2_ITERATIONS ? 
    parseInt(process.env.REACT_APP_PBKDF2_ITERATIONS) : DEFAULT_CRYPTO_CONFIG.pbkdf2Iterations,
  keyLength: process.env.REACT_APP_KEY_LENGTH ? 
    parseInt(process.env.REACT_APP_KEY_LENGTH) : DEFAULT_CRYPTO_CONFIG.keyLength,
  fileEncryptionAlgorithm: (process.env.REACT_APP_FILE_ENCRYPTION_ALGORITHM as any) || 
    DEFAULT_CRYPTO_CONFIG.fileEncryptionAlgorithm,
};

// Validation function for crypto configuration
export const validateCryptoConfig = (config: CryptoConfig): void => {
  if (config.pbkdf2Iterations < 10000) {
    throw new Error(`PBKDF2 iterations too low: ${config.pbkdf2Iterations} (minimum 10000)`);
  }
  
  if (config.keyLength < 16) {
    throw new Error(`Key length too short: ${config.keyLength} (minimum 16)`);
  }
  
  if (config.saltLength < 8) {
    throw new Error(`Salt length too short: ${config.saltLength} (minimum 8)`);
  }
  
  if (!['nacl-secretbox', 'aes-gcm'].includes(config.fileEncryptionAlgorithm)) {
    throw new Error(`Unsupported file encryption algorithm: ${config.fileEncryptionAlgorithm}`);
  }
  
  if (config.keyEncryptionAlgorithm !== 'aes-gcm') {
    throw new Error(`Unsupported key encryption algorithm: ${config.keyEncryptionAlgorithm}`);
  }
};

// Initialize and validate configuration
validateCryptoConfig(CRYPTO_CONFIG);

// Environment variable documentation:
//
// REACT_APP_PBKDF2_ITERATIONS: Number of PBKDF2 iterations (default: 100000)
// REACT_APP_KEY_LENGTH: Length of encryption keys in bytes (default: 32)
// REACT_APP_FILE_ENCRYPTION_ALGORITHM: File encryption algorithm ("nacl-secretbox" or "aes-gcm", default: "nacl-secretbox")
//
// Example environment setup:
// REACT_APP_PBKDF2_ITERATIONS=100000
// REACT_APP_KEY_LENGTH=32
// REACT_APP_FILE_ENCRYPTION_ALGORITHM=nacl-secretbox