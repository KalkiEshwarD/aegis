/**
 * Centralized validation configuration
 * This file provides a single source of truth for validation rules across the application
 */

import { 
  FileValidationRules, 
  PasswordRequirements, 
  StringValidationRules 
} from './validation';

// Username validation rules
export const USERNAME_VALIDATION_RULES: StringValidationRules = {
  required: true,
  min_length: 3,
  max_length: 50,
  pattern: '^[a-zA-Z0-9_-]+$',
  trim_whitespace: true
};

// Email validation rules
export const EMAIL_VALIDATION_RULES: StringValidationRules = {
  required: true,
  max_length: 254,
  pattern: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$',
  trim_whitespace: true
};

// Password validation rules
export const PASSWORD_VALIDATION_RULES: PasswordRequirements = {
  min_length: 8,
  require_upper: true,
  require_lower: true,
  require_digit: true,
  require_special: true,
  special_chars: '!@#$%^&*()_+-=[]{}|;:,.<>?'
};

// File validation rules
export const FILE_VALIDATION_RULES: FileValidationRules = {
  max_size: 104857600, // 100MB
  allowed_mime_types: [
    "image/",
    "video/",
    "audio/",
    "text/",
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  ],
  require_valid_name: true
};

// Search query validation rules
export const SEARCH_QUERY_VALIDATION_RULES: StringValidationRules = {
  required: false,
  max_length: 100,
  trim_whitespace: true
};

// Room name validation rules
export const ROOM_NAME_VALIDATION_RULES: StringValidationRules = {
  required: true,
  min_length: 1,
  max_length: 100,
  trim_whitespace: true
};

// Validation helper functions
export const getValidationRule = (ruleName: string) => {
  switch (ruleName) {
    case 'username':
      return USERNAME_VALIDATION_RULES;
    case 'email':
      return EMAIL_VALIDATION_RULES;
    case 'password':
      return PASSWORD_VALIDATION_RULES;
    case 'file':
      return FILE_VALIDATION_RULES;
    case 'search':
      return SEARCH_QUERY_VALIDATION_RULES;
    case 'roomName':
      return ROOM_NAME_VALIDATION_RULES;
    default:
      throw new Error(`Unknown validation rule: ${ruleName}`);
  }
};

// Type-safe validation rule names
export type ValidationRuleName = 'username' | 'email' | 'password' | 'file' | 'search' | 'roomName';