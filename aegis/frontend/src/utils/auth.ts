import { REFRESH_TOKEN_MUTATION } from '../apollo/queries';
import { AuthPayload } from '../types';

// Global variable to track if a refresh is in progress
let isRefreshing = false;
let refreshPromise: Promise<boolean> | null = null;

export const refreshAuthToken = async (client: any): Promise<boolean> => {
  // If a refresh is already in progress, return the existing promise
  if (isRefreshing && refreshPromise) {
    return refreshPromise;
  }

  isRefreshing = true;

  try {
    refreshPromise = (async () => {
      const { data, errors } = await client.mutate({
        mutation: REFRESH_TOKEN_MUTATION,
        fetchPolicy: 'no-cache', // Don't cache refresh requests
      });

      if (errors && errors.length > 0) {
        console.error('Token refresh failed:', errors[0].message);
        return false;
      }

      if (data?.refreshToken) {
        console.log('Token refreshed successfully');
        return true;
      }

      return false;
    })();

    const result = await refreshPromise;
    return result;
  } catch (error) {
    console.error('Token refresh error:', error);
    return false;
  } finally {
    isRefreshing = false;
    refreshPromise = null;
  }
};