// Mock File and FileReader for file utilities before any imports
import {
  calculateFileHash,
  calculateMD5Hash,
  detectMimeType,
  getFileExtension,
  isValidFileExtension,
  isValidMimeType,
  generateUniqueFilename,
  validateFileSize,
  getFileCategory,
  isTextFile,
  isImageFile,
  isVideoFile,
  isAudioFile,
  isArchiveFile,
  getFileIconType,
  getFileInfo,
  validateFilename,
  sanitizePath,
  isPathSafe,
  readFileAsText,
  readFileAsArrayBuffer,
  readFileAsDataURL,
  getFilePreview,
  validateFileForUpload,
} from '../../utils/fileOperations';

Object.defineProperty(global, 'File', {
  value: jest.fn().mockImplementation((parts, filename, options) => {
    const content = parts && parts.length > 0 ? parts[0] : '';
    const size = content ? content.length || 0 : 0;
    const file = {
      name: filename,
      size: size,
      type: options?.type || '',
      lastModified: Date.now(),
      arrayBuffer: jest.fn().mockResolvedValue(
        content instanceof ArrayBuffer ? content : new ArrayBuffer(size || 8)
      ),
      text: jest.fn().mockResolvedValue(content || 'test content'),
    };
    return file;
  }),
  writable: true,
});

Object.defineProperty(global, 'FileReader', {
  value: jest.fn().mockImplementation(() => ({
    readAsArrayBuffer: jest.fn(function(this: any, file) {
      setTimeout(() => {
        if (this.onload) {
          this.result = new ArrayBuffer(8);
          this.onload();
        }
      }, 0);
    }),
    readAsText: jest.fn(function(this: any, file) {
      setTimeout(() => {
        if (this.onload) {
          this.result = 'test content';
          this.onload();
        }
      }, 0);
    }),
    readAsDataURL: jest.fn(function(this: any, file) {
      setTimeout(() => {
        if (this.onload) {
          this.result = 'data:text/plain;base64,dGVzdCBjb250ZW50';
          this.onload();
        }
      }, 0);
    }),
    onload: null,
    onerror: null,
    result: null,
  })),
  writable: true,
});

