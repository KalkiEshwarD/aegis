import React from 'react';
import { render, screen, waitFor, act, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MockedProvider } from '@apollo/client/testing';

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

// Mock the mutations
const mockLoginMutation = jest.fn();
const mockRegisterMutation = jest.fn();

jest.mock('@apollo/client', () => ({
  ...jest.requireActual('@apollo/client'),
  useMutation: jest.fn(),
}));

// Mock the queries
jest.mock('../../apollo/queries', () => ({
  LOGIN_MUTATION: 'LOGIN_MUTATION',
  REGISTER_MUTATION: 'REGISTER_MUTATION',
}));

// Import the context after mocks
import { AuthProvider, useAuth } from '../../contexts/AuthContext';
import { LOGIN_MUTATION, REGISTER_MUTATION } from '../../apollo/queries';

// Test component that uses the context
const TestComponent = () => {
  const { user, token, login, register, logout, loading } = useAuth();

  const handleLogin = async () => {
    try {
      await login('test@example.com', 'password');
    } catch (error) {
      // Error is handled, don't throw
    }
  };

  const handleRegister = async () => {
    try {
      await register('test@example.com', 'password');
    } catch (error) {
      // Error is handled, don't throw
    }
  };

  return (
    <div>
      <div data-testid="user">{user ? user.email : 'No user'}</div>
      <div data-testid="token">{token || 'No token'}</div>
      <div data-testid="loading">{loading ? 'Loading' : 'Not loading'}</div>
      <button data-testid="login-btn" onClick={handleLogin}>
        Login
      </button>
      <button data-testid="register-btn" onClick={handleRegister}>
        Register
      </button>
      <button data-testid="logout-btn" onClick={logout}>
        Logout
      </button>
    </div>
  );
};

const renderWithProvider = (mocks: any[] = []) => {
  return render(
    <MockedProvider mocks={mocks} addTypename={false}>
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    </MockedProvider>
  );
};

