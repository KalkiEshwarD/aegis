import {
  validateEmail,
  validateUsername,
  validatePassword,
  defaultPasswordRequirements,
  validateFile,
  validateString,
  validateNumber,
  validateURL,
  validatePhoneNumber,
  validateUUID,
  validateDate,
  combineValidationResults,
  validateForm,
  type ValidationResult,
  type PasswordRequirements,
  type FileValidationRules,
  type StringValidationRules,
  type NumericValidationRules,
  type FormValidationRules,
  type FormData,
} from '../../utils/validation';

describe('validateEmail', () => {
  it('should validate correct email formats', () => {
    expect(validateEmail('user@example.com').valid).toBe(true);
    expect(validateEmail('test.email+tag@domain.co.uk').valid).toBe(true);
    expect(validateEmail('user_name@sub.domain.org').valid).toBe(true);
  });

  it('should reject invalid email formats', () => {
    expect(validateEmail('invalid').valid).toBe(false);
    expect(validateEmail('@example.com').valid).toBe(false);
    expect(validateEmail('user@').valid).toBe(false);
    expect(validateEmail('user@.com').valid).toBe(false);
    expect(validateEmail('user..double@example.com').valid).toBe(false);
  });

  it('should reject empty or whitespace emails', () => {
    expect(validateEmail('').valid).toBe(false);
    expect(validateEmail('   ').valid).toBe(false);
    expect(validateEmail(null as any).valid).toBe(false);
  });

  it('should reject emails exceeding max length', () => {
    const longEmail = 'a'.repeat(250) + '@example.com';
    expect(validateEmail(longEmail).valid).toBe(false);
    expect(validateEmail(longEmail).errors).toContain('Email is too long (max 254 characters)');
  });

  it('should return appropriate error messages', () => {
    const result = validateEmail('');
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Email is required');
  });
});

describe('validateUsername', () => {
  it('should validate correct usernames', () => {
    expect(validateUsername('user123').valid).toBe(true);
    expect(validateUsername('test_user').valid).toBe(true);
    expect(validateUsername('a-b').valid).toBe(true);
    expect(validateUsername('abc').valid).toBe(true);
  });

  it('should reject invalid usernames', () => {
    expect(validateUsername('us').valid).toBe(false); // too short
    expect(validateUsername('a'.repeat(51)).valid).toBe(false); // too long
    expect(validateUsername('user@name').valid).toBe(false); // invalid chars
    expect(validateUsername('user name').valid).toBe(false); // spaces
    expect(validateUsername('user.name').valid).toBe(false); // dots
  });

  it('should reject empty or whitespace usernames', () => {
    expect(validateUsername('').valid).toBe(false);
    expect(validateUsername('   ').valid).toBe(false);
  });

  it('should return appropriate error messages', () => {
    const result = validateUsername('');
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Username is required');

    const shortResult = validateUsername('us');
    expect(shortResult.errors).toContain('Username must be at least 3 characters long');

    const longResult = validateUsername('a'.repeat(51));
    expect(longResult.errors).toContain('Username must be no more than 50 characters long');

    const invalidResult = validateUsername('user@name');
    expect(invalidResult.errors).toContain('Username can only contain letters, numbers, underscores, and hyphens');
  });
});

describe('validatePassword', () => {
  const defaultReqs = defaultPasswordRequirements();

  it('should validate strong passwords with default requirements', () => {
    expect(validatePassword('StrongPass123!').valid).toBe(true);
    expect(validatePassword('MySecurePassword456@').valid).toBe(true);
  });

  it('should reject weak passwords', () => {
    expect(validatePassword('weak').valid).toBe(false); // too short, missing requirements
    expect(validatePassword('password').valid).toBe(false); // missing upper, digit, special
    expect(validatePassword('PASSWORD123').valid).toBe(false); // missing lower, special
    expect(validatePassword('password123!').valid).toBe(false); // missing upper
    expect(validatePassword('Password!').valid).toBe(false); // missing digit
    expect(validatePassword('Password123').valid).toBe(false); // missing special
  });

  it('should reject empty passwords', () => {
    expect(validatePassword('').valid).toBe(false);
    expect(validatePassword('   ').valid).toBe(false);
  });

  it('should work with custom requirements', () => {
    const customReqs: PasswordRequirements = {
      min_length: 6,
      require_upper: false,
      require_lower: true,
      require_digit: false,
      require_special: false,
      special_chars: '',
    };
    expect(validatePassword('simple', customReqs).valid).toBe(true);
    expect(validatePassword('SIMPLE', customReqs).valid).toBe(false); // missing lower
  });

  it('should return appropriate error messages', () => {
    const result = validatePassword('');
    expect(result.errors).toContain('Password is required');

    const shortResult = validatePassword('short');
    expect(shortResult.errors).toContain('Password must be at least 8 characters long');

    const noUpperResult = validatePassword('password123!');
    expect(noUpperResult.errors).toContain('Password must contain at least one uppercase letter');

    const noLowerResult = validatePassword('PASSWORD123!');
    expect(noLowerResult.errors).toContain('Password must contain at least one lowercase letter');

    const noDigitResult = validatePassword('Password!');
    expect(noDigitResult.errors).toContain('Password must contain at least one digit');

    const noSpecialResult = validatePassword('Password123');
    expect(noSpecialResult.errors).toContain('Password must contain at least one special character');
  });
});

