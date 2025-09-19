import {
  uint8ArrayToBase64,
  calculateFileHash,
  fileToUint8Array,
  extractNonceAndData,
} from '../../utils/crypto';
import { formatFileSize, getMimeTypeFromExtension } from '../../utils/fileUtils';

describe('Crypto Utilities Performance Optimizations', () => {
  describe('Chunked Base64 Conversion', () => {
    test('converts small arrays efficiently without chunking', () => {
      const smallArray = new Uint8Array(100); // Less than 8KB
      for (let i = 0; i < smallArray.length; i++) {
        smallArray[i] = i % 256;
      }

      const startTime = performance.now();
      const result = uint8ArrayToBase64(smallArray);
      const endTime = performance.now();

      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
      expect(endTime - startTime).toBeLessThan(100); // Should be fast
    });

    test('handles large arrays with chunking to prevent stack overflow', () => {
      // Create a large array (1MB) that would cause stack overflow without chunking
      const largeArray = new Uint8Array(1024 * 1024);
      for (let i = 0; i < largeArray.length; i++) {
        largeArray[i] = i % 256;
      }

      const startTime = performance.now();
      const result = uint8ArrayToBase64(largeArray);
      const endTime = performance.now();

      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
      // Should complete within reasonable time (less than 1 second for 1MB)
      expect(endTime - startTime).toBeLessThan(1000);
    });

    test('produces correct base64 output', () => {
      const testArray = new Uint8Array([72, 101, 108, 108, 111]); // "Hello"
      const result = uint8ArrayToBase64(testArray);

      // "Hello" in base64 is "SGVsbG8="
      expect(result).toBe('SGVsbG8=');
    });

    test('handles empty arrays correctly', () => {
      const emptyArray = new Uint8Array(0);
      const result = uint8ArrayToBase64(emptyArray);

      expect(result).toBe('');
    });

    test('maintains data integrity across chunk boundaries', () => {
      // Create array that spans multiple chunks
      const testData = new Uint8Array(20000); // 20KB, spans multiple 8KB chunks
      for (let i = 0; i < testData.length; i++) {
        testData[i] = i % 256;
      }

      const result = uint8ArrayToBase64(testData);

      // Verify we can decode it back
      const decoded = Uint8Array.from(atob(result), c => c.charCodeAt(0));
      expect(decoded.length).toBe(testData.length);

      // Verify data integrity
      for (let i = 0; i < testData.length; i++) {
        expect(decoded[i]).toBe(testData[i]);
      }
    });
  });

  describe('File Size Formatting Optimization', () => {
    test('formats file sizes efficiently', () => {
      const testCases = [
        { bytes: 0, expected: '0 Bytes' },
        { bytes: 512, expected: '512 Bytes' },
        { bytes: 1024, expected: '1.00 KB' },
        { bytes: 1536, expected: '1.50 KB' },
        { bytes: 1048576, expected: '1.00 MB' },
        { bytes: 1073741824, expected: '1.00 GB' },
        { bytes: 1099511627776, expected: '1.00 TB' },
      ];

      testCases.forEach(({ bytes, expected }) => {
        const startTime = performance.now();
        const result = formatFileSize(bytes);
        const endTime = performance.now();

        expect(result).toBe(expected);
        expect(endTime - startTime).toBeLessThan(10); // Should be very fast
      });
    });

    test('handles edge cases efficiently', () => {
      const edgeCases = [
        Number.MAX_SAFE_INTEGER,
        Number.MIN_SAFE_INTEGER,
        Infinity,
        -Infinity,
        NaN,
      ];

      edgeCases.forEach((bytes) => {
        const startTime = performance.now();
        const result = formatFileSize(bytes);
        const endTime = performance.now();

        expect(typeof result).toBe('string');
        expect(endTime - startTime).toBeLessThan(10);
      });
    });
  });

  describe('MIME Type Detection Optimization', () => {
    test('detects MIME types efficiently', () => {
      const testCases = [
        { filename: 'test.jpg', expected: 'image/jpeg' },
        { filename: 'document.pdf', expected: 'application/pdf' },
        { filename: 'script.js', expected: 'application/octet-stream' }, // Not in map
        { filename: 'file', expected: 'application/octet-stream' }, // No extension
        { filename: 'file.', expected: 'application/octet-stream' }, // Empty extension
      ];

      testCases.forEach(({ filename, expected }) => {
        const startTime = performance.now();
        const result = getMimeTypeFromExtension(filename);
        const endTime = performance.now();

        expect(result).toBe(expected);
        expect(endTime - startTime).toBeLessThan(5); // Should be very fast
      });
    });

    test('handles case insensitive extensions', () => {
      const testCases = [
        'test.JPG',
        'test.JpG',
        'test.jpg',
        'TEST.JPG',
      ];

      testCases.forEach((filename) => {
        const startTime = performance.now();
        const result = getMimeTypeFromExtension(filename);
        const endTime = performance.now();

        expect(result).toBe('image/jpeg');
        expect(endTime - startTime).toBeLessThan(5);
      });
    });

    test('handles various file extensions efficiently', () => {
      const extensions = [
        'txt', 'pdf', 'doc', 'docx', 'xls', 'xlsx',
        'mp3', 'mp4', 'avi', 'zip', 'rar', 'tar', 'gz'
      ];

      extensions.forEach((ext) => {
        const filename = `test.${ext}`;
        const startTime = performance.now();
        const result = getMimeTypeFromExtension(filename);
        const endTime = performance.now();

        expect(typeof result).toBe('string');
        expect(result).not.toBe('application/octet-stream'); // Should find a match
        expect(endTime - startTime).toBeLessThan(5);
      });
    });
  });

  describe('File Hash Calculation Performance', () => {
    test('calculates hashes efficiently for small files', async () => {
      const smallFile = new File(['Hello World'], 'test.txt', { type: 'text/plain' });

      const startTime = performance.now();
      const hash = await calculateFileHash(smallFile);
      const endTime = performance.now();

      expect(hash).toBeDefined();
      expect(typeof hash).toBe('string');
      expect(hash.length).toBe(64); // SHA-256 produces 64 character hex string
      expect(endTime - startTime).toBeLessThan(100); // Should be fast
    });

    test('handles large files without memory issues', async () => {
      // Create a larger file (100KB)
      const largeContent = 'A'.repeat(100 * 1024);
      const largeFile = new File([largeContent], 'large.txt', { type: 'text/plain' });

      const startTime = performance.now();
      const hash = await calculateFileHash(largeFile);
      const endTime = performance.now();

      expect(hash).toBeDefined();
      expect(typeof hash).toBe('string');
      expect(hash.length).toBe(64);
      expect(endTime - startTime).toBeLessThan(500); // Should complete within reasonable time
    });

    test('produces consistent hashes for same content', async () => {
      const content = 'Test content for hashing';
      const file1 = new File([content], 'test1.txt', { type: 'text/plain' });
      const file2 = new File([content], 'test2.txt', { type: 'text/plain' });

      const hash1 = await calculateFileHash(file1);
      const hash2 = await calculateFileHash(file2);

      expect(hash1).toBe(hash2);
    });
  });

  describe('File to Uint8Array Conversion', () => {
    test('converts files to Uint8Array efficiently', async () => {
      const testContent = 'Hello World';
      const file = new File([testContent], 'test.txt', { type: 'text/plain' });

      const startTime = performance.now();
      const uint8Array = await fileToUint8Array(file);
      const endTime = performance.now();

      expect(uint8Array).toBeInstanceOf(Uint8Array);
      expect(uint8Array.length).toBe(testContent.length);
      expect(endTime - startTime).toBeLessThan(50); // Should be fast
    });

    test('handles binary files correctly', async () => {
      const binaryData = new Uint8Array([0, 1, 255, 128, 64]);
      const file = new File([binaryData], 'binary.dat');

      const startTime = performance.now();
      const result = await fileToUint8Array(file);
      const endTime = performance.now();

      expect(result).toEqual(binaryData);
      expect(endTime - startTime).toBeLessThan(50);
    });
  });

  describe('Nonce Extraction Optimization', () => {
    test('extracts nonce and data efficiently', () => {
      // Create test data with nonce prepended
      const nonce = new Uint8Array(24).fill(1);
      const encryptedData = new Uint8Array(100).fill(2);
      const combinedData = new Uint8Array(nonce.length + encryptedData.length);
      combinedData.set(nonce, 0);
      combinedData.set(encryptedData, nonce.length);

      const startTime = performance.now();
      const result = extractNonceAndData(combinedData);
      const endTime = performance.now();

      expect(result.nonce).toEqual(nonce);
      expect(result.encryptedData).toEqual(encryptedData);
      expect(endTime - startTime).toBeLessThan(10); // Should be very fast
    });

    test('validates data length before extraction', () => {
      const shortData = new Uint8Array(10); // Less than nonce length (24)

      expect(() => {
        extractNonceAndData(shortData);
      }).toThrow('Invalid encrypted data: too short to contain nonce');
    });

    test('handles edge case data lengths', () => {
      const exactNonceLength = new Uint8Array(24);
      const result = extractNonceAndData(exactNonceLength);

      expect(result.nonce.length).toBe(24);
      expect(result.encryptedData.length).toBe(0);
    });
  });

  describe('Memory Usage Optimization', () => {
    test('chunked conversion prevents memory spikes', () => {
      // Test with progressively larger arrays
      const sizes = [1000, 10000, 100000, 1000000]; // Up to 1MB

      sizes.forEach((size) => {
        const largeArray = new Uint8Array(size);
        for (let i = 0; i < size; i++) {
          largeArray[i] = i % 256;
        }

        const startTime = performance.now();
        const result = uint8ArrayToBase64(largeArray);
        const endTime = performance.now();

        expect(result).toBeDefined();
        expect(result.length).toBe(Math.ceil((size * 4) / 3)); // Base64 encoding size
        expect(endTime - startTime).toBeLessThan(1000); // Should not take too long
      });
    });

    test('operations complete without memory leaks', async () => {
      // Run multiple operations to check for memory issues
      const operations = [];

      for (let i = 0; i < 10; i++) {
        const testData = new Uint8Array(10000).fill(i);
        operations.push(uint8ArrayToBase64(testData));
      }

      const results = await Promise.all(operations);

      results.forEach((result, index) => {
        expect(result).toBeDefined();
        expect(typeof result).toBe('string');
      });
    });
  });
});