/**
 * Validation utilities for cross-stack consistency
 */

// Validation result interface (mirrors Go ValidationResult)
export interface ValidationResult {
  valid: boolean;
  errors?: string[];
}

// Email validation (mirrors Go ValidateEmail)
const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

export const validateEmail = (email: string): ValidationResult => {
  const errors: string[] = [];

  if (!email || email.trim() === '') {
    errors.push('Email is required');
    return { valid: false, errors };
  }

  const trimmedEmail = email.trim();

  if (trimmedEmail.length > 254) {
    errors.push('Email is too long (max 254 characters)');
  }

  if (!emailRegex.test(trimmedEmail)) {
    errors.push('Invalid email format');
  }

  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined
  };
};

// Username validation (mirrors Go ValidateUsername)
const usernameRegex = /^[a-zA-Z0-9_-]+$/;

export const validateUsername = (username: string): ValidationResult => {
  const errors: string[] = [];

  if (!username || username.trim() === '') {
    errors.push('Username is required');
    return { valid: false, errors };
  }

  const trimmedUsername = username.trim();

  if (trimmedUsername.length < 3) {
    errors.push('Username must be at least 3 characters long');
  }

  if (trimmedUsername.length > 50) {
    errors.push('Username must be no more than 50 characters long');
  }

  if (!usernameRegex.test(trimmedUsername)) {
    errors.push('Username can only contain letters, numbers, underscores, and hyphens');
  }

  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined
  };
};

// Password requirements interface (mirrors Go PasswordRequirements)
export interface PasswordRequirements {
  min_length: number;
  require_upper: boolean;
  require_lower: boolean;
  require_digit: boolean;
  require_special: boolean;
  special_chars: string;
}

// Default password requirements (mirrors Go DefaultPasswordRequirements)
export const defaultPasswordRequirements = (): PasswordRequirements => ({
  min_length: 8,
  require_upper: true,
  require_lower: true,
  require_digit: true,
  require_special: true,
  special_chars: '!@#$%^&*()_+-=[]{}|;:,.<>?',
});

// Password validation (mirrors Go ValidatePassword)
export const validatePassword = (password: string, reqs: PasswordRequirements = defaultPasswordRequirements()): ValidationResult => {
  const errors: string[] = [];

  if (!password || password.trim() === '') {
    errors.push('Password is required');
    return { valid: false, errors };
  }

  if (password.length < reqs.min_length) {
    errors.push(`Password must be at least ${reqs.min_length} characters long`);
  }

  if (reqs.require_upper && !/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }

  if (reqs.require_lower && !/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }

  if (reqs.require_digit && !/\d/.test(password)) {
    errors.push('Password must contain at least one digit');
  }

  if (reqs.require_special) {
    const hasSpecial = Array.from(password).some(char => reqs.special_chars.includes(char));
    if (!hasSpecial) {
      errors.push('Password must contain at least one special character');
    }
  }

  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined
  };
};

// File validation rules interface (mirrors Go FileValidationRules)
export interface FileValidationRules {
  max_size?: number;
  allowed_mime_types?: string[];
  allowed_extensions?: string[];
  require_valid_name?: boolean;
}

// File validation (mirrors Go ValidateFile)
export const validateFile = (
  filename: string,
  size: number,
  mimeType: string,
  rules: FileValidationRules
): ValidationResult => {
  const errors: string[] = [];

  // Validate filename
  if (rules.require_valid_name !== false) { // Default to true
    if (!filename || filename.trim() === '') {
      errors.push('Filename is required');
    } else if (filename.length > 255) {
      errors.push('Filename is too long (max 255 characters)');
    } else {
      // Check for dangerous characters
      const dangerousChars = ['<', '>', ':', '"', '|', '?', '*', '\x00'];
      for (const char of dangerousChars) {
        if (filename.includes(char)) {
          errors.push(`Filename contains dangerous character: ${char}`);
          break;
        }
      }
    }
  }

  // Validate file size
  if (rules.max_size && size > rules.max_size) {
    errors.push(`File size ${size} bytes exceeds maximum size ${rules.max_size} bytes`);
  }

  // Validate MIME type
  if (rules.allowed_mime_types && rules.allowed_mime_types.length > 0) {
    const allowed = rules.allowed_mime_types.some(allowedType =>
      mimeType.startsWith(allowedType)
    );
    if (!allowed) {
      errors.push(`MIME type ${mimeType} is not allowed`);
    }
  }

  // Validate file extension
  if (rules.allowed_extensions && rules.allowed_extensions.length > 0) {
    const ext = filename.split('.').pop()?.toLowerCase();
    if (!ext) {
      errors.push('File must have an extension');
    } else {
      const allowed = rules.allowed_extensions.some(allowedExt =>
        allowedExt.replace('.', '').toLowerCase() === ext
      );
      if (!allowed) {
        errors.push(`File extension ${ext} is not allowed`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined
  };
};

// String validation rules interface (mirrors Go StringValidationRules)
export interface StringValidationRules {
  required?: boolean;
  min_length?: number;
  max_length?: number;
  pattern?: string;
  trim_whitespace?: boolean;
}

// String validation (mirrors Go ValidateString)
export const validateString = (input: string, rules: StringValidationRules): ValidationResult => {
  const errors: string[] = [];
  let processedInput = rules.trim_whitespace !== false ? input.trim() : input; // Default to true

  if (rules.required && (!processedInput || processedInput === '')) {
    errors.push('This field is required');
    return { valid: false, errors };
  }

  if (processedInput === '' && !rules.required) {
    return { valid: true }; // Empty optional field is valid
  }

  if (rules.min_length && processedInput.length < rules.min_length) {
    errors.push(`Must be at least ${rules.min_length} characters long`);
  }

  if (rules.max_length && processedInput.length > rules.max_length) {
    errors.push(`Must be no more than ${rules.max_length} characters long`);
  }

  if (rules.pattern) {
    const regex = new RegExp(rules.pattern);
    if (!regex.test(processedInput)) {
      errors.push('Does not match required pattern');
    }
  }

  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined
  };
};

// Numeric validation rules interface (mirrors Go NumericValidationRules)
export interface NumericValidationRules {
  required?: boolean;
  min?: number;
  max?: number;
  is_int?: boolean;
}

// Numeric validation (mirrors Go ValidateNumber)
export const validateNumber = (input: number | null | undefined, rules: NumericValidationRules): ValidationResult => {
  const errors: string[] = [];

  if (input == null) {
    if (rules.required) {
      errors.push('This field is required');
    }
    return { valid: errors.length === 0, errors: errors.length > 0 ? errors : undefined };
  }

  const value = input;

  if (rules.is_int && !Number.isInteger(value)) {
    errors.push('Must be an integer');
  }

  if (rules.min !== undefined && value < rules.min) {
    errors.push(`Must be at least ${rules.min}`);
  }

  if (rules.max !== undefined && value > rules.max) {
    errors.push(`Must be no more than ${rules.max}`);
  }

  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined
  };
};

// URL validation (mirrors Go ValidateURL)
const urlRegex = /^https?:\/\/[^\s/$.?#].[^\s]*$/;

export const validateURL = (url: string): ValidationResult => {
  const errors: string[] = [];

  if (!url || url.trim() === '') {
    errors.push('URL is required');
    return { valid: false, errors };
  }

  const trimmedURL = url.trim();

  if (!urlRegex.test(trimmedURL)) {
    errors.push('Invalid URL format');
  }

  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined
  };
};

// Phone number validation (mirrors Go ValidatePhoneNumber)
const phoneRegex = /^\+?[\d\s\-\(\)]{10,}$/;

export const validatePhoneNumber = (phone: string): ValidationResult => {
  const errors: string[] = [];

  if (!phone || phone.trim() === '') {
    errors.push('Phone number is required');
    return { valid: false, errors };
  }

  const trimmedPhone = phone.trim();

  // Count digits
  const digitsOnly = trimmedPhone.replace(/\D/g, '');
  if (digitsOnly.length < 10) {
    errors.push('Phone number must have at least 10 digits');
  }

  if (digitsOnly.length > 15) {
    errors.push('Phone number must have no more than 15 digits');
  }

  if (!phoneRegex.test(trimmedPhone)) {
    errors.push('Invalid phone number format');
  }

  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined
  };
};

// UUID validation (mirrors Go ValidateUUID)
const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

export const validateUUID = (uuid: string): ValidationResult => {
  const errors: string[] = [];

  if (!uuid || uuid.trim() === '') {
    errors.push('UUID is required');
    return { valid: false, errors };
  }

  const trimmedUUID = uuid.trim();

  if (!uuidRegex.test(trimmedUUID)) {
    errors.push('Invalid UUID format');
  }

  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined
  };
};

// Date validation (mirrors Go ValidateDate)
export const validateDate = (dateStr: string, format: string = 'YYYY-MM-DD'): ValidationResult => {
  const errors: string[] = [];

  if (!dateStr || dateStr.trim() === '') {
    errors.push('Date is required');
    return { valid: false, errors };
  }

  const trimmedDate = dateStr.trim();

  if (format === 'YYYY-MM-DD') {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(trimmedDate)) {
      errors.push('Invalid date format (expected YYYY-MM-DD)');
    } else {
      // Check if it's a valid date
      const date = new Date(trimmedDate + 'T00:00:00');
      if (isNaN(date.getTime())) {
        errors.push('Invalid date');
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined
  };
};

// Combine multiple validation results (mirrors Go CombineValidationResults)
export const combineValidationResults = (...results: ValidationResult[]): ValidationResult => {
  const allErrors: string[] = [];

  for (const result of results) {
    if (!result.valid && result.errors) {
      allErrors.push(...result.errors);
    }
  }

  return {
    valid: allErrors.length === 0,
    errors: allErrors.length > 0 ? allErrors : undefined
  };
};

// Form validation helper
export interface FormValidationRules {
  [key: string]: StringValidationRules | NumericValidationRules | FileValidationRules;
}

export interface FormData {
  [key: string]: any;
}

export const validateForm = (data: FormData, rules: FormValidationRules): ValidationResult => {
  const results: ValidationResult[] = [];

  for (const [field, fieldRules] of Object.entries(rules)) {
    const value = data[field];

    if ('min_length' in fieldRules || 'max_length' in fieldRules || 'pattern' in fieldRules) {
      // String validation
      results.push(validateString(value || '', fieldRules as StringValidationRules));
    } else if ('min' in fieldRules || 'max' in fieldRules) {
      // Numeric validation
      results.push(validateNumber(value, fieldRules as NumericValidationRules));
    } else if ('max_size' in fieldRules || 'allowed_mime_types' in fieldRules) {
      // File validation - need filename, size, and mimeType
      const filename = data[field + '_filename'] || data.filename || '';
      const size = data[field + '_size'] || data.size || 0;
      const mimeType = data[field + '_mimeType'] || data.mimeType || '';
      results.push(validateFile(filename, size, mimeType, fieldRules as FileValidationRules));
    }
  }

  return combineValidationResults(...results);
};