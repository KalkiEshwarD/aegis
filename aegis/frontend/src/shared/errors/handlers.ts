/**
 * Centralized error handling utilities
 */

import { getErrorMessage, createAppError, AppError } from '../../utils/errorHandling';

// Enhanced error handler with logging and user feedback
export const handleAsyncError = async <T>(
  operation: () => Promise<T>,
  options: {
    logContext?: string;
    showToast?: boolean;
    fallbackValue?: T;
  } = {}
): Promise<T | undefined> => {
  try {
    return await operation();
  } catch (error) {
    const appError = createAppError(getErrorMessage(error));

    // Log error in development
    if (process.env.NODE_ENV === 'development') {
      console.error(`Error in ${options.logContext || 'unknown context'}:`, error);
    }

    // Show toast notification if requested
    if (options.showToast) {
      // Assuming a toast system is available
      // toast.error(appError.message);
    }

    // Return fallback value if provided
    if (options.fallbackValue !== undefined) {
      return options.fallbackValue;
    }

    throw appError;
  }
};

// Handle file operation errors specifically
export const handleFileOperationError = (error: any, operation: string, filename: string): AppError => {
  const message = `Failed to ${operation} file "${filename}": ${getErrorMessage(error)}`;
  return createAppError(message, 'FILE_OPERATION_ERROR');
};

// Handle network errors
export const handleNetworkError = (error: any, operation: string): AppError => {
  const message = `Network error during ${operation}: ${getErrorMessage(error)}`;
  return createAppError(message, 'NETWORK_ERROR');
};

// Handle GraphQL errors
export const handleGraphQLError = (error: any, operation: string): AppError => {
  const message = `GraphQL error during ${operation}: ${getErrorMessage(error)}`;
  return createAppError(message, 'GRAPHQL_ERROR');
};

// Generic error handler for user actions
export const handleUserActionError = (error: any, action: string): AppError => {
  const message = `Failed to ${action}: ${getErrorMessage(error)}`;
  return createAppError(message, 'USER_ACTION_ERROR');
};

// Check if error is a validation error
export const isValidationError = (error: any): boolean => {
  return error?.code === 'VALIDATION_ERROR' || error?.message?.includes('validation');
};

// Check if error is a network error
export const isNetworkError = (error: any): boolean => {
  return error?.code === 'NETWORK_ERROR' || error?.message?.includes('network');
};

// Check if error is an authentication error
export const isAuthError = (error: any): boolean => {
  return error?.code === 'UNAUTHORIZED' || error?.message?.includes('unauthorized');
};

// Get user-friendly error message
export const getUserFriendlyErrorMessage = (error: any): string => {
  if (isValidationError(error)) {
    return 'Please check your input and try again.';
  }
  if (isNetworkError(error)) {
    return 'Network error. Please check your connection and try again.';
  }
  if (isAuthError(error)) {
    return 'You need to log in to perform this action.';
  }
  return 'An unexpected error occurred. Please try again.';
};