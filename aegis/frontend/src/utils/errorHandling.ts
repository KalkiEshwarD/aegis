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
 * Error codes for different types of errors
 */
export const ERROR_CODES = {
  NETWORK_ERROR: 'NETWORK_ERROR',
  AUTHENTICATION_ERROR: 'AUTHENTICATION_ERROR',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  FILE_UPLOAD_ERROR: 'FILE_UPLOAD_ERROR',
  FILE_DOWNLOAD_ERROR: 'FILE_DOWNLOAD_ERROR',
  PERMISSION_ERROR: 'PERMISSION_ERROR',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
} as const;

export type ErrorCode = typeof ERROR_CODES[keyof typeof ERROR_CODES];

/**
 * Determines error code based on error message or type
 */
export const getErrorCode = (error: any): ErrorCode => {
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

  return ERROR_CODES.UNKNOWN_ERROR;
};