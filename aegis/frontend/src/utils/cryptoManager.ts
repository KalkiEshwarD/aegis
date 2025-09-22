import { randomBytes, secretbox } from 'tweetnacl';
import { decodeUTF8, encodeUTF8, encodeBase64, decodeBase64 } from 'tweetnacl-util';
import { CryptoConfig, CRYPTO_CONFIG } from '../config/crypto';
import { EncryptionKey, EncryptedFile } from '../types';

// Centralized crypto manager for frontend operations
// Matches the backend CryptoManager architecture for consistency
export class CryptoManager {
  private config: CryptoConfig;

  constructor(config: CryptoConfig = CRYPTO_CONFIG) {
    this.config = config;
  }

  //================================================================================
  // Key Generation and Management
  //================================================================================

  // Generate a random key of specified length
  generateRandomKey(length: number): Uint8Array {
    return randomBytes(length);
  }

  // Generate a file encryption key
  generateFileKey(): Uint8Array {
    return this.generateRandomKey(this.config.secretboxKeyLength);
  }

  // Generate a salt for key derivation
  generateSalt(): Uint8Array {
    return this.generateRandomKey(this.config.saltLength);
  }

  // Generate a nonce for NaCl secretbox
  generateNonce(): Uint8Array {
    return this.generateRandomKey(this.config.secretboxNonceLength);
  }

  // Generate an IV for AES-GCM
  generateIV(): Uint8Array {
    return this.generateRandomKey(this.config.aesGcmIvLength);
  }

  //================================================================================
  // Password-Based Key Derivation
  //================================================================================

  // Derive key from password using PBKDF2
  async deriveKeyFromPassword(password: string, salt: Uint8Array): Promise<CryptoKey> {
    const encoder = new TextEncoder();
    const passwordData = encoder.encode(password);

    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      passwordData,
      'PBKDF2',
      false,
      ['deriveBits', 'deriveKey']
    );

