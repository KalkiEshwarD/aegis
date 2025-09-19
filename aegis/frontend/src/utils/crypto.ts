import { randomBytes, secretbox } from 'tweetnacl';
import { decodeUTF8, encodeUTF8, encodeBase64, decodeBase64 } from 'tweetnacl-util';
import { EncryptionKey, EncryptedFile } from '../types';

// Derive key from password using PBKDF2
export const deriveKeyFromPassword = async (password: string, salt: Uint8Array): Promise<CryptoKey> => {
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
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );

  return derivedKey;
};

// Generate salt for password derivation
export const generateSalt = (): Uint8Array => {
  return randomBytes(16);
};

// Encrypt file encryption key with master password
export const encryptFileKeyWithPassword = async (
  fileKey: Uint8Array,
  masterPassword: string
): Promise<{ encryptedKey: string; salt: string; iv: string }> => {
  const salt = generateSalt();
  const derivedKey = await deriveKeyFromPassword(masterPassword, salt);

  const iv = randomBytes(12); // 96-bit IV for AES-GCM

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
};

// Decrypt file encryption key with master password
export const decryptFileKeyWithPassword = async (
  encryptedKey: string,
  salt: string,
  iv: string,
  masterPassword: string
): Promise<Uint8Array> => {
  try {
    const saltBytes = decodeBase64(salt);
    const ivBytes = decodeBase64(iv);
    const encryptedKeyBytes = decodeBase64(encryptedKey);

    const derivedKey = await deriveKeyFromPassword(masterPassword, saltBytes);

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
};

// Generate a random encryption key
export const generateEncryptionKey = (): EncryptionKey => {
  return {
    key: randomBytes(secretbox.keyLength),
    nonce: randomBytes(secretbox.nonceLength)
  };
};

// Encrypt file data
export const encryptFile = (fileData: Uint8Array, key: Uint8Array): { encryptedData: Uint8Array; nonce: Uint8Array } => {
  const nonce = randomBytes(secretbox.nonceLength);
  const encryptedData = secretbox(fileData, nonce, key);
  
  return {
    encryptedData,
    nonce
  };
};

// Decrypt file data
export const decryptFile = (encryptedData: Uint8Array, nonce: Uint8Array, key: Uint8Array): Uint8Array | null => {
  const decryptedData = secretbox.open(encryptedData, nonce, key);
  return decryptedData;
};

// Convert encryption key to base64 for storage
export const encryptionKeyToBase64 = (key: Uint8Array): string => {
  return encodeBase64(key);
};

// Convert base64 to encryption key
export const base64ToEncryptionKey = (base64Key: string): Uint8Array => {
  try {
    return decodeBase64(base64Key);
  } catch (error) {
    throw new Error('Invalid base64 string');
  }
};

// Encrypt a string (for metadata)
export const encryptString = (text: string, key: Uint8Array): { encryptedText: string; nonce: string } => {
  const nonce = randomBytes(secretbox.nonceLength);
  const messageUint8 = decodeUTF8(text);
  const encrypted = secretbox(messageUint8, nonce, key);
  
  return {
    encryptedText: encodeBase64(encrypted),
    nonce: encodeBase64(nonce)
  };
};

// Decrypt a string
export const decryptString = (encryptedText: string, nonceBase64: string, key: Uint8Array): string | null => {
  try {
    const encrypted = decodeBase64(encryptedText);
    const nonce = decodeBase64(nonceBase64);
    const decrypted = secretbox.open(encrypted, nonce, key);
    
    if (!decrypted) return null;
    
    return encodeUTF8(decrypted);
  } catch (error) {
    console.error('Decryption error:', error);
    return null;
  }
};

// Calculate SHA-256 hash of file content
export const calculateFileHash = async (file: File): Promise<string> => {
  const arrayBuffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
};

// Convert file to Uint8Array
export const fileToUint8Array = (file: File): Promise<Uint8Array> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (reader.result instanceof ArrayBuffer) {
        const uint8Array = new Uint8Array(reader.result);
        resolve(uint8Array);
      } else {
        reject(new Error('Failed to read file as ArrayBuffer'));
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file);
  });
};

// Create a downloadable blob from decrypted data
export const createDownloadBlob = (data: Uint8Array, mimeType: string): Blob => {
  return new Blob([data as BlobPart], { type: mimeType });
};

// Download file to user's device
export const downloadFile = (blob: Blob, filename: string): void => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};


// Convert Uint8Array to base64 without causing stack overflow
export const uint8ArrayToBase64 = (uint8Array: Uint8Array): string => {
  // Process in chunks to avoid stack overflow with large arrays
  const chunkSize = 8192; // 8KB chunks
  let result = '';

  for (let i = 0; i < uint8Array.length; i += chunkSize) {
    const chunk = uint8Array.slice(i, i + chunkSize);
    const binaryString = String.fromCharCode.apply(null, Array.from(chunk));
    result += binaryString;
  }

  return btoa(result);
};


// Extract nonce and encrypted data from stored encrypted file data
// The nonce is prepended to the encrypted data during upload
export const extractNonceAndData = (encryptedDataWithNonce: Uint8Array): { nonce: Uint8Array; encryptedData: Uint8Array } => {
  const nonceLength = secretbox.nonceLength; // Should be 24 bytes
  
  if (encryptedDataWithNonce.length < nonceLength) {
    throw new Error(`Invalid encrypted data: too short to contain nonce. Length: ${encryptedDataWithNonce.length}, Required: ${nonceLength}`);
  }
  
  const nonce = encryptedDataWithNonce.slice(0, nonceLength);
  const encryptedData = encryptedDataWithNonce.slice(nonceLength);
  
  return { nonce, encryptedData };
};
