/**
 * Input sanitization utilities for security
 * Uses centralized validation system for consistency
 */

import { 
  validateEmail as validateEmailFn, 
  validateUsername as validateUsernameFn,
  validateFile
} from './validation';

import { FILE_VALIDATION_RULES } from './validationConfig';

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
export const isValidEmail = (email: string): boolean => {
  if (typeof email !== 'string') {
    return false;
  }

  try {
    const result = validateEmailFn(email);
    return result.valid;
  } catch (error) {
    console.error('Error validating email:', error);
    return false;
  }
};

/**
 * Validates username format
 */
export const isValidUsername = (username: string): boolean => {
  if (typeof username !== 'string') {
    return false;
  }

  try {
    const result = validateUsernameFn(username);
    return result.valid;
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
export const isValidFileSize = (size: number): boolean => {
  if (typeof size !== 'number' || size <= 0) {
    return false;
  }

  try {
    return size <= (FILE_VALIDATION_RULES.max_size || 104857600);
  } catch (error) {
    console.error('Error validating file size:', error);
    return false;
  }
};

/**
 * Validates MIME type
 */
export const isValidMimeType = (mimeType: string): boolean => {
  if (typeof mimeType !== 'string') {
    return false;
  }

  try {
    const allowedMimeTypes = FILE_VALIDATION_RULES.allowed_mime_types || [];
    return allowedMimeTypes.some((type: string) => mimeType.startsWith(type));
  } catch (error) {
    console.error('Error validating MIME type:', error);
    return false;
  }
};

/**
 * Validates file (comprehensive validation)
 */
export const isValidFile = (filename: string, size: number, mimeType: string): boolean => {
  try {
    const result = validateFile(filename, size, mimeType, FILE_VALIDATION_RULES);
    return result.valid;
  } catch (error) {
    console.error('Error validating file:', error);
    return false;
  }
};