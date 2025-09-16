import { 
  generateEncryptionKey, 
  encryptFile, 
  decryptFile, 
  encryptionKeyToBase64, 
  base64ToEncryptionKey,
  encryptString,
  decryptString,
  calculateFileHash,
  fileToUint8Array,
  createDownloadBlob,
  downloadFile,
  formatFileSize,
  getMimeTypeFromExtension
} from '../../utils/crypto';

describe('Crypto Utils', () => {
  describe('generateEncryptionKey', () => {
    it('should generate a valid encryption key', () => {
      const key = generateEncryptionKey();
      
      expect(key).toBeDefined();
      expect(key.key).toBeDefined();
      expect(key.nonce).toBeDefined();
      expect(key.key.length).toBe(32); // secretbox.keyLength
      expect(key.nonce.length).toBe(24); // secretbox.nonceLength
    });

    it('should generate different keys on multiple calls', () => {
      const key1 = generateEncryptionKey();
      const key2 = generateEncryptionKey();
      
      expect(key1.key).not.toEqual(key2.key);
      expect(key1.nonce).not.toEqual(key2.nonce);
    });
  });

  describe('file encryption/decryption', () => {
    const testData = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    const key = new Uint8Array(32); // Mock key for testing
    key.fill(1); // Fill with test data

    it('should encrypt file data', () => {
      const result = encryptFile(testData, key);
      
      expect(result).toBeDefined();
      expect(result.encryptedData).toBeDefined();
      expect(result.nonce).toBeDefined();
      expect(result.nonce.length).toBe(24);
      expect(result.encryptedData).not.toEqual(testData);
    });

    it('should decrypt file data correctly', () => {
      const encrypted = encryptFile(testData, key);
      const decrypted = decryptFile(encrypted.encryptedData, encrypted.nonce, key);
      
      expect(decrypted).toBeDefined();
      expect(decrypted).toEqual(testData);
    });

    it('should return null for invalid decryption', () => {
      const encrypted = encryptFile(testData, key);
      const wrongKey = new Uint8Array(32);
      wrongKey.fill(2);
      
      const decrypted = decryptFile(encrypted.encryptedData, encrypted.nonce, wrongKey);
      
      expect(decrypted).toBeNull();
    });

    it('should handle empty file data', () => {
      const emptyData = new Uint8Array(0);
      const encrypted = encryptFile(emptyData, key);
      const decrypted = decryptFile(encrypted.encryptedData, encrypted.nonce, key);
      
      expect(decrypted).toEqual(emptyData);
    });
  });

  describe('key encoding/decoding', () => {
    it('should convert key to base64 and back', () => {
      const originalKey = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
      
      const base64Key = encryptionKeyToBase64(originalKey);
      const decodedKey = base64ToEncryptionKey(base64Key);
      
      expect(typeof base64Key).toBe('string');
      expect(base64Key.length).toBeGreaterThan(0);
      expect(decodedKey).toEqual(originalKey);
    });

    it('should handle different key sizes', () => {
      const smallKey = new Uint8Array([1]);
      const largeKey = new Uint8Array(32).fill(255);
      
      const smallBase64 = encryptionKeyToBase64(smallKey);
      const largeBase64 = encryptionKeyToBase64(largeKey);
      
      expect(base64ToEncryptionKey(smallBase64)).toEqual(smallKey);
      expect(base64ToEncryptionKey(largeBase64)).toEqual(largeKey);
    });
  });

  describe('string encryption/decryption', () => {
    const testString = 'Hello, World! This is a test string with special chars: @#$%^&*()';
    const key = new Uint8Array(32);
    key.fill(42);

    it('should encrypt string correctly', () => {
      const result = encryptString(testString, key);
      
      expect(result).toBeDefined();
      expect(result.encryptedText).toBeDefined();
      expect(result.nonce).toBeDefined();
      expect(typeof result.encryptedText).toBe('string');
      expect(typeof result.nonce).toBe('string');
      expect(result.encryptedText).not.toBe(testString);
    });

    it('should decrypt string correctly', () => {
      const encrypted = encryptString(testString, key);
      const decrypted = decryptString(encrypted.encryptedText, encrypted.nonce, key);
      
      expect(decrypted).toBe(testString);
    });

    it('should return null for invalid string decryption', () => {
      const encrypted = encryptString(testString, key);
      const wrongKey = new Uint8Array(32);
      wrongKey.fill(99);
      
      const decrypted = decryptString(encrypted.encryptedText, encrypted.nonce, wrongKey);
      
      expect(decrypted).toBeNull();
    });

    it('should handle empty strings', () => {
      const emptyString = '';
      const encrypted = encryptString(emptyString, key);
      const decrypted = decryptString(encrypted.encryptedText, encrypted.nonce, key);
      
      expect(decrypted).toBe(emptyString);
    });

    it('should handle special characters and unicode', () => {
      const unicodeString = 'Hello 🌍! Ñoño café: 中文 العربية';
      const encrypted = encryptString(unicodeString, key);
      const decrypted = decryptString(encrypted.encryptedText, encrypted.nonce, key);
      
      expect(decrypted).toBe(unicodeString);
    });
  });

  describe('file utilities', () => {
    it('should calculate file hash', async () => {
      // Create a mock File object
      const fileContent = 'test file content';
      const file = new File([fileContent], 'test.txt', { type: 'text/plain' });
      
      const hash = await calculateFileHash(file);
      
      expect(hash).toBeDefined();
      expect(typeof hash).toBe('string');
      expect(hash.length).toBe(64); // SHA-256 produces 64 character hex string
    });

    it('should convert file to Uint8Array', async () => {
      const fileContent = 'test content';
      const file = new File([fileContent], 'test.txt', { type: 'text/plain' });
      
      const uint8Array = await fileToUint8Array(file);
      
      expect(uint8Array).toBeInstanceOf(Uint8Array);
      expect(uint8Array.length).toBeGreaterThan(0);
    });

    it('should create download blob', () => {
      const data = new Uint8Array([1, 2, 3, 4, 5]);
      const mimeType = 'application/octet-stream';
      
      const blob = createDownloadBlob(data, mimeType);
      
      expect(blob).toBeInstanceOf(Blob);
      expect(blob.type).toBe(mimeType);
      expect(blob.size).toBe(data.length);
    });

    it('should format file sizes correctly', () => {
      expect(formatFileSize(0)).toBe('0 Bytes');
      expect(formatFileSize(1024)).toBe('1 KB');
      expect(formatFileSize(1048576)).toBe('1 MB');
      expect(formatFileSize(1073741824)).toBe('1 GB');
      expect(formatFileSize(500)).toBe('500 Bytes');
      expect(formatFileSize(1536)).toBe('1.5 KB');
    });

    it('should get MIME type from extension', () => {
      expect(getMimeTypeFromExtension('test.jpg')).toBe('image/jpeg');
      expect(getMimeTypeFromExtension('document.pdf')).toBe('application/pdf');
      expect(getMimeTypeFromExtension('data.json')).toBe('application/json');
      expect(getMimeTypeFromExtension('archive.zip')).toBe('application/zip');
      expect(getMimeTypeFromExtension('video.mp4')).toBe('video/mp4');
      expect(getMimeTypeFromExtension('unknown.xyz')).toBe('application/octet-stream');
      expect(getMimeTypeFromExtension('noextension')).toBe('application/octet-stream');
    });

    it('should handle download file function without errors', () => {
      const blob = new Blob(['test content'], { type: 'text/plain' });
      
      // Mock DOM methods
      const createObjectURL = jest.fn(() => 'mock-url');
      const revokeObjectURL = jest.fn();
      const createElement = jest.fn(() => ({
        href: '',
        download: '',
        click: jest.fn(),
        style: { display: '' }
      }));
      const appendChild = jest.fn();
      const removeChild = jest.fn();

      Object.defineProperty(global, 'URL', {
        value: { createObjectURL, revokeObjectURL }
      });
      Object.defineProperty(document, 'createElement', { value: createElement });
      Object.defineProperty(document.body, 'appendChild', { value: appendChild });
      Object.defineProperty(document.body, 'removeChild', { value: removeChild });

      expect(() => {
        downloadFile(blob, 'test.txt');
      }).not.toThrow();

      expect(createObjectURL).toHaveBeenCalledWith(blob);
      expect(createElement).toHaveBeenCalledWith('a');
    });
  });

  describe('error handling', () => {
    it('should handle invalid base64 decoding gracefully', () => {
      expect(() => {
        base64ToEncryptionKey('invalid-base64!@#$');
      }).toThrow('Invalid base64 string');
    });

    it('should handle invalid encrypted string format', () => {
      const key = new Uint8Array(32).fill(1);
      
      const result = decryptString('invalid-base64', 'also-invalid', key);
      
      expect(result).toBeNull();
    });
  });
});
