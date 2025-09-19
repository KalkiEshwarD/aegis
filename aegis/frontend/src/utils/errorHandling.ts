/**
 * Error handling utilities for consistent error management across the application
 */

export interface AppError {
  message: string;
  code?: string;
  details?: any;
}

/**
 * Extracts error message from various error types
 */
export const getErrorMessage = (error: any): string => {
  if (typeof error === 'string') {
    return error;
  }

  if (error?.message) {
    return error.message;
  }

  if (error?.graphQLErrors?.[0]?.message) {
    return error.graphQLErrors[0].message;
  }

  if (error?.networkError?.message) {
    return error.networkError.message;
  }

  return 'An unexpected error occurred';
};

/**
 * Creates a standardized error object
 */
export const createAppError = (
  message: string,
  code?: string,
  details?: any
): AppError => ({
  message,
  code,
  details,
});

/**
 * Handles async operations with consistent error handling
 */
export const handleAsyncOperation = async <T>(
  operation: () => Promise<T>,
  errorHandler?: (error: AppError) => void
): Promise<T | null> => {
  try {
    return await operation();
  } catch (error) {
    const appError = createAppError(getErrorMessage(error));
    errorHandler?.(appError);
    return null;
  }
};

/**
 * Logs errors in development mode
 */
export const logError = (error: any, context?: string) => {
  if (process.env.NODE_ENV === 'development') {
    console.error(`Error${context ? ` in ${context}` : ''}:`, error);
  }
};

/**
 * Error codes for different types of errors - loaded from shared configuration
 */
let ERROR_CODES: Record<string, string> = {
  NETWORK_ERROR: 'network_error',
  AUTHENTICATION_ERROR: 'authentication_error',
  VALIDATION_ERROR: 'validation_error',
  FILE_UPLOAD_ERROR: 'file_upload_error',
  FILE_DOWNLOAD_ERROR: 'file_download_error',
  PERMISSION_ERROR: 'permission_error',
  UNKNOWN_ERROR: 'unknown_error',
};

// Load shared error codes from JSON file
async function loadSharedErrorCodes() {
  try {
    const response = await fetch('/shared/error-codes.json');
    if (response.ok) {
      const sharedCodes = await response.json();
      ERROR_CODES = {
        NETWORK_ERROR: sharedCodes.NETWORK_ERROR || 'network_error',
        AUTHENTICATION_ERROR: sharedCodes.AUTHENTICATION_ERROR || 'authentication_error',
        VALIDATION_ERROR: sharedCodes.VALIDATION_ERROR || 'validation_error',
        FILE_UPLOAD_ERROR: sharedCodes.FILE_UPLOAD_ERROR || 'file_upload_error',
        FILE_DOWNLOAD_ERROR: sharedCodes.FILE_DOWNLOAD_ERROR || 'file_download_error',
        PERMISSION_ERROR: sharedCodes.PERMISSION_ERROR || 'permission_error',
        UNKNOWN_ERROR: sharedCodes.UNKNOWN_ERROR || 'unknown_error',
      };
    }
  } catch (error) {
    // If loading fails, use default values
    console.warn('Failed to load shared error codes, using defaults:', error);
  }
}

// Load error codes on module initialization
loadSharedErrorCodes();

export { ERROR_CODES };

export type ErrorCode = typeof ERROR_CODES[keyof typeof ERROR_CODES];

/**
 * Determines error code based on error message, type, or GraphQL extensions
 */
export const getErrorCode = (error: any): string => {
  // Check if error has extensions with code (from GraphQL)
  if (error?.extensions?.code) {
    return error.extensions.code;
  }

  // Check if error has graphQLErrors with extensions
  if (error?.graphQLErrors?.[0]?.extensions?.code) {
    return error.graphQLErrors[0].extensions.code;
  }

  // Fallback to message-based detection
  const message = getErrorMessage(error).toLowerCase();

  if (message.includes('network') || message.includes('fetch')) {
    return ERROR_CODES.NETWORK_ERROR;
  }

  if (message.includes('unauthorized') || message.includes('authentication')) {
    return ERROR_CODES.AUTHENTICATION_ERROR;
  }

  if (message.includes('validation') || message.includes('invalid')) {
    return ERROR_CODES.VALIDATION_ERROR;
  }

  if (message.includes('upload')) {
    return ERROR_CODES.FILE_UPLOAD_ERROR;
  }

  if (message.includes('download')) {
    return ERROR_CODES.FILE_DOWNLOAD_ERROR;
  }

  if (message.includes('permission') || message.includes('forbidden')) {
    return ERROR_CODES.PERMISSION_ERROR;
  }

  if (message.includes('storage quota')) {
    return ERROR_CODES.STORAGE_QUOTA_EXCEEDED || 'storage_quota_exceeded';
  }

  return ERROR_CODES.UNKNOWN_ERROR;
};