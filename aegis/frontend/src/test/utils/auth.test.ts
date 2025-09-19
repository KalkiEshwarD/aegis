import { refreshAuthToken } from '../../utils/auth';

describe('Auth Utils', () => {
  let mockClient: any;

  beforeEach(() => {
    mockClient = {
      mutate: jest.fn(),
    };
    // Reset global state
    (global as any).isRefreshing = false;
    (global as any).refreshPromise = null;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('refreshAuthToken', () => {
    it('should successfully refresh token', async () => {
      const mockData = { refreshToken: true };
      mockClient.mutate.mockResolvedValue({
        data: mockData,
        errors: null,
      });

      const result = await refreshAuthToken(mockClient);

      expect(result).toBe(true);
      expect(mockClient.mutate).toHaveBeenCalledWith({
        mutation: expect.any(Object), // REFRESH_TOKEN_MUTATION
        fetchPolicy: 'no-cache',
      });
    });

    it('should return false when refresh fails with errors', async () => {
      const mockErrors = [{ message: 'Invalid token' }];
      mockClient.mutate.mockResolvedValue({
        data: null,
        errors: mockErrors,
      });

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const result = await refreshAuthToken(mockClient);

      expect(result).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith('Token refresh failed:', 'Invalid token');

      consoleSpy.mockRestore();
    });

    it('should return false when refresh returns no data', async () => {
      mockClient.mutate.mockResolvedValue({
        data: null,
        errors: null,
      });

      const result = await refreshAuthToken(mockClient);

      expect(result).toBe(false);
    });

    it('should return false when refresh data does not contain refreshToken', async () => {
      const mockData = { someOtherField: true };
      mockClient.mutate.mockResolvedValue({
        data: mockData,
        errors: null,
      });

      const result = await refreshAuthToken(mockClient);

      expect(result).toBe(false);
    });

    it('should handle network errors', async () => {
      const networkError = new Error('Network error');
      mockClient.mutate.mockRejectedValue(networkError);

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const result = await refreshAuthToken(mockClient);

      expect(result).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith('Token refresh error:', networkError);

      consoleSpy.mockRestore();
    });

    it('should prevent concurrent refresh calls', async () => {
      const mockData = { refreshToken: true };
      mockClient.mutate.mockResolvedValue({
        data: mockData,
        errors: null,
      });

      // Start two refresh calls simultaneously
      const promise1 = refreshAuthToken(mockClient);
      const promise2 = refreshAuthToken(mockClient);

      const [result1, result2] = await Promise.all([promise1, promise2]);

      expect(result1).toBe(true);
      expect(result2).toBe(true);
      // mutate should only be called once due to deduplication
      expect(mockClient.mutate).toHaveBeenCalledTimes(1);
    });

    it('should reset refreshing state after completion', async () => {
      const mockData = { refreshToken: true };
      mockClient.mutate.mockResolvedValue({
        data: mockData,
        errors: null,
      });

      await refreshAuthToken(mockClient);

      // State should be reset
      expect((global as any).isRefreshing).toBe(false);
      expect((global as any).refreshPromise).toBe(null);
    });

    it('should reset refreshing state after error', async () => {
      const networkError = new Error('Network error');
      mockClient.mutate.mockRejectedValue(networkError);

      await refreshAuthToken(mockClient);

      // State should be reset even after error
      expect((global as any).isRefreshing).toBe(false);
      expect((global as any).refreshPromise).toBe(null);
    });

    it('should handle multiple sequential calls correctly', async () => {
      const mockData = { refreshToken: true };
      mockClient.mutate.mockResolvedValue({
        data: mockData,
        errors: null,
      });

      // First call
      const result1 = await refreshAuthToken(mockClient);
      expect(result1).toBe(true);

      // Second call (should work independently)
      const result2 = await refreshAuthToken(mockClient);
      expect(result2).toBe(true);

      expect(mockClient.mutate).toHaveBeenCalledTimes(2);
    });

    it('should log success message', async () => {
      const mockData = { refreshToken: true };
      mockClient.mutate.mockResolvedValue({
        data: mockData,
        errors: null,
      });

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      await refreshAuthToken(mockClient);

      expect(consoleSpy).toHaveBeenCalledWith('Token refreshed successfully');

      consoleSpy.mockRestore();
    });
  });
});