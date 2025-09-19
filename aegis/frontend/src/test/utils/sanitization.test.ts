import {
  sanitizeHtml,
  sanitizeFilename,
  sanitizeUserInput,
  isValidEmail,
  isValidUsername,
  sanitizeSearchQuery,
  isValidFileSize,
  isValidMimeType,
} from '../../utils/sanitization';

describe('Sanitization Utils', () => {
  describe('sanitizeHtml', () => {
    it('should encode HTML entities to prevent XSS', () => {
      const input = '<script>alert("xss")</script><img src="x" onerror="alert(1)">';
      const expected = '<script>alert("xss")<&#x2F;script><img src&#x3D;"x" onerror&#x3D;"alert(1)">';

      expect(sanitizeHtml(input)).toBe(expected);
    });

    it('should handle all dangerous characters', () => {
      const input = '&<>"\'/`=';
      const expected = '&<>"&#x27;&#x2F;&#x60;&#x3D;';

      expect(sanitizeHtml(input)).toBe(expected);
    });

    it('should return empty string for non-string input', () => {
      expect(sanitizeHtml(null as any)).toBe('');
      expect(sanitizeHtml(undefined as any)).toBe('');
      expect(sanitizeHtml(123 as any)).toBe('');
    });

    it('should handle empty strings', () => {
      expect(sanitizeHtml('')).toBe('');
    });

    it('should preserve safe content', () => {
      const input = 'Hello World! This is safe content.';
      expect(sanitizeHtml(input)).toBe(input);
    });
  });

  describe('sanitizeFilename', () => {
    it('should remove dangerous characters', () => {
      const input = 'file<>:"/\\|?*name.txt';
      const expected = 'filename.txt';

      expect(sanitizeFilename(input)).toBe(expected);
    });

    it('should remove leading and trailing dots', () => {
      expect(sanitizeFilename('...file.txt')).toBe('file.txt');
      expect(sanitizeFilename('file.txt...')).toBe('file.txt');
    });

    it('should normalize whitespace', () => {
      expect(sanitizeFilename('file   with    spaces.txt')).toBe('file with spaces.txt');
    });

    it('should trim whitespace', () => {
      expect(sanitizeFilename('  file.txt  ')).toBe('file.txt');
    });

    it('should limit filename length', () => {
      const longName = 'a'.repeat(300) + '.txt';
      const result = sanitizeFilename(longName);
      expect(result.length).toBeLessThanOrEqual(255);
      expect(result).toBe('a'.repeat(255)); // Should be truncated and trailing dot removed
    });

    it('should return empty string for non-string input', () => {
      expect(sanitizeFilename(null as any)).toBe('');
      expect(sanitizeFilename(undefined as any)).toBe('');
    });

    it('should handle empty strings', () => {
      expect(sanitizeFilename('')).toBe('');
    });

    it('should preserve safe filenames', () => {
      const safeName = 'my_document_123.pdf';
      expect(sanitizeFilename(safeName)).toBe(safeName);
    });
  });

  describe('sanitizeUserInput', () => {
    it('should trim whitespace', () => {
      expect(sanitizeUserInput('  input  ')).toBe('input');
    });

    it('should remove control characters', () => {
      const input = 'input\x00\x01\x02\x03text';
      expect(sanitizeUserInput(input)).toBe('inputtext');
    });

    it('should limit input length', () => {
      const longInput = 'a'.repeat(1200);
      const result = sanitizeUserInput(longInput);
      expect(result.length).toBeLessThanOrEqual(1000);
    });

    it('should return empty string for non-string input', () => {
      expect(sanitizeUserInput(null as any)).toBe('');
      expect(sanitizeUserInput(undefined as any)).toBe('');
    });

    it('should handle empty strings', () => {
      expect(sanitizeUserInput('')).toBe('');
    });
  });

  describe('isValidEmail', () => {
    it('should validate correct email formats', () => {
      expect(isValidEmail('user@example.com')).toBe(true);
      expect(isValidEmail('test.email+tag@domain.co.uk')).toBe(true);
      expect(isValidEmail('user_name@subdomain.domain.org')).toBe(true);
    });

    it('should reject invalid email formats', () => {
      expect(isValidEmail('invalid')).toBe(false);
      expect(isValidEmail('@example.com')).toBe(false);
      expect(isValidEmail('user@')).toBe(false);
      expect(isValidEmail('user@@example.com')).toBe(false);
      expect(isValidEmail('user example.com')).toBe(false);
    });

    it('should reject emails that are too long', () => {
      const longEmail = 'a'.repeat(250) + '@example.com';
      expect(isValidEmail(longEmail)).toBe(false);
    });

    it('should return false for non-string input', () => {
      expect(isValidEmail(null as any)).toBe(false);
      expect(isValidEmail(undefined as any)).toBe(false);
      expect(isValidEmail(123 as any)).toBe(false);
    });
  });

  describe('isValidUsername', () => {
    it('should validate correct usernames', () => {
      expect(isValidUsername('user123')).toBe(true);
      expect(isValidUsername('test_user')).toBe(false); // underscores not allowed
      expect(isValidUsername('UserName')).toBe(true);
    });

    it('should reject usernames that are too short', () => {
      expect(isValidUsername('ab')).toBe(false);
    });

    it('should reject usernames that are too long', () => {
      const longUsername = 'a'.repeat(60);
      expect(isValidUsername(longUsername)).toBe(false);
    });

    it('should reject usernames with special characters', () => {
      expect(isValidUsername('user@name')).toBe(false);
      expect(isValidUsername('user-name')).toBe(false);
      expect(isValidUsername('user.name')).toBe(false);
    });

    it('should return false for non-string input', () => {
      expect(isValidUsername(null as any)).toBe(false);
      expect(isValidUsername(undefined as any)).toBe(false);
    });
  });

  describe('sanitizeSearchQuery', () => {
    it('should remove HTML characters', () => {
      const input = '<script>alert("xss")</script>search query';
      const expected = 'scriptalert(xss)/scriptsearch query';

      expect(sanitizeSearchQuery(input)).toBe(expected);
    });

    it('should trim whitespace', () => {
      expect(sanitizeSearchQuery('  query  ')).toBe('query');
    });

    it('should limit query length', () => {
      const longQuery = 'a'.repeat(150);
      const result = sanitizeSearchQuery(longQuery);
      expect(result.length).toBeLessThanOrEqual(100);
    });

    it('should return empty string for non-string input', () => {
      expect(sanitizeSearchQuery(null as any)).toBe('');
      expect(sanitizeSearchQuery(undefined as any)).toBe('');
    });
  });

  describe('isValidFileSize', () => {
    it('should validate file sizes within limits', () => {
      expect(isValidFileSize(1024)).toBe(true);
      expect(isValidFileSize(1024 * 1024)).toBe(true); // 1MB
      expect(isValidFileSize(100 * 1024 * 1024)).toBe(true); // 100MB (default max)
    });

    it('should reject invalid file sizes', () => {
      expect(isValidFileSize(0)).toBe(false);
      expect(isValidFileSize(-1024)).toBe(false);
      expect(isValidFileSize(101 * 1024 * 1024)).toBe(false); // Over default max
    });

    it('should use custom max size', () => {
      expect(isValidFileSize(2048, 1024)).toBe(false); // Over custom max
      expect(isValidFileSize(512, 1024)).toBe(true); // Under custom max
    });

    it('should reject non-number input', () => {
      expect(isValidFileSize('1024' as any)).toBe(false);
      expect(isValidFileSize(null as any)).toBe(false);
      expect(isValidFileSize(undefined as any)).toBe(false);
    });
  });

  describe('isValidMimeType', () => {
    it('should validate default allowed MIME types', () => {
      expect(isValidMimeType('image/jpeg')).toBe(true);
      expect(isValidMimeType('video/mp4')).toBe(true);
      expect(isValidMimeType('audio/mpeg')).toBe(true);
      expect(isValidMimeType('text/plain')).toBe(true);
      expect(isValidMimeType('application/pdf')).toBe(true);
    });

    it('should reject disallowed MIME types', () => {
      expect(isValidMimeType('application/x-executable')).toBe(false);
      expect(isValidMimeType('application/javascript')).toBe(false);
    });

    it('should validate against custom allowed types', () => {
      const allowedTypes = ['custom/type1', 'custom/type2'];
      expect(isValidMimeType('custom/type1', allowedTypes)).toBe(true);
      expect(isValidMimeType('custom/type2', allowedTypes)).toBe(true);
      expect(isValidMimeType('other/type', allowedTypes)).toBe(false);
    });

    it('should return false for non-string input', () => {
      expect(isValidMimeType(null as any)).toBe(false);
      expect(isValidMimeType(undefined as any)).toBe(false);
      expect(isValidMimeType(123 as any)).toBe(false);
    });

    it('should handle empty allowed types array', () => {
      expect(isValidMimeType('image/jpeg', [])).toBe(true); // Uses default types when empty
      expect(isValidMimeType('application/x-executable', [])).toBe(false);
    });
  });
});