describe('validateFile', () => {
  const basicRules: FileValidationRules = {
    max_size: 1048576, // 1MB
    allowed_mime_types: ['image/', 'text/'],
    allowed_extensions: ['.jpg', '.png', '.txt'],
  };

  it('should validate valid files', () => {
    const result = validateFile('image.jpg', 512000, 'image/jpeg', basicRules);
    expect(result.valid).toBe(true);
  });

  it('should reject files with dangerous characters in filename', () => {
    expect(validateFile('file<name>.txt', 1000, 'text/plain', basicRules).valid).toBe(false);
    expect(validateFile('file:name.txt', 1000, 'text/plain', basicRules).valid).toBe(false);
    expect(validateFile('file"test".txt', 1000, 'text/plain', basicRules).valid).toBe(false);
  });

  it('should reject files exceeding size limit', () => {
    const result = validateFile('large.jpg', 2000000, 'image/jpeg', basicRules);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('File size 2000000 bytes exceeds maximum size 1048576 bytes');
  });

  it('should reject files with disallowed MIME types', () => {
    const result = validateFile('document.pdf', 1000, 'application/pdf', basicRules);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('MIME type application/pdf is not allowed');
  });

  it('should reject files with disallowed extensions', () => {
    const result = validateFile('document.pdf', 1000, 'application/pdf', basicRules);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('File extension pdf is not allowed');
  });

  it('should reject files without extensions when required', () => {
    const result = validateFile('file', 1000, 'text/plain', basicRules);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('File must have an extension');
  });

  it('should validate files without filename validation when disabled', () => {
    const rules: FileValidationRules = { ...basicRules, require_valid_name: false };
    const result = validateFile('<dangerous>.txt', 1000, 'text/plain', rules);
    expect(result.valid).toBe(true);
  });

  it('should handle empty rules', () => {
    const result = validateFile('file.txt', 1000, 'text/plain', {});
    expect(result.valid).toBe(true);
  });
});

describe('validateString', () => {
  it('should validate required strings', () => {
    const rules: StringValidationRules = { required: true };
    expect(validateString('test', rules).valid).toBe(true);
    expect(validateString('', rules).valid).toBe(false);
    expect(validateString('   ', rules).valid).toBe(false);
  });

  it('should validate optional strings', () => {
    const rules: StringValidationRules = { required: false };
    expect(validateString('', rules).valid).toBe(true);
    expect(validateString('test', rules).valid).toBe(true);
  });

  it('should validate length constraints', () => {
    const rules: StringValidationRules = { min_length: 3, max_length: 10 };
    expect(validateString('hi', rules).valid).toBe(false);
    expect(validateString('hello', rules).valid).toBe(true);
    expect(validateString('this is too long', rules).valid).toBe(false);
  });

  it('should validate patterns', () => {
    const rules: StringValidationRules = { pattern: '^[A-Z]+$' };
    expect(validateString('HELLO', rules).valid).toBe(true);
    expect(validateString('hello', rules).valid).toBe(false);
  });

  it('should handle whitespace trimming', () => {
    const rules: StringValidationRules = { required: true, trim_whitespace: true };
    expect(validateString('  test  ', rules).valid).toBe(true);

    const noTrimRules: StringValidationRules = { required: true, trim_whitespace: false, min_length: 10 };
    expect(validateString('  test  ', noTrimRules).valid).toBe(true);
  });

  it('should return appropriate error messages', () => {
    const requiredRules: StringValidationRules = { required: true };
    expect(validateString('', requiredRules).errors).toContain('This field is required');

    const lengthRules: StringValidationRules = { min_length: 5 };
    expect(validateString('hi', lengthRules).errors).toContain('Must be at least 5 characters long');

    const maxLengthRules: StringValidationRules = { max_length: 3 };
    expect(validateString('hello', maxLengthRules).errors).toContain('Must be no more than 3 characters long');

    const patternRules: StringValidationRules = { pattern: '^[0-9]+$' };
    expect(validateString('abc', patternRules).errors).toContain('Does not match required pattern');
  });
});