describe('AuthContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorageMock.getItem.mockClear();
    localStorageMock.setItem.mockClear();
    localStorageMock.removeItem.mockClear();

    // Mock useMutation
    const { useMutation } = require('@apollo/client');
    useMutation.mockImplementation((mutation: any) => {
      if (mutation === LOGIN_MUTATION) {
        return [mockLoginMutation, { loading: false, error: null }];
      }
      if (mutation === REGISTER_MUTATION) {
        return [mockRegisterMutation, { loading: false, error: null }];
      }
      return [jest.fn(), { loading: false, error: null }];
    });
  });

  describe('initial state', () => {
    it('loads user and token from localStorage on mount', async () => {
      const mockUser = { id: '1', email: 'test@example.com', is_admin: false };
      const mockToken = 'mock-token';

      localStorageMock.getItem.mockImplementation((key: string) => {
        if (key === 'aegis_token') return mockToken;
        if (key === 'aegis_user') return JSON.stringify(mockUser);
        return null;
      });

      renderWithProvider();

      await waitFor(() => {
        expect(screen.getByTestId('user')).toHaveTextContent('test@example.com');
        expect(screen.getByTestId('token')).toHaveTextContent('mock-token');
        expect(screen.getByTestId('loading')).toHaveTextContent('Not loading');
      });
    });

    it('handles invalid stored user data gracefully', async () => {
      localStorageMock.getItem.mockImplementation((key: string) => {
        if (key === 'aegis_token') return 'mock-token';
        if (key === 'aegis_user') return 'invalid-json';
        return null;
      });

      renderWithProvider();

      await waitFor(() => {
        expect(screen.getByTestId('user')).toHaveTextContent('No user');
      });

      // After user parsing fails, both token and user should be cleared
      await waitFor(() => {
        expect(screen.getByTestId('token')).toHaveTextContent('No token');
      });

      expect(localStorageMock.removeItem).toHaveBeenCalledWith('aegis_token');
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('aegis_user');
    });

    it('starts with no user when localStorage is empty', async () => {
      localStorageMock.getItem.mockReturnValue(null);

      renderWithProvider();

      await waitFor(() => {
        expect(screen.getByTestId('user')).toHaveTextContent('No user');
        expect(screen.getByTestId('token')).toHaveTextContent('No token');
        expect(screen.getByTestId('loading')).toHaveTextContent('Not loading');
      });
    });
  });

  describe('login function', () => {
    it('calls login mutation and updates state on success', async () => {
      const mockResponse = {
        data: {
          login: {
            token: 'new-token',
            user: { id: '1', email: 'test@example.com', is_admin: false }
          }
        }
      };

      mockLoginMutation.mockResolvedValue(mockResponse);

      renderWithProvider();

      const loginButton = screen.getByTestId('login-btn');
      fireEvent.click(loginButton);

      await waitFor(() => {
        expect(mockLoginMutation).toHaveBeenCalledWith({
          variables: {
            input: { email: 'test@example.com', password: 'password' }
          }
        });
      });

      await waitFor(() => {
        expect(screen.getByTestId('user')).toHaveTextContent('test@example.com');
        expect(screen.getByTestId('token')).toHaveTextContent('new-token');
      });

      expect(localStorageMock.setItem).toHaveBeenCalledWith('aegis_token', 'new-token');
      expect(localStorageMock.setItem).toHaveBeenCalledWith('aegis_user', JSON.stringify(mockResponse.data.login.user));
    });

    it('handles login errors', async () => {
      const mockError = new Error('Invalid credentials');
      mockLoginMutation.mockRejectedValue(mockError);

      renderWithProvider();

      const loginButton = screen.getByTestId('login-btn');
      fireEvent.click(loginButton);

      await waitFor(() => {
        expect(mockLoginMutation).toHaveBeenCalled();
      });

      // Error should be thrown, but state should remain unchanged
      expect(screen.getByTestId('user')).toHaveTextContent('No user');
    });

    it('handles GraphQL errors', async () => {
      const mockResponse = {
        errors: [{ message: 'User not found' }]
      };

      mockLoginMutation.mockResolvedValue(mockResponse);

      renderWithProvider();

      const loginButton = screen.getByTestId('login-btn');
      fireEvent.click(loginButton);

      await waitFor(() => {
        expect(mockLoginMutation).toHaveBeenCalled();
      });

      expect(screen.getByTestId('user')).toHaveTextContent('No user');
    });

    it('handles missing login data', async () => {
      const mockResponse = {
        data: { login: null }
      };

      mockLoginMutation.mockResolvedValue(mockResponse);

      renderWithProvider();

      const loginButton = screen.getByTestId('login-btn');
      fireEvent.click(loginButton);

      await waitFor(() => {
        expect(mockLoginMutation).toHaveBeenCalled();
      });

      expect(screen.getByTestId('user')).toHaveTextContent('No user');
    });
  });

  describe('register function', () => {
    it('calls register mutation and updates state on success', async () => {
      const mockResponse = {
        data: {
          register: {
            token: 'new-token',
            user: { id: '1', email: 'test@example.com', is_admin: false }
          }
        }
      };

      mockRegisterMutation.mockResolvedValue(mockResponse);

      renderWithProvider();

      const registerButton = screen.getByTestId('register-btn');
      fireEvent.click(registerButton);

      await waitFor(() => {
        expect(mockRegisterMutation).toHaveBeenCalledWith({
          variables: {
            input: { email: 'test@example.com', password: 'password' }
          }
        });
      });

      await waitFor(() => {
        expect(screen.getByTestId('user')).toHaveTextContent('test@example.com');
        expect(screen.getByTestId('token')).toHaveTextContent('new-token');
      });

      expect(localStorageMock.setItem).toHaveBeenCalledWith('aegis_token', 'new-token');
      expect(localStorageMock.setItem).toHaveBeenCalledWith('aegis_user', JSON.stringify(mockResponse.data.register.user));
    });

    it('handles register errors', async () => {
      const mockError = new Error('Registration failed');
      mockRegisterMutation.mockRejectedValue(mockError);

      renderWithProvider();

      const registerButton = screen.getByTestId('register-btn');
      fireEvent.click(registerButton);

      await waitFor(() => {
        expect(mockRegisterMutation).toHaveBeenCalled();
      });

      expect(screen.getByTestId('user')).toHaveTextContent('No user');
    });
  });

  describe('logout function', () => {
    it('clears user, token and localStorage', async () => {
      // Set initial state
      const mockUser = { id: '1', email: 'test@example.com', is_admin: false };
      localStorageMock.getItem.mockImplementation((key: string) => {
        if (key === 'aegis_token') return 'mock-token';
        if (key === 'aegis_user') return JSON.stringify(mockUser);
        return null;
      });

      renderWithProvider();

      await waitFor(() => {
        expect(screen.getByTestId('user')).toHaveTextContent('test@example.com');
      });

      const logoutButton = screen.getByTestId('logout-btn');
      fireEvent.click(logoutButton);

      await waitFor(() => {
        expect(screen.getByTestId('user')).toHaveTextContent('No user');
        expect(screen.getByTestId('token')).toHaveTextContent('No token');
      });

      expect(localStorageMock.removeItem).toHaveBeenCalledWith('aegis_token');
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('aegis_user');
    });
  });

  describe('useAuth hook', () => {
    it('throws error when used outside AuthProvider', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        render(<TestComponent />);
      }).toThrow('useAuth must be used within an AuthProvider');

      consoleSpy.mockRestore();
    });
  });
});