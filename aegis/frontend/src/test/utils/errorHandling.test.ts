import {
  getErrorMessage,
  createAppError,
  handleAsyncOperation,
  logError,
  getErrorCode,
  ERROR_CODES,
} from '../../utils/errorHandling';

describe('Error Handling Utils', () => {
  describe('getErrorMessage', () => {
    it('should return string errors as-is', () => {
      expect(getErrorMessage('Simple error')).toBe('Simple error');
    });

    it('should extract message from error objects', () => {
      const error = new Error('Error message');
      expect(getErrorMessage(error)).toBe('Error message');
    });

    it('should extract GraphQL error messages', () => {
      const error = {
        graphQLErrors: [{ message: 'GraphQL error' }],
      };
      expect(getErrorMessage(error)).toBe('GraphQL error');
    });

    it('should extract network error messages', () => {
      const error = {
        networkError: { message: 'Network error' },
      };
      expect(getErrorMessage(error)).toBe('Network error');
    });

    it('should return default message for unknown errors', () => {
      expect(getErrorMessage(null)).toBe('An unexpected error occurred');
      expect(getErrorMessage(undefined)).toBe('An unexpected error occurred');
      expect(getErrorMessage({})).toBe('An unexpected error occurred');
    });
  });

  describe('createAppError', () => {
    it('should create error with message only', () => {
      const error = createAppError('Test error');
      expect(error.message).toBe('Test error');
      expect(error.code).toBeUndefined();
      expect(error.details).toBeUndefined();
    });

    it('should create error with all fields', () => {
      const error = createAppError('Test error', 'TEST_CODE', { extra: 'data' });
      expect(error.message).toBe('Test error');
      expect(error.code).toBe('TEST_CODE');
      expect(error.details).toEqual({ extra: 'data' });
    });
  });

  describe('handleAsyncOperation', () => {
    it('should return result on successful operation', async () => {
      const operation = jest.fn().mockResolvedValue('success');
      const result = await handleAsyncOperation(operation);
      expect(result).toBe('success');
      expect(operation).toHaveBeenCalled();
    });

    it('should return null and call error handler on failure', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('Operation failed'));
      const errorHandler = jest.fn();

      const result = await handleAsyncOperation(operation, errorHandler);

      expect(result).toBeNull();
      expect(errorHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Operation failed',
        })
      );
    });

    it('should work without error handler', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('Operation failed'));
      const result = await handleAsyncOperation(operation);
      expect(result).toBeNull();
    });
  });

  describe('logError', () => {
    const originalEnv = process.env.NODE_ENV;
    let consoleSpy: jest.SpyInstance;

    beforeEach(() => {
      consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    });

    afterEach(() => {
      consoleSpy.mockRestore();
      // @ts-ignore - Allow assignment for testing
      process.env.NODE_ENV = originalEnv;
    });

    it('should log errors in development mode', () => {
      // @ts-ignore - Allow assignment for testing
      process.env.NODE_ENV = 'development';
      logError('Test error', 'test context');

      expect(consoleSpy).toHaveBeenCalledWith('Error in test context:', 'Test error');
    });

    it('should not log errors in production mode', () => {
      // @ts-ignore - Allow assignment for testing
      process.env.NODE_ENV = 'production';
      logError('Test error');

      expect(consoleSpy).not.toHaveBeenCalled();
    });

    it('should log without context', () => {
      // @ts-ignore - Allow assignment for testing
      process.env.NODE_ENV = 'development';
      logError('Test error');

      expect(consoleSpy).toHaveBeenCalledWith('Error:', 'Test error');
    });
  });

  describe('getErrorCode', () => {
    it('should extract code from GraphQL extensions', () => {
      const error = {
        extensions: { code: 'CUSTOM_ERROR' },
      };
      expect(getErrorCode(error)).toBe('CUSTOM_ERROR');
    });

    it('should extract code from GraphQL errors extensions', () => {
      const error = {
        graphQLErrors: [{ extensions: { code: 'GRAPHQL_ERROR' } }],
      };
      expect(getErrorCode(error)).toBe('GRAPHQL_ERROR');
    });

    it('should detect network errors', () => {
      expect(getErrorCode('Network error occurred')).toBe(ERROR_CODES.NETWORK_ERROR);
      expect(getErrorCode('Failed to fetch')).toBe(ERROR_CODES.NETWORK_ERROR);
    });

    it('should detect authentication errors', () => {
      expect(getErrorCode('Unauthorized access')).toBe(ERROR_CODES.AUTHENTICATION_ERROR);
      expect(getErrorCode('Authentication failed')).toBe(ERROR_CODES.AUTHENTICATION_ERROR);
    });

    it('should detect validation errors', () => {
      expect(getErrorCode('Validation failed')).toBe(ERROR_CODES.VALIDATION_ERROR);
      expect(getErrorCode('Invalid input')).toBe(ERROR_CODES.VALIDATION_ERROR);
    });

    it('should detect upload errors', () => {
      expect(getErrorCode('Upload failed')).toBe(ERROR_CODES.FILE_UPLOAD_ERROR);
    });

    it('should detect download errors', () => {
      expect(getErrorCode('Download failed')).toBe(ERROR_CODES.FILE_DOWNLOAD_ERROR);
    });

    it('should detect permission errors', () => {
      expect(getErrorCode('Permission denied')).toBe(ERROR_CODES.PERMISSION_ERROR);
      expect(getErrorCode('Forbidden')).toBe(ERROR_CODES.PERMISSION_ERROR);
    });

    it('should return unknown error for unrecognized messages', () => {
      expect(getErrorCode('Some random error')).toBe(ERROR_CODES.UNKNOWN_ERROR);
    });

    it('should handle null/undefined errors', () => {
      expect(getErrorCode(null)).toBe(ERROR_CODES.UNKNOWN_ERROR);
      expect(getErrorCode(undefined)).toBe(ERROR_CODES.UNKNOWN_ERROR);
    });
  });

  describe('ERROR_CODES', () => {
    it('should have all required error codes', () => {
      expect(ERROR_CODES.NETWORK_ERROR).toBeDefined();
      expect(ERROR_CODES.AUTHENTICATION_ERROR).toBeDefined();
      expect(ERROR_CODES.VALIDATION_ERROR).toBeDefined();
      expect(ERROR_CODES.FILE_UPLOAD_ERROR).toBeDefined();
      expect(ERROR_CODES.FILE_DOWNLOAD_ERROR).toBeDefined();
      expect(ERROR_CODES.PERMISSION_ERROR).toBeDefined();
      expect(ERROR_CODES.UNKNOWN_ERROR).toBeDefined();
    });

    it('should have string values', () => {
      Object.values(ERROR_CODES).forEach(code => {
        expect(typeof code).toBe('string');
        expect(code.length).toBeGreaterThan(0);
      });
    });
  });
});