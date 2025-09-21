import {
  formatFileSize,
  getMimeTypeFromExtension,
  isImageMimeType,
  isVideoMimeType,
  isAudioMimeType,
  isArchiveMimeType,
  isCodeFile,
  isDocumentFile,
  parseInt64,
  parseFloat64,
  formatTimestamp,
  parseTimestamp,
  truncateString,
  slugify,
  capitalizeFirst,
  camelToSnake,
  snakeToCamel,
  deepClone,
  safeJsonParse,
  safeJsonStringify,
} from '../../utils/dataTransformation';

/*
describe('Data Transformation Utils', () => {
  describe('formatFileSize', () => {
    it('should format 0 bytes', () => {
      expect(formatFileSize(0)).toBe('0 Bytes');
    });

    it('should format bytes', () => {
      expect(formatFileSize(512)).toBe('512 Bytes');
      expect(formatFileSize(1023)).toBe('1023 Bytes');
    });

    it('should format kilobytes', () => {
      expect(formatFileSize(1024)).toBe('1 KB');
      expect(formatFileSize(1536)).toBe('1.5 KB');
    });

    it('should format megabytes', () => {
      expect(formatFileSize(1048576)).toBe('1 MB');
      expect(formatFileSize(1572864)).toBe('1.5 MB');
    });

    it('should format gigabytes', () => {
      expect(formatFileSize(1073741824)).toBe('1 GB');
    });

    it('should format terabytes', () => {
      expect(formatFileSize(1099511627776)).toBe('1 TB');
    });

    it('should handle large numbers', () => {
      expect(formatFileSize(1125899906842624)).toBe('1024 TB');
    });
  });

  describe('getMimeTypeFromExtension', () => {
    it('should return correct MIME types for known extensions', () => {
      expect(getMimeTypeFromExtension('test.txt')).toBe('text/plain');
      expect(getMimeTypeFromExtension('document.pdf')).toBe('application/pdf');
      expect(getMimeTypeFromExtension('image.jpg')).toBe('image/jpeg');
      expect(getMimeTypeFromExtension('image.jpeg')).toBe('image/jpeg');
      expect(getMimeTypeFromExtension('video.mp4')).toBe('video/mp4');
      expect(getMimeTypeFromExtension('audio.mp3')).toBe('audio/mpeg');
      expect(getMimeTypeFromExtension('archive.zip')).toBe('application/zip');
    });

    it('should return default MIME type for unknown extensions', () => {
      expect(getMimeTypeFromExtension('file.unknown')).toBe('application/octet-stream');
      expect(getMimeTypeFromExtension('file.xyz')).toBe('application/octet-stream');
    });

    it('should handle files without extensions', () => {
      expect(getMimeTypeFromExtension('filename')).toBe('application/octet-stream');
    });

    it('should handle empty strings', () => {
      expect(getMimeTypeFromExtension('')).toBe('application/octet-stream');
    });

    it('should handle case insensitive extensions', () => {
      expect(getMimeTypeFromExtension('test.PDF')).toBe('application/pdf');
      expect(getMimeTypeFromExtension('test.JPG')).toBe('image/jpeg');
    });
  });

  describe('MIME type checks', () => {
    describe('isImageMimeType', () => {
      it('should identify image MIME types', () => {
        expect(isImageMimeType('image/jpeg')).toBe(true);
        expect(isImageMimeType('image/png')).toBe(true);
        expect(isImageMimeType('image/gif')).toBe(true);
      });

      it('should reject non-image MIME types', () => {
        expect(isImageMimeType('text/plain')).toBe(false);
        expect(isImageMimeType('video/mp4')).toBe(false);
        expect(isImageMimeType('application/pdf')).toBe(false);
      });
    });

    describe('isVideoMimeType', () => {
      it('should identify video MIME types', () => {
        expect(isVideoMimeType('video/mp4')).toBe(true);
        expect(isVideoMimeType('video/avi')).toBe(true);
      });

      it('should reject non-video MIME types', () => {
        expect(isVideoMimeType('image/jpeg')).toBe(false);
        expect(isVideoMimeType('text/plain')).toBe(false);
      });
    });

    describe('isAudioMimeType', () => {
      it('should identify audio MIME types', () => {
        expect(isAudioMimeType('audio/mpeg')).toBe(true);
        expect(isAudioMimeType('audio/wav')).toBe(true);
      });

      it('should reject non-audio MIME types', () => {
        expect(isAudioMimeType('image/jpeg')).toBe(false);
        expect(isAudioMimeType('video/mp4')).toBe(false);
      });
    });

    describe('isArchiveMimeType', () => {
      it('should identify archive MIME types', () => {
        expect(isArchiveMimeType('application/zip')).toBe(true);
        expect(isArchiveMimeType('application/x-rar-compressed')).toBe(true);
        expect(isArchiveMimeType('application/x-7z-compressed')).toBe(true);
        expect(isArchiveMimeType('application/gzip')).toBe(true);
      });

      it('should reject non-archive MIME types', () => {
        expect(isArchiveMimeType('image/jpeg')).toBe(false);
        expect(isArchiveMimeType('text/plain')).toBe(false);
      });
    });
  });

  describe('file type checks', () => {
    describe('isCodeFile', () => {
      it('should identify code files', () => {
        expect(isCodeFile('script.js')).toBe(true);
        expect(isCodeFile('component.tsx')).toBe(true);
        expect(isCodeFile('styles.css')).toBe(true);
        expect(isCodeFile('data.json')).toBe(true);
        expect(isCodeFile('program.py')).toBe(true);
        expect(isCodeFile('main.go')).toBe(true);
      });

      it('should reject non-code files', () => {
        expect(isCodeFile('document.txt')).toBe(false);
        expect(isCodeFile('image.jpg')).toBe(false);
        expect(isCodeFile('')).toBe(false);
        expect(isCodeFile('file')).toBe(false);
      });
    });

    describe('isDocumentFile', () => {
      it('should identify document files', () => {
        expect(isDocumentFile('document.doc')).toBe(true);
        expect(isDocumentFile('report.docx')).toBe(true);
        expect(isDocumentFile('notes.txt')).toBe(true);
      });

      it('should reject non-document files', () => {
        expect(isDocumentFile('image.jpg')).toBe(false);
        expect(isDocumentFile('script.js')).toBe(false);
        expect(isDocumentFile('')).toBe(false);
        expect(isDocumentFile('file')).toBe(false);
      });
    });
  });

  describe('parsing functions', () => {
    describe('parseInt64', () => {
      it('should parse valid integers', () => {
        expect(parseInt64('123')).toBe(123);
        expect(parseInt64('0')).toBe(0);
        expect(parseInt64('-456')).toBe(-456);
      });

      it('should return 0 for invalid inputs', () => {
        expect(parseInt64('')).toBe(0);
        expect(parseInt64('   ')).toBe(0);
        expect(parseInt64('abc')).toBe(0);
        expect(parseInt64('123.45')).toBe(0);
      });
    });

    describe('parseFloat64', () => {
      it('should parse valid floats', () => {
        expect(parseFloat64('123.45')).toBe(123.45);
        expect(parseFloat64('0')).toBe(0);
        expect(parseFloat64('-456.78')).toBe(-456.78);
      });

      it('should return 0 for invalid inputs', () => {
        expect(parseFloat64('')).toBe(0);
        expect(parseFloat64('   ')).toBe(0);
        expect(parseFloat64('abc')).toBe(0);
      });
    });
  });

  describe('timestamp functions', () => {
    describe('formatTimestamp', () => {
      it('should format date to ISO string', () => {
        const date = new Date('2023-12-25T10:30:45.000Z');
        expect(formatTimestamp(date)).toBe('2023-12-25T10:30:45.000Z');
      });
    });

    describe('parseTimestamp', () => {
      it('should parse valid ISO strings', () => {
        const result = parseTimestamp('2023-12-25T10:30:45.000Z');
        expect(result).toEqual(new Date('2023-12-25T10:30:45.000Z'));
      });

      it('should return null for invalid inputs', () => {
        expect(parseTimestamp('')).toBeNull();
        expect(parseTimestamp('   ')).toBeNull();
        expect(parseTimestamp('invalid-date')).toBeNull();
        expect(parseTimestamp('2023-13-45')).toBeNull();
      });
    });
  });

  describe('string manipulation', () => {
    describe('truncateString', () => {
      it('should not truncate short strings', () => {
        expect(truncateString('hello', 10)).toBe('hello');
      });

      it('should truncate long strings', () => {
        expect(truncateString('hello world', 8)).toBe('hello...');
        expect(truncateString('very long string', 5)).toBe('ve...');
      });

      it('should handle edge cases', () => {
        expect(truncateString('hi', 1)).toBe('h');
        expect(truncateString('hi', 2)).toBe('hi');
        expect(truncateString('hi', 3)).toBe('hi');
      });
    });

    describe('slugify', () => {
      it('should convert strings to slugs', () => {
        expect(slugify('Hello World')).toBe('hello-world');
        expect(slugify('Hello   World')).toBe('hello-world');
        expect(slugify('Hello@World!')).toBe('hello-world');
        expect(slugify('Hello--World')).toBe('hello-world');
      });

      it('should handle special cases', () => {
        expect(slugify('')).toBe('');
        expect(slugify('a')).toBe('a');
        expect(slugify('A')).toBe('a');
        expect(slugify('--hello--')).toBe('hello');
      });
    });

    describe('capitalizeFirst', () => {
      it('should capitalize first letter', () => {
        expect(capitalizeFirst('hello')).toBe('Hello');
        expect(capitalizeFirst('HELLO')).toBe('HELLO');
        expect(capitalizeFirst('hELLO')).toBe('HELLO');
      });

      it('should handle edge cases', () => {
        expect(capitalizeFirst('')).toBe('');
        expect(capitalizeFirst('a')).toBe('A');
        expect(capitalizeFirst('123')).toBe('123');
      });
    });

    describe('camelToSnake', () => {
      it('should convert camelCase to snake_case', () => {
        expect(camelToSnake('camelCase')).toBe('camel_case');
        expect(camelToSnake('CamelCase')).toBe('Camel_case');
        expect(camelToSnake('XMLHttpRequest')).toBe('XML_http_request');
      });

      it('should handle simple cases', () => {
        expect(camelToSnake('simple')).toBe('simple');
        expect(camelToSnake('')).toBe('');
      });
    });

    describe('snakeToCamel', () => {
      it('should convert snake_case to camelCase', () => {
        expect(snakeToCamel('snake_case')).toBe('snakeCase');
        expect(snakeToCamel('another_example')).toBe('anotherExample');
      });

      it('should handle edge cases', () => {
        expect(snakeToCamel('simple')).toBe('simple');
        expect(snakeToCamel('')).toBe('');
        expect(snakeToCamel('a_b_c')).toBe('aBC');
        expect(snakeToCamel('_leading')).toBe('Leading');
        expect(snakeToCamel('trailing_')).toBe('trailing');
      });
    });
  });

  describe('deepClone', () => {
    it('should clone primitive values', () => {
      expect(deepClone(42)).toBe(42);
      expect(deepClone('hello')).toBe('hello');
      expect(deepClone(true)).toBe(true);
      expect(deepClone(null)).toBe(null);
    });

    it('should clone dates', () => {
      const date = new Date();
      const cloned = deepClone(date);
      expect(cloned).toEqual(date);
      expect(cloned).not.toBe(date); // Different reference
    });

    it('should clone arrays', () => {
      const arr = [1, 2, { a: 3 }];
      const cloned = deepClone(arr);
      expect(cloned).toEqual(arr);
      expect(cloned).not.toBe(arr);
      expect(cloned[2]).not.toBe(arr[2]);
    });

    it('should clone objects', () => {
      const obj = { a: 1, b: { c: 2 } };
      const cloned = deepClone(obj);
      expect(cloned).toEqual(obj);
      expect(cloned).not.toBe(obj);
      expect(cloned.b).not.toBe(obj.b);
    });
  });

  describe('JSON utilities', () => {
    describe('safeJsonParse', () => {
      it('should parse valid JSON', () => {
        const obj = { a: 1, b: 'test' };
        const json = JSON.stringify(obj);
        expect(safeJsonParse(json, {})).toEqual(obj);
      });

      it('should return fallback for invalid JSON', () => {
        const fallback = { default: true };
        expect(safeJsonParse('invalid json', fallback)).toEqual(fallback);
        expect(safeJsonParse('', fallback)).toEqual(fallback);
      });
    });

    describe('safeJsonStringify', () => {
      it('should stringify valid objects', () => {
        const obj = { a: 1, b: 'test' };
        expect(safeJsonStringify(obj)).toBe(JSON.stringify(obj));
      });

      it('should return fallback for invalid objects', () => {
        const circular: any = {};
        circular.self = circular;

        expect(safeJsonStringify(circular)).toBe('{}');
        expect(safeJsonStringify(circular, 'fallback')).toBe('fallback');
      });
    });
  });
});
*/