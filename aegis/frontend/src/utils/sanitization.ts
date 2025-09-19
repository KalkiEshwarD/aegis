/**
 * Input sanitization utilities for security
 */

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

  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  return emailRegex.test(email) && email.length <= 254;
};

/**
 * Validates username format
 */
export const isValidUsername = (username: string): boolean => {
  if (typeof username !== 'string') {
    return false;
  }

  const usernameRegex = /^[a-zA-Z0-9]+$/;
  return usernameRegex.test(username) && username.length >= 3 && username.length <= 50;
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
export const isValidFileSize = (size: number, maxSize: number = 100 * 1024 * 1024): boolean => {
  return typeof size === 'number' && size > 0 && size <= maxSize;
};

/**
 * Validates MIME type
 */
export const isValidMimeType = (mimeType: string, allowedTypes: string[] = []): boolean => {
  if (typeof mimeType !== 'string') {
    return false;
  }

  if (allowedTypes.length === 0) {
    // Default allowed types
    const defaultAllowed = [
      'image/', 'video/', 'audio/', 'text/', 'application/pdf',
      'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];
    return defaultAllowed.some(type => mimeType.startsWith(type));
  }

  return allowedTypes.some(type => mimeType.startsWith(type));
};