describe('validateNumber', () => {
  it('should validate required numbers', () => {
    const rules: NumericValidationRules = { required: true };
    expect(validateNumber(5, rules).valid).toBe(true);
    expect(validateNumber(null, rules).valid).toBe(false);
    expect(validateNumber(undefined, rules).valid).toBe(false);
  });

  it('should validate optional numbers', () => {
    const rules: NumericValidationRules = { required: false };
    expect(validateNumber(null, rules).valid).toBe(true);
    expect(validateNumber(5, rules).valid).toBe(true);
  });

  it('should validate integer constraints', () => {
    const rules: NumericValidationRules = { is_int: true };
    expect(validateNumber(5, rules).valid).toBe(true);
    expect(validateNumber(5.5, rules).valid).toBe(false);
  });

  it('should validate range constraints', () => {
    const rules: NumericValidationRules = { min: 10, max: 20 };
    expect(validateNumber(15, rules).valid).toBe(true);
    expect(validateNumber(5, rules).valid).toBe(false);
    expect(validateNumber(25, rules).valid).toBe(false);
  });

  it('should return appropriate error messages', () => {
    const requiredRules: NumericValidationRules = { required: true };
    expect(validateNumber(null, requiredRules).errors).toContain('This field is required');

    const intRules: NumericValidationRules = { is_int: true };
    expect(validateNumber(5.5, intRules).errors).toContain('Must be an integer');

    const minRules: NumericValidationRules = { min: 10 };
    expect(validateNumber(5, minRules).errors).toContain('Must be at least 10');

    const maxRules: NumericValidationRules = { max: 20 };
    expect(validateNumber(25, maxRules).errors).toContain('Must be no more than 20');
  });
});

describe('validateURL', () => {
  it('should validate correct URLs', () => {
    expect(validateURL('https://example.com').valid).toBe(true);
    expect(validateURL('http://example.com/path').valid).toBe(true);
    expect(validateURL('https://sub.example.com/path?query=value').valid).toBe(true);
  });

  it('should reject invalid URLs', () => {
    expect(validateURL('not-a-url').valid).toBe(false);
    expect(validateURL('ftp://example.com').valid).toBe(false);
    expect(validateURL('example.com').valid).toBe(false);
    expect(validateURL('').valid).toBe(false);
  });

  it('should return appropriate error messages', () => {
    const result = validateURL('');
    expect(result.errors).toContain('URL is required');

    const invalidResult = validateURL('invalid');
    expect(invalidResult.errors).toContain('Invalid URL format');
  });
});

describe('validatePhoneNumber', () => {
  it('should validate correct phone numbers', () => {
    expect(validatePhoneNumber('+1234567890').valid).toBe(true);
    expect(validatePhoneNumber('1234567890').valid).toBe(true);
    expect(validatePhoneNumber('(123) 456-7890').valid).toBe(true);
    expect(validatePhoneNumber('+1 234 567 8901').valid).toBe(true);
  });

  it('should reject invalid phone numbers', () => {
    expect(validatePhoneNumber('123').valid).toBe(false); // too short
    expect(validatePhoneNumber('1'.repeat(20)).valid).toBe(false); // too long
    expect(validatePhoneNumber('abc123').valid).toBe(false); // invalid format
    expect(validatePhoneNumber('').valid).toBe(false);
  });

  it('should return appropriate error messages', () => {
    const result = validatePhoneNumber('');
    expect(result.errors).toContain('Phone number is required');

    const shortResult = validatePhoneNumber('123');
    expect(shortResult.errors).toContain('Phone number must have at least 10 digits');

    const longResult = validatePhoneNumber('1'.repeat(20));
    expect(longResult.errors).toContain('Phone number must have no more than 15 digits');

    const invalidResult = validatePhoneNumber('invalid');
    expect(invalidResult.errors).toContain('Invalid phone number format');
  });
});

describe('validateUUID', () => {
  it('should validate correct UUIDs', () => {
    expect(validateUUID('123e4567-e89b-12d3-a456-426614174000').valid).toBe(true);
    expect(validateUUID('550e8400-e29b-41d4-a716-446655440000').valid).toBe(true);
  });

  it('should reject invalid UUIDs', () => {
    expect(validateUUID('not-a-uuid').valid).toBe(false);
    expect(validateUUID('123e4567-e89b-12d3-a456').valid).toBe(false);
    expect(validateUUID('123e4567-e89b-12d3-a456-426614174000-extra').valid).toBe(false);
    expect(validateUUID('').valid).toBe(false);
  });

  it('should return appropriate error messages', () => {
    const result = validateUUID('');
    expect(result.errors).toContain('UUID is required');

    const invalidResult = validateUUID('invalid');
    expect(invalidResult.errors).toContain('Invalid UUID format');
  });
});

describe('validateDate', () => {
  it('should validate correct dates', () => {
    expect(validateDate('2023-01-15').valid).toBe(true);
    expect(validateDate('2020-02-29').valid).toBe(true); // leap year
    expect(validateDate('1999-12-31').valid).toBe(true);
  });

  it('should reject invalid dates', () => {
    expect(validateDate('2023-13-01').valid).toBe(false); // invalid month
    expect(validateDate('2023-01-32').valid).toBe(false); // invalid day
    expect(validateDate('2021-02-29').valid).toBe(false); // not leap year
    expect(validateDate('not-a-date').valid).toBe(false);
    expect(validateDate('').valid).toBe(false);
  });

  it('should return appropriate error messages', () => {
    const result = validateDate('');
    expect(result.errors).toContain('Date is required');

    const invalidResult = validateDate('invalid');
    expect(invalidResult.errors).toContain('Invalid date format (expected YYYY-MM-DD)');

    const badDateResult = validateDate('2023-13-01');
    expect(badDateResult.errors).toContain('Invalid date');
  });
});

describe('combineValidationResults', () => {
  it('should combine valid results', () => {
    const result1: ValidationResult = { valid: true };
    const result2: ValidationResult = { valid: true };
    const combined = combineValidationResults(result1, result2);
    expect(combined.valid).toBe(true);
    expect(combined.errors).toBeUndefined();
  });

  it('should combine results with errors', () => {
    const result1: ValidationResult = { valid: false, errors: ['Error 1'] };
    const result2: ValidationResult = { valid: false, errors: ['Error 2', 'Error 3'] };
    const combined = combineValidationResults(result1, result2);
    expect(combined.valid).toBe(false);
    expect(combined.errors).toEqual(['Error 1', 'Error 2', 'Error 3']);
  });

  it('should handle mixed valid and invalid results', () => {
    const result1: ValidationResult = { valid: true };
    const result2: ValidationResult = { valid: false, errors: ['Error'] };
    const combined = combineValidationResults(result1, result2);
    expect(combined.valid).toBe(false);
    expect(combined.errors).toEqual(['Error']);
  });

  it('should handle empty results array', () => {
    const combined = combineValidationResults();
    expect(combined.valid).toBe(true);
    expect(combined.errors).toBeUndefined();
  });
});

describe('validateForm', () => {
  it('should validate form with string fields', () => {
    const data: FormData = { name: 'John', email: 'john@example.com' };
    const rules: FormValidationRules = {
      name: { required: true, min_length: 2 },
      email: { required: true, pattern: '^[\\w.-]+@[\\w.-]+\\.[a-zA-Z]{2,}$' },
    };
    const result = validateForm(data, rules);
    expect(result.valid).toBe(true);
  });

  it('should validate form with numeric fields', () => {
    const data: FormData = { age: 25, score: 85.5 };
    const rules: FormValidationRules = {
      age: { required: true, min: 18, max: 100, is_int: true },
      score: { min: 0, max: 100 },
    };
    const result = validateForm(data, rules);
    expect(result.valid).toBe(true);
  });

  it('should validate form with file fields', () => {
    const data: FormData = {
      avatar: 'file data',
      avatar_filename: 'photo.jpg',
      avatar_size: 102400,
      avatar_mimeType: 'image/jpeg',
    };
    const rules: FormValidationRules = {
      avatar: { max_size: 1048576, allowed_mime_types: ['image/'] },
    };
    const result = validateForm(data, rules);
    expect(result.valid).toBe(true);
  });

  it('should collect errors from multiple fields', () => {
    const data: FormData = { name: '', age: 15 };
    const rules: FormValidationRules = {
      name: { required: true },
      age: { min: 18 },
    };
    const result = validateForm(data, rules);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('This field is required');
    expect(result.errors).toContain('Must be at least 18');
  });

  it('should handle missing data gracefully', () => {
    const data: FormData = {};
    const rules: FormValidationRules = {
      name: { required: true },
    };
    const result = validateForm(data, rules);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('This field is required');
  });
});