    const derivedKey = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt as any,
        iterations: this.config.pbkdf2Iterations,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: 'AES-GCM', length: this.config.keyLength * 8 }, // Convert bytes to bits
      false,
      ['encrypt', 'decrypt']
    );

    return derivedKey;
  }

  // Validate password strength
  validatePasswordStrength(password: string): void {
    if (password.length < 8) {
      throw new Error('Password must be at least 8 characters long');
    }
    
    const hasUpper = /[A-Z]/.test(password);
    const hasLower = /[a-z]/.test(password);
    const hasDigit = /[0-9]/.test(password);
    const hasSpecial = /[!@#$%^&*]/.test(password);
    
    if (!hasUpper || !hasLower || !hasDigit || !hasSpecial) {
      throw new Error('Password must contain uppercase, lowercase, digit, and special character');
    }
  }

  //================================================================================
  // File Encryption (NaCl Secretbox - matches backend)
  //================================================================================

  // Generate an encryption key with nonce
  generateEncryptionKey(): EncryptionKey {
    return {
      key: this.generateFileKey(),
      nonce: this.generateNonce()
    };
  }

  // Encrypt file data
  encryptFile(fileData: Uint8Array, key: Uint8Array): { encryptedData: Uint8Array; nonce: Uint8Array } {
    if (key.length !== this.config.secretboxKeyLength) {
      throw new Error(`Invalid key length: expected ${this.config.secretboxKeyLength}, got ${key.length}`);
    }

    const nonce = this.generateNonce();
    const encryptedData = secretbox(fileData, nonce, key);
    
    return {
      encryptedData,
      nonce
    };
  }

  // Decrypt file data
  decryptFile(encryptedData: Uint8Array, nonce: Uint8Array, key: Uint8Array): Uint8Array | null {
    if (key.length !== this.config.secretboxKeyLength) {
      throw new Error(`Invalid key length: expected ${this.config.secretboxKeyLength}, got ${key.length}`);
    }
    
    if (nonce.length !== this.config.secretboxNonceLength) {
      throw new Error(`Invalid nonce length: expected ${this.config.secretboxNonceLength}, got ${nonce.length}`);
    }

    const decryptedData = secretbox.open(encryptedData, nonce, key);
    return decryptedData;
  }

  // Decrypt file data where nonce is prefixed to encrypted data (matches backend)
  decryptFileWithNoncePrefix(encryptedDataWithNonce: Uint8Array, key: Uint8Array): Uint8Array | null {
    if (encryptedDataWithNonce.length < this.config.secretboxNonceLength) {
      throw new Error(`Encrypted data too short: expected at least ${this.config.secretboxNonceLength} bytes`);
    }

    // Extract nonce from prefix
    const nonce = encryptedDataWithNonce.slice(0, this.config.secretboxNonceLength);
    const ciphertext = encryptedDataWithNonce.slice(this.config.secretboxNonceLength);

    return this.decryptFile(ciphertext, nonce, key);
  }

  //================================================================================
  // Password-Based File Key Encryption (matches backend envelope encryption)
  //================================================================================

  // Encrypt file encryption key with master password
  async encryptFileKeyWithPassword(
    fileKey: Uint8Array,
    masterPassword: string
  ): Promise<{ encryptedKey: string; salt: string; iv: string }> {
    this.validatePasswordStrength(masterPassword);
    
    const salt = this.generateSalt();
    const derivedKey = await this.deriveKeyFromPassword(masterPassword, salt);

    const iv = this.generateIV();

    const encrypted = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: iv as any
      },
      derivedKey,
      fileKey as any
    );

    return {
      encryptedKey: encodeBase64(new Uint8Array(encrypted)),
      salt: encodeBase64(salt),
      iv: encodeBase64(iv)
    };
  }

  // Decrypt file encryption key with master password
  async decryptFileKeyWithPassword(
    encryptedKey: string,
    salt: string,
    iv: string,
    masterPassword: string
  ): Promise<Uint8Array> {
    try {
      const saltBytes = decodeBase64(salt);
      const ivBytes = decodeBase64(iv);
      const encryptedKeyBytes = decodeBase64(encryptedKey);

      const derivedKey = await this.deriveKeyFromPassword(masterPassword, saltBytes);

      const decrypted = await crypto.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv: ivBytes as any
        },
        derivedKey,
        encryptedKeyBytes as any
      );

      return new Uint8Array(decrypted);
    } catch (error) {
      throw new Error('Failed to decrypt file key - invalid password or corrupted data');
    }
  }

  //================================================================================
  // String Encryption (for secure data handling)
  //================================================================================

  // Encrypt string data
  encryptString(plaintext: string, key: Uint8Array): { encryptedText: string; nonce: string } {
    const nonce = this.generateNonce();
    const plaintextBytes = new TextEncoder().encode(plaintext);
    const encryptedBytes = secretbox(plaintextBytes, nonce, key);
    
    return {
      encryptedText: encodeBase64(encryptedBytes),
      nonce: encodeBase64(nonce)
    };
  }

  // Decrypt string data
  decryptString(encryptedText: string, nonce: string, key: Uint8Array): string | null {
    try {
      const encryptedBytes = decodeBase64(encryptedText);
      const nonceBytes = decodeBase64(nonce);
      const decryptedBytes = secretbox.open(encryptedBytes, nonceBytes, key);
      
      if (!decryptedBytes) {
        return null;
      }
      
      return new TextDecoder().decode(decryptedBytes);
    } catch (error) {
      return null;
    }
  }

  //================================================================================
  // Utility Functions
  //================================================================================

  // Convert encryption key to base64 for storage
  encryptionKeyToBase64(key: Uint8Array): string {
    return encodeBase64(key);
  }

  // Convert base64 to encryption key
  base64ToEncryptionKey(base64Key: string): Uint8Array {
    try {
      return decodeBase64(base64Key);
    } catch (error) {
      throw new Error('Invalid base64 string');
    }
  }

  // Calculate SHA-256 hash of data
  async calculateHash(data: Uint8Array): Promise<string> {
    // Create a proper Uint8Array for crypto.subtle
    const dataArray = new Uint8Array(data);
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataArray);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(byte => byte.toString(16).padStart(2, '0')).join('');
  }

  // Get configuration
  getConfig(): CryptoConfig {
    return { ...this.config };
  }
}

// Create default crypto manager instance
export const cryptoManager = new CryptoManager();

// Export individual functions for backward compatibility
export const generateEncryptionKey = () => cryptoManager.generateEncryptionKey();
export const encryptFile = (fileData: Uint8Array, key: Uint8Array) => cryptoManager.encryptFile(fileData, key);
export const decryptFile = (encryptedData: Uint8Array, nonce: Uint8Array, key: Uint8Array) => cryptoManager.decryptFile(encryptedData, nonce, key);
export const encryptionKeyToBase64 = (key: Uint8Array) => cryptoManager.encryptionKeyToBase64(key);
export const base64ToEncryptionKey = (base64Key: string) => cryptoManager.base64ToEncryptionKey(base64Key);
export const encryptString = (plaintext: string, key: Uint8Array) => cryptoManager.encryptString(plaintext, key);
export const decryptString = (encryptedText: string, nonce: string, key: Uint8Array) => cryptoManager.decryptString(encryptedText, nonce, key);
export const generateSalt = () => cryptoManager.generateSalt();
export const deriveKeyFromPassword = (password: string, salt: Uint8Array) => cryptoManager.deriveKeyFromPassword(password, salt);
export const encryptFileKeyWithPassword = (fileKey: Uint8Array, masterPassword: string) => cryptoManager.encryptFileKeyWithPassword(fileKey, masterPassword);
export const decryptFileKeyWithPassword = (encryptedKey: string, salt: string, iv: string, masterPassword: string) => cryptoManager.decryptFileKeyWithPassword(encryptedKey, salt, iv, masterPassword);