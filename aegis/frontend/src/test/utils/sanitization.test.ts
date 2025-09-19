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

// Mock fetch globally
global.fetch = jest.fn();

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

  it('should validate correct email formats', async () => {
    expect(await isValidEmail('user@example.com')).toBe(true);
    expect(await isValidEmail('test.email+tag@domain.co.uk')).toBe(true);
  });

  it('should reject invalid email formats', async () => {
    expect(await isValidEmail('invalid')).toBe(false);
    expect(await isValidEmail('@example.com')).toBe(false);
    expect(await isValidEmail('user@')).toBe(false);
  });

  it('should reject emails exceeding max length', async () => {
    const longEmail = 'a'.repeat(250) + '@example.com';
    expect(await isValidEmail(longEmail)).toBe(false);
  });

  it('should return false for non-string inputs', async () => {
    expect(await isValidEmail(null as any)).toBe(false);
    expect(await isValidEmail(undefined as any)).toBe(false);
    expect(await isValidEmail(123 as any)).toBe(false);
  });

  it('should handle fetch errors', async () => {
    (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));
    expect(await isValidEmail('user@example.com')).toBe(false);
  });
});

describe('isValidUsername', () => {
  const mockRules = {
    username: {
      regex: '^[a-zA-Z0-9_-]{3,20}$',
      minLength: 3,
      maxLength: 20,
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

  it('should validate correct usernames', async () => {
    expect(await isValidUsername('user123')).toBe(true);
    expect(await isValidUsername('test_user')).toBe(true);
    expect(await isValidUsername('a-b')).toBe(true);
  });

  it('should reject invalid usernames', async () => {
    expect(await isValidUsername('us')).toBe(false); // too short
    expect(await isValidUsername('a'.repeat(25))).toBe(false); // too long
    expect(await isValidUsername('user@name')).toBe(false); // invalid chars
    expect(await isValidUsername('user name')).toBe(false); // spaces
  });

  it('should return false for non-string inputs', async () => {
    expect(await isValidUsername(null as any)).toBe(false);
    expect(await isValidUsername(undefined as any)).toBe(false);
    expect(await isValidUsername(123 as any)).toBe(false);
  });

  it('should handle fetch errors', async () => {
    (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));
    expect(await isValidUsername('user123')).toBe(false);
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
  const mockRules = {
    file: {
      maxSize: 10485760, // 10MB
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

  it('should validate file sizes within limit', async () => {
    expect(await isValidFileSize(1024)).toBe(true);
    expect(await isValidFileSize(10485760)).toBe(true);
  });

  it('should reject file sizes exceeding limit', async () => {
    expect(await isValidFileSize(10485761)).toBe(false);
  });

  it('should return false for invalid inputs', async () => {
    expect(await isValidFileSize(0)).toBe(false);
    expect(await isValidFileSize(-1)).toBe(false);
    expect(await isValidFileSize(null as any)).toBe(false);
    expect(await isValidFileSize('1024' as any)).toBe(false);
  });

  it('should handle fetch errors', async () => {
    (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));
    expect(await isValidFileSize(1024)).toBe(false);
  });
});

describe('isValidMimeType', () => {
  const mockRules = {
    file: {
      allowedMimeTypes: ['image/', 'text/', 'application/pdf'],
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

  it('should validate allowed MIME types', async () => {
    expect(await isValidMimeType('image/jpeg')).toBe(true);
    expect(await isValidMimeType('text/plain')).toBe(true);
    expect(await isValidMimeType('application/pdf')).toBe(true);
  });

  it('should reject disallowed MIME types', async () => {
    expect(await isValidMimeType('application/octet-stream')).toBe(false);
    expect(await isValidMimeType('video/mp4')).toBe(false);
  });

  it('should return false for non-string inputs', async () => {
    expect(await isValidMimeType(null as any)).toBe(false);
    expect(await isValidMimeType(undefined as any)).toBe(false);
    expect(await isValidMimeType(123 as any)).toBe(false);
  });

  it('should handle fetch errors', async () => {
    (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));
    expect(await isValidMimeType('image/jpeg')).toBe(false);
  });
});