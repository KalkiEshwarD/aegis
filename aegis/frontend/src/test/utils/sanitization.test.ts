import {
  sanitizeHtml,
  sanitizeFilename,
  sanitizeUserInput,
  isValidEmail,
  isValidUsername,
  sanitizeSearchQuery,
  isValidFileSize,
  isValidMimeType,
  isValidFile,
} from '../../utils/sanitization';

describe('sanitizeHtml', () => {
  it('should encode HTML entities correctly', () => {
    expect(sanitizeHtml('<script>alert("xss")</script>')).toBe('<script>alert("xss")</script>');
    expect(sanitizeHtml('& < > " \' / ` =')).toBe('& < > " &#x27; &#x2F; &#x60; &#x3D;');
    expect(sanitizeHtml('normal text')).toBe('normal text');
  });

  it('should return empty string for non-string inputs', () => {
    expect(sanitizeHtml(null as any)).toBe('');
    expect(sanitizeHtml(undefined as any)).toBe('');
    expect(sanitizeHtml(123 as any)).toBe('');
    expect(sanitizeHtml({} as any)).toBe('');
  });
});

describe('sanitizeFilename', () => {
  it('should remove dangerous characters', () => {
    expect(sanitizeFilename('file<name>.txt')).toBe('filename.txt');
    expect(sanitizeFilename('file"name.txt')).toBe('filename.txt');
    expect(sanitizeFilename('file:name.txt')).toBe('filename.txt');
    expect(sanitizeFilename('file/name.txt')).toBe('filename.txt');
    expect(sanitizeFilename('file\\name.txt')).toBe('filename.txt');
    expect(sanitizeFilename('file|name.txt')).toBe('filename.txt');
    expect(sanitizeFilename('file?name.txt')).toBe('filename.txt');
    expect(sanitizeFilename('file*name.txt')).toBe('filename.txt');
  });

  it('should remove leading and trailing dots', () => {
    expect(sanitizeFilename('.hidden')).toBe('hidden');
    expect(sanitizeFilename('file.')).toBe('file');
    expect(sanitizeFilename('..hidden..')).toBe('hidden');
  });

  it('should normalize whitespace', () => {
    expect(sanitizeFilename('file  name.txt')).toBe('file name.txt');
    expect(sanitizeFilename('  file.txt  ')).toBe('file.txt');
  });

  it('should limit length to 255 characters', () => {
    const longName = 'a'.repeat(300) + '.txt';
    expect(sanitizeFilename(longName)).toHaveLength(255);
  });

  it('should return empty string for non-string inputs', () => {
    expect(sanitizeFilename(null as any)).toBe('');
    expect(sanitizeFilename(undefined as any)).toBe('');
    expect(sanitizeFilename(123 as any)).toBe('');
  });
});

describe('sanitizeUserInput', () => {
  it('should trim and remove control characters', () => {
    expect(sanitizeUserInput('  input  ')).toBe('input');
    expect(sanitizeUserInput('input\x00\x01\x02')).toBe('input');
    expect(sanitizeUserInput('input\x7F')).toBe('input');
  });

  it('should limit length to 1000 characters', () => {
    const longInput = 'a'.repeat(1200);
    expect(sanitizeUserInput(longInput)).toHaveLength(1000);
  });

  it('should return empty string for non-string inputs', () => {
    expect(sanitizeUserInput(null as any)).toBe('');
    expect(sanitizeUserInput(undefined as any)).toBe('');
    expect(sanitizeUserInput(123 as any)).toBe('');
  });
});

describe('isValidEmail', () => {
  const mockRules = {
    email: {
      regex: '^[\\w.-]+@[\\w.-]+\\.[a-zA-Z]{2,}$',
      maxLength: 254,
    },
  };

  beforeEach(() => {
    (global.fetch as jest.Mock).mockResolvedValue({
      json: jest.fn().mockResolvedValue(mockRules),
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should validate correct email formats', () => {
    expect(isValidEmail('user@example.com')).toBe(true);
    expect(isValidEmail('test.email+tag@domain.co.uk')).toBe(true);
  });

  it('should reject invalid email formats', () => {
    expect(isValidEmail('invalid')).toBe(false);
    expect(isValidEmail('@example.com')).toBe(false);
    expect(isValidEmail('user@')).toBe(false);
  });

  it('should reject emails exceeding max length', () => {
    const longEmail = 'a'.repeat(250) + '@example.com';
    expect(isValidEmail(longEmail)).toBe(false);
  });

  it('should return false for non-string inputs', () => {
    expect(isValidEmail(null as any)).toBe(false);
    expect(isValidEmail(undefined as any)).toBe(false);
    expect(isValidEmail(123 as any)).toBe(false);
  });
});

describe('isValidUsername', () => {
  it('should validate correct usernames', () => {
    expect(isValidUsername('user123')).toBe(true);
    expect(isValidUsername('test_user')).toBe(true);
    expect(isValidUsername('a-b-c')).toBe(true);
    expect(isValidUsername('user')).toBe(true);
  });

  it('should reject invalid usernames', () => {
    expect(isValidUsername('us')).toBe(false); // too short
    expect(isValidUsername('a'.repeat(51))).toBe(false); // too long
    expect(isValidUsername('user@name')).toBe(false); // invalid chars
    expect(isValidUsername('user name')).toBe(false); // spaces
    expect(isValidUsername('user#name')).toBe(false); // invalid chars
  });

  it('should return false for non-string inputs', () => {
    expect(isValidUsername(null as any)).toBe(false);
    expect(isValidUsername(undefined as any)).toBe(false);
    expect(isValidUsername(123 as any)).toBe(false);
  });
});

describe('sanitizeSearchQuery', () => {
  it('should trim and remove HTML characters', () => {
    expect(sanitizeSearchQuery('  query  ')).toBe('query');
    expect(sanitizeSearchQuery('<script>')).toBe('script');
    expect(sanitizeSearchQuery('query&test')).toBe('querytest');
    expect(sanitizeSearchQuery('query"test')).toBe('querytest');
  });

  it('should limit length to 100 characters', () => {
    const longQuery = 'a'.repeat(120);
    expect(sanitizeSearchQuery(longQuery)).toHaveLength(100);
  });

  it('should return empty string for non-string inputs', () => {
    expect(sanitizeSearchQuery(null as any)).toBe('');
    expect(sanitizeSearchQuery(undefined as any)).toBe('');
    expect(sanitizeSearchQuery(123 as any)).toBe('');
  });
});

describe('isValidFileSize', () => {
  it('should validate file sizes within limit', () => {
    expect(isValidFileSize(1024)).toBe(true);
    expect(isValidFileSize(104857600)).toBe(true); // 100MB limit
  });

  it('should reject file sizes exceeding limit', () => {
    expect(isValidFileSize(104857601)).toBe(false); // Over 100MB
  });

  it('should return false for invalid inputs', () => {
    expect(isValidFileSize(0)).toBe(false);
    expect(isValidFileSize(-1)).toBe(false);
    expect(isValidFileSize(null as any)).toBe(false);
    expect(isValidFileSize('1024' as any)).toBe(false);
  });
});

describe('isValidMimeType', () => {
  it('should validate allowed MIME types', () => {
    expect(isValidMimeType('image/jpeg')).toBe(true);
    expect(isValidMimeType('text/plain')).toBe(true);
    expect(isValidMimeType('application/pdf')).toBe(true);
    expect(isValidMimeType('video/mp4')).toBe(true);
    expect(isValidMimeType('audio/mp3')).toBe(true);
  });

  it('should reject disallowed MIME types', () => {
    expect(isValidMimeType('application/x-executable')).toBe(false);
    expect(isValidMimeType('application/octet-stream')).toBe(false);
  });

  it('should return false for non-string inputs', () => {
    expect(isValidMimeType(null as any)).toBe(false);
    expect(isValidMimeType(undefined as any)).toBe(false);
    expect(isValidMimeType(123 as any)).toBe(false);
  });
});

describe('isValidFile', () => {
  it('should validate complete file information', () => {
    expect(isValidFile('document.pdf', 1000000, 'application/pdf')).toBe(true);
    expect(isValidFile('image.jpg', 500000, 'image/jpeg')).toBe(true);
  });

  it('should reject invalid file information', () => {
    expect(isValidFile('document.pdf', 200000000, 'application/pdf')).toBe(false); // Too large
    expect(isValidFile('script.exe', 1000, 'application/x-executable')).toBe(false); // Invalid type
    expect(isValidFile('', 1000, 'text/plain')).toBe(false); // Empty filename
  });
});