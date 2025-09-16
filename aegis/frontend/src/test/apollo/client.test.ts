import { ApolloClient, InMemoryCache, createHttpLink } from '@apollo/client';

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Mock window.location
const locationMock = {
  href: '',
};
Object.defineProperty(window, 'location', {
  value: locationMock,
  writable: true,
});

// Import the client after mocks
import apolloClient from '../../apollo/client';

describe('Apollo Client', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorageMock.getItem.mockClear();
    localStorageMock.setItem.mockClear();
    localStorageMock.removeItem.mockClear();
    locationMock.href = '';
  });

  it('creates Apollo client instance', () => {
    expect(apolloClient).toBeInstanceOf(ApolloClient);
    expect(apolloClient).toHaveProperty('query');
    expect(apolloClient).toHaveProperty('mutate');
    expect(apolloClient).toHaveProperty('subscribe');
  });

  it('has correct cache configuration', () => {
    const cache = apolloClient.cache;
    expect(cache).toBeInstanceOf(InMemoryCache);
  });

  it('auth link adds authorization header when token exists', () => {
    const { setContext } = require('@apollo/client');

    // Mock setContext callback
    let capturedCallback: any;
    setContext.mockImplementation((callback: any) => {
      capturedCallback = callback;
      return { type: 'auth' };
    });

    // Reset module to trigger recreation
    jest.resetModules();
    require('../../apollo/client');

    // Simulate the auth link callback
    localStorageMock.getItem.mockReturnValue('mock-token');

    const result = capturedCallback({}, { headers: {} });

    expect(result).toEqual({
      headers: {
        authorization: 'Bearer mock-token',
      },
    });
  });

  it('auth link does not add authorization header when no token', () => {
    const { setContext } = require('@apollo/client');

    let capturedCallback: any;
    setContext.mockImplementation((callback: any) => {
      capturedCallback = callback;
      return { type: 'auth' };
    });

    jest.resetModules();
    require('../../apollo/client');

    localStorageMock.getItem.mockReturnValue(null);

    const result = capturedCallback({}, { headers: {} });

    expect(result).toEqual({
      headers: {
        authorization: '',
      },
    });
  });

  it('error link handles GraphQL authentication errors', () => {
    const { onError } = require('@apollo/client');

    let capturedErrorCallback: any;
    onError.mockImplementation((callback: any) => {
      capturedErrorCallback = callback;
      return { type: 'error' };
    });

    jest.resetModules();
    require('../../apollo/client');

    const mockOperation = { operation: 'test' };
    const mockForward = jest.fn();

    // Test GraphQL error with Unauthorized message
    capturedErrorCallback({
      graphQLErrors: [{ message: 'Unauthorized access' }],
      operation: mockOperation,
      forward: mockForward,
    });

    expect(localStorageMock.removeItem).toHaveBeenCalledWith('aegis_token');
    expect(localStorageMock.removeItem).toHaveBeenCalledWith('aegis_user');
    expect(locationMock.href).toBe('/login');
  });

  it('error link handles GraphQL invalid token errors', () => {
    const { onError } = require('@apollo/client');

    let capturedErrorCallback: any;
    onError.mockImplementation((callback: any) => {
      capturedErrorCallback = callback;
      return { type: 'error' };
    });

    jest.resetModules();
    require('../../apollo/client');

    const mockOperation = { operation: 'test' };
    const mockForward = jest.fn();

    // Test GraphQL error with Invalid token message
    capturedErrorCallback({
      graphQLErrors: [{ message: 'Invalid token provided' }],
      operation: mockOperation,
      forward: mockForward,
    });

    expect(localStorageMock.removeItem).toHaveBeenCalledWith('aegis_token');
    expect(localStorageMock.removeItem).toHaveBeenCalledWith('aegis_user');
    expect(locationMock.href).toBe('/login');
  });

  it('error link handles network authentication errors', () => {
    const { onError } = require('@apollo/client');

    let capturedErrorCallback: any;
    onError.mockImplementation((callback: any) => {
      capturedErrorCallback = callback;
      return { type: 'error' };
    });

    jest.resetModules();
    require('../../apollo/client');

    const mockOperation = { operation: 'test' };
    const mockForward = jest.fn();

    // Test network error with 401 status
    capturedErrorCallback({
      networkError: { statusCode: 401 },
      operation: mockOperation,
      forward: mockForward,
    });

    expect(localStorageMock.removeItem).toHaveBeenCalledWith('aegis_token');
    expect(localStorageMock.removeItem).toHaveBeenCalledWith('aegis_user');
    expect(locationMock.href).toBe('/login');
  });

  it('error link logs GraphQL errors without authentication issues', () => {
    const { onError } = require('@apollo/client');
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

    let capturedErrorCallback: any;
    onError.mockImplementation((callback: any) => {
      capturedErrorCallback = callback;
      return { type: 'error' };
    });

    jest.resetModules();
    require('../../apollo/client');

    const mockOperation = { operation: 'test' };
    const mockForward = jest.fn();

    // Test GraphQL error without auth issues
    capturedErrorCallback({
      graphQLErrors: [{ message: 'Some other error', locations: [], path: [] }],
      operation: mockOperation,
      forward: mockForward,
    });

    expect(consoleSpy).toHaveBeenCalledWith(
      'GraphQL error: Message: Some other error, Location: , Path: '
    );

    // Should not clear localStorage or redirect
    expect(localStorageMock.removeItem).not.toHaveBeenCalled();
    expect(locationMock.href).toBe('');

    consoleSpy.mockRestore();
  });

  it('error link logs network errors without authentication issues', () => {
    const { onError } = require('@apollo/client');
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

    let capturedErrorCallback: any;
    onError.mockImplementation((callback: any) => {
      capturedErrorCallback = callback;
      return { type: 'error' };
    });

    jest.resetModules();
    require('../../apollo/client');

    const mockOperation = { operation: 'test' };
    const mockForward = jest.fn();

    // Test network error without 401 status
    capturedErrorCallback({
      networkError: { message: 'Network failed' },
      operation: mockOperation,
      forward: mockForward,
    });

    expect(consoleSpy).toHaveBeenCalledWith('Network error: Network failed');

    // Should not clear localStorage or redirect
    expect(localStorageMock.removeItem).not.toHaveBeenCalled();
    expect(locationMock.href).toBe('');

    consoleSpy.mockRestore();
  });

  it('uses environment variable for GraphQL endpoint', () => {
    const originalEnv = process.env.REACT_APP_GRAPHQL_ENDPOINT;
    process.env.REACT_APP_GRAPHQL_ENDPOINT = 'https://custom-endpoint.com/graphql';

    const { createHttpLink } = require('@apollo/client');

    jest.resetModules();
    require('../../apollo/client');

    expect(createHttpLink).toHaveBeenCalledWith({
      uri: 'https://custom-endpoint.com/graphql',
    });

    // Restore original env
    process.env.REACT_APP_GRAPHQL_ENDPOINT = originalEnv;
  });

  it('uses default GraphQL endpoint when env var not set', () => {
    const originalEnv = process.env.REACT_APP_GRAPHQL_ENDPOINT;
    delete process.env.REACT_APP_GRAPHQL_ENDPOINT;

    const { createHttpLink } = require('@apollo/client');

    jest.resetModules();
    require('../../apollo/client');

    expect(createHttpLink).toHaveBeenCalledWith({
      uri: 'http://localhost:8080/graphql',
    });

    // Restore original env
    process.env.REACT_APP_GRAPHQL_ENDPOINT = originalEnv;
  });
});