describe('File Operations Utils', () => {
  describe('calculateFileHash', () => {
    it('should calculate SHA-256 hash', async () => {
      const file = new File(['test content'], 'test.txt');
      const hash = await calculateFileHash(file);
      expect(hash).toBeDefined();
      expect(typeof hash).toBe('string');
      expect(hash.length).toBe(64); // SHA-256 produces 64 character hex string
    });
  });

  describe('calculateMD5Hash', () => {
    it('should calculate MD5-like hash', async () => {
      const file = new File(['test content'], 'test.txt');
      const hash = await calculateMD5Hash(file);
      expect(hash).toBeDefined();
      expect(typeof hash).toBe('string');
      expect(hash.length).toBeGreaterThan(0);
    });
  });

  describe('detectMimeType', () => {
    it('should return file type if available', () => {
      const file = new File(['content'], 'test.txt', { type: 'text/plain' });
      expect(detectMimeType(file)).toBe('text/plain');
    });

    it('should return default type if no type', () => {
      const file = new File(['content'], 'test.txt');
      expect(detectMimeType(file)).toBe('application/octet-stream');
    });
  });

  describe('getFileExtension', () => {
    it('should extract file extension', () => {
      expect(getFileExtension('test.txt')).toBe('.txt');
      expect(getFileExtension('document.pdf')).toBe('.pdf');
      expect(getFileExtension('file.with.multiple.dots.txt')).toBe('.txt');
    });

    it('should return empty string for files without extension', () => {
      expect(getFileExtension('filename')).toBe('');
      expect(getFileExtension('')).toBe('');
    });
  });

  describe('isValidFileExtension', () => {
    it('should validate allowed extensions', () => {
      expect(isValidFileExtension('test.txt', ['txt', 'pdf'])).toBe(true);
      expect(isValidFileExtension('test.pdf', ['txt', 'pdf'])).toBe(true);
      expect(isValidFileExtension('test.TXT', ['txt', 'pdf'])).toBe(true);
      expect(isValidFileExtension('test.txt', ['.txt', '.pdf'])).toBe(true);
    });

    it('should reject disallowed extensions', () => {
      expect(isValidFileExtension('test.exe', ['txt', 'pdf'])).toBe(false);
      expect(isValidFileExtension('file', ['txt', 'pdf'])).toBe(false);
    });
  });

  describe('isValidMimeType', () => {
    it('should validate allowed MIME types', () => {
      expect(isValidMimeType('text/plain', ['text/', 'image/'])).toBe(true);
      expect(isValidMimeType('image/jpeg', ['text/', 'image/'])).toBe(true);
    });

    it('should reject disallowed MIME types', () => {
      expect(isValidMimeType('application/pdf', ['text/', 'image/'])).toBe(false);
    });
  });

  describe('generateUniqueFilename', () => {
    it('should generate unique filename with timestamp', () => {
      const original = 'test.txt';
      const result = generateUniqueFilename(original);

      expect(result).toContain('test');
      expect(result).toContain('.txt');
      expect(result).not.toBe(original);
      expect(result.length).toBeGreaterThan(original.length);
    });
  });

  describe('validateFileSize', () => {
    it('should validate file size within bounds', () => {
      expect(validateFileSize(1000, 100, 2000)).toBe(true);
      expect(validateFileSize(100, 100, 2000)).toBe(true);
      expect(validateFileSize(2000, 100, 2000)).toBe(true);
    });

    it('should reject file size outside bounds', () => {
      expect(validateFileSize(50, 100, 2000)).toBe(false);
      expect(validateFileSize(2500, 100, 2000)).toBe(false);
    });
  });

  describe('getFileCategory', () => {
    it('should categorize files correctly', () => {
      expect(getFileCategory('image/jpeg')).toBe('image');
      expect(getFileCategory('video/mp4')).toBe('video');
      expect(getFileCategory('audio/mpeg')).toBe('audio');
      expect(getFileCategory('text/plain')).toBe('document');
      expect(getFileCategory('application/pdf')).toBe('document');
      expect(getFileCategory('application/zip')).toBe('archive');
      expect(getFileCategory('application/json')).toBe('data');
      expect(getFileCategory('application/octet-stream')).toBe('other');
    });
  });

  describe('type checking functions', () => {
    describe('isTextFile', () => {
      it('should identify text files', () => {
        expect(isTextFile('text/plain')).toBe(true);
        expect(isTextFile('application/json')).toBe(true);
        expect(isTextFile('application/xml')).toBe(true);
        expect(isTextFile('image/jpeg')).toBe(false);
      });
    });

    describe('isImageFile', () => {
      it('should identify image files', () => {
        expect(isImageFile('image/jpeg')).toBe(true);
        expect(isImageFile('image/png')).toBe(true);
        expect(isImageFile('text/plain')).toBe(false);
      });
    });

    describe('isVideoFile', () => {
      it('should identify video files', () => {
        expect(isVideoFile('video/mp4')).toBe(true);
        expect(isVideoFile('video/avi')).toBe(true);
        expect(isVideoFile('image/jpeg')).toBe(false);
      });
    });

    describe('isAudioFile', () => {
      it('should identify audio files', () => {
        expect(isAudioFile('audio/mpeg')).toBe(true);
        expect(isAudioFile('audio/wav')).toBe(true);
        expect(isAudioFile('video/mp4')).toBe(false);
      });
    });

    describe('isArchiveFile', () => {
      it('should identify archive files', () => {
        expect(isArchiveFile('application/zip')).toBe(true);
        expect(isArchiveFile('application/x-rar-compressed')).toBe(true);
        expect(isArchiveFile('application/gzip')).toBe(true);
        expect(isArchiveFile('text/plain')).toBe(false);
      });
    });
  });

  describe('getFileIconType', () => {
    it('should return correct icon types', () => {
      expect(getFileIconType('image/jpeg', 'test.jpg')).toBe('image');
      expect(getFileIconType('video/mp4', 'test.mp4')).toBe('video');
      expect(getFileIconType('audio/mpeg', 'test.mp3')).toBe('audio');
      expect(getFileIconType('application/pdf', 'test.pdf')).toBe('pdf');
      expect(getFileIconType('text/plain', 'test.txt')).toBe('document');
      expect(getFileIconType('application/zip', 'test.zip')).toBe('archive');
      expect(getFileIconType('application/json', 'test.json')).toBe('data');
      expect(getFileIconType('application/octet-stream', 'test.unknown')).toBe('file');
      expect(getFileIconType('text/plain', 'test.js')).toBe('code');
    });
  });

  describe('getFileInfo', () => {
    it('should extract file metadata', () => {
      const file = new File(['content'], 'test.txt', { type: 'text/plain' });
      const info = getFileInfo(file);

      expect(info.filename).toBe('test.txt');
      expect(info.size).toBe(7); // 'content'.length
      expect(info.mime_type).toBe('text/plain');
      expect(info.extension).toBe('.txt');
      expect(info.created_at).toBeInstanceOf(Date);
      expect(info.modified_at).toBeInstanceOf(Date);
    });
  });

  describe('validateFilename', () => {
    it('should validate correct filenames', () => {
      expect(validateFilename('test.txt')).toEqual({ valid: true });
      expect(validateFilename('document.pdf')).toEqual({ valid: true });
      expect(validateFilename('file-with-dashes.txt')).toEqual({ valid: true });
    });

    it('should reject invalid filenames', () => {
      expect(validateFilename('')).toEqual({ valid: false, error: 'Filename cannot be empty' });
      expect(validateFilename('   ')).toEqual({ valid: false, error: 'Filename cannot be empty' });
      expect(validateFilename('a'.repeat(256))).toEqual({ valid: false, error: 'Filename too long (max 255 characters)' });
      expect(validateFilename('test<script>.txt')).toEqual({ valid: false, error: 'Filename contains dangerous character: <' });
      expect(validateFilename('CON.txt')).toEqual({ valid: false, error: 'Filename uses reserved name: CON' });
    });
  });

  describe('sanitizePath', () => {
    it('should sanitize paths', () => {
      expect(sanitizePath('../etc/passwd')).toBe('etcpasswd');
      expect(sanitizePath('path\\to\\file')).toBe('path/to/file');
      expect(sanitizePath('/absolute/path/')).toBe('absolute/path');
    });
  });

  describe('isPathSafe', () => {
    it('should validate safe paths', () => {
      expect(isPathSafe('relative/path/file.txt')).toBe(true);
      expect(isPathSafe('file.txt')).toBe(true);
    });

    it('should reject unsafe paths', () => {
      expect(isPathSafe('../etc/passwd')).toBe(false);
      expect(isPathSafe('/absolute/path')).toBe(false);
      expect(isPathSafe('C:\\windows\\system32')).toBe(false);
    });
  });

  describe('file reading functions', () => {
    it('should read file as text', async () => {
      const file = new File(['test content'], 'test.txt');
      const content = await readFileAsText(file);
      expect(content).toBe('test content');
    });

    it('should read file as array buffer', async () => {
      const file = new File(['test content'], 'test.txt');
      const buffer = await readFileAsArrayBuffer(file);
      expect(buffer).toBeInstanceOf(ArrayBuffer);
    });

    it('should read file as data URL', async () => {
      const file = new File(['test content'], 'test.txt');
      const dataUrl = await readFileAsDataURL(file);
      expect(typeof dataUrl).toBe('string');
      expect(dataUrl.startsWith('data:')).toBe(true);
    });
  });

  describe('getFilePreview', () => {
    it('should return data URL for images', async () => {
      const file = new File(['image content'], 'test.jpg', { type: 'image/jpeg' });
      const preview = await getFilePreview(file);
      expect(typeof preview).toBe('string');
      expect(preview?.startsWith('data:')).toBe(true);
    });

    it('should return null for non-images', async () => {
      const file = new File(['text content'], 'test.txt', { type: 'text/plain' });
      const preview = await getFilePreview(file);
      expect(preview).toBeNull();
    });
  });

  describe('validateFileForUpload', () => {
    it('should validate correct files', () => {
      const file = new File(['content'], 'test.txt', { type: 'text/plain' });
      const result = validateFileForUpload(file, {
        maxSize: 1000,
        allowedTypes: ['text/'],
        allowedExtensions: ['txt']
      });
      expect(result.valid).toBe(true);
    });

    it('should reject files that are too large', () => {
      const file = new File(['x'.repeat(2000)], 'test.txt', { type: 'text/plain' });
      const result = validateFileForUpload(file, { maxSize: 1000 });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('exceeds maximum size');
    });

    it('should reject files with invalid MIME type', () => {
      const file = new File(['content'], 'test.pdf', { type: 'application/pdf' });
      const result = validateFileForUpload(file, { allowedTypes: ['text/'] });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('not allowed');
    });

    it('should reject files with invalid extension', () => {
      const file = new File(['content'], 'test.exe', { type: 'text/plain' });
      const result = validateFileForUpload(file, { allowedExtensions: ['txt'] });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('extension is not allowed');
    });

    it('should reject files with invalid filename', () => {
      const file = new File(['content'], '<script>.txt', { type: 'text/plain' });
      const result = validateFileForUpload(file);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('dangerous character');
    });
  });
});