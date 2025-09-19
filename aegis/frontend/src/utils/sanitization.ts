/**
 * Input sanitization utilities for security
 */

// Validation rules interface
interface ValidationRules {
  username: {
    minLength: number;
    maxLength: number;
    regex: string;
  };
  email: {
    regex: string;
    maxLength: number;
  };
  password: {
    minLength: number;
    requireLower: boolean;
    requireUpper: boolean;
    requireDigit: boolean;
    requireSpecial: boolean;
    specialChars: string;
  };
  file: {
    maxSize: number;
    allowedMimeTypes: string[];
  };
}

// Load validation rules from shared configuration
let validationRules: ValidationRules | null = null;

const loadValidationRules = async (): Promise<ValidationRules> => {
  if (validationRules) return validationRules;

  try {
    const response = await fetch('/shared/validation-rules.json');
    validationRules = await response.json() as ValidationRules;
    return validationRules;
  } catch (error) {
    console.error('Failed to load validation rules:', error);
    throw error;
  }
};

// HTML entity encoding map
const htmlEntities: { [key: string]: string } = {
  '&': '&',
  '<': '<',
  '>': '>',
  '"': '"',
  "'": '&#x27;',
  '/': '&#x2F;',
  '`': '&#x60;',
  '=': '&#x3D;'
};

/**
 * Sanitizes input by encoding HTML entities to prevent XSS attacks
 */
export const sanitizeHtml = (input: string): string => {
  if (typeof input !== 'string') {
    return '';
  }

  return input.replace(/[&<>"'`=/]/g, (char) => htmlEntities[char] || char);
};

/**
 * Sanitizes filename by removing potentially dangerous characters
 */
export const sanitizeFilename = (filename: string): string => {
  if (typeof filename !== 'string') {
    return '';
  }

  // Remove or replace dangerous characters
  return filename
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '') // Remove dangerous chars
    .replace(/^\.+/, '') // Remove leading dots
    .replace(/\.+$/, '') // Remove trailing dots
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim()
    .substring(0, 255); // Limit length
};

/**
 * Sanitizes user input for database/storage
 */
export const sanitizeUserInput = (input: string): string => {
  if (typeof input !== 'string') {
    return '';
  }

  return input
    .trim()
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Remove control characters
    .substring(0, 1000); // Limit length
};

/**
 * Validates email format (additional check beyond Yup)
 */
export const isValidEmail = async (email: string): Promise<boolean> => {
  if (typeof email !== 'string') {
    return false;
  }

  try {
    const rules = await loadValidationRules();
    const emailRegex = new RegExp(rules.email.regex);
    return emailRegex.test(email) && email.length <= rules.email.maxLength;
  } catch (error) {
    console.error('Error validating email:', error);
    return false;
  }
};

/**
 * Validates username format
 */
export const isValidUsername = async (username: string): Promise<boolean> => {
  if (typeof username !== 'string') {
    return false;
  }

  try {
    const rules = await loadValidationRules();
    const usernameRegex = new RegExp(rules.username.regex);
    return usernameRegex.test(username) && username.length >= rules.username.minLength && username.length <= rules.username.maxLength;
  } catch (error) {
    console.error('Error validating username:', error);
    return false;
  }
};

/**
 * Sanitizes search query
 */
export const sanitizeSearchQuery = (query: string): string => {
  if (typeof query !== 'string') {
    return '';
  }

  return query
    .trim()
    .replace(/[<>'"&]/g, '') // Remove HTML characters
    .substring(0, 100); // Limit length
};

/**
 * Validates file size
 */
export const isValidFileSize = async (size: number): Promise<boolean> => {
  if (typeof size !== 'number' || size <= 0) {
    return false;
  }

  try {
    const rules = await loadValidationRules();
    return size <= rules.file.maxSize;
  } catch (error) {
    console.error('Error validating file size:', error);
    return false;
  }
};

/**
 * Validates MIME type
 */
export const isValidMimeType = async (mimeType: string): Promise<boolean> => {
  if (typeof mimeType !== 'string') {
    return false;
  }

  try {
    const rules = await loadValidationRules();
    return rules.file.allowedMimeTypes.some(type => mimeType.startsWith(type));
  } catch (error) {
    console.error('Error validating MIME type:', error);
    return false;
  }
};