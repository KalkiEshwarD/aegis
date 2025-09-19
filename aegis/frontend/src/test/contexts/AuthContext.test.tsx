import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MockedProvider } from '@apollo/client/testing';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { AuthProvider, useAuth } from '../../contexts/AuthContext';
import {
  LOGIN_MUTATION,
  REGISTER_MUTATION,
  GET_ME,
  LOGOUT_MUTATION,
  REFRESH_TOKEN_MUTATION
} from '../../apollo/auth';

const theme = createTheme();

// Test component that uses the auth context
const TestComponent = () => {
  const { user, login, register, logout, refreshToken, loading } = useAuth();

  return (
    <div>
      <div data-testid="loading">{loading ? 'loading' : 'not-loading'}</div>
      <div data-testid="user">{user ? user.email : 'no-user'}</div>
      <button onClick={() => login('test@example.com', 'password')}>Login</button>
      <button onClick={() => register('testuser', 'test@example.com', 'password')}>Register</button>
      <button onClick={() => logout()}>Logout</button>
      <button onClick={() => refreshToken()}>Refresh Token</button>
    </div>
  );
};

const renderWithProviders = (mocks: any[] = []) => {
  return render(
    <MockedProvider mocks={mocks} addTypename={false}>
      <ThemeProvider theme={theme}>
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      </ThemeProvider>
    </MockedProvider>
  );
};

describe('AuthContext', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
    sessionStorage.clear();

    // Mock fetch for any HTTP requests
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Initial state', () => {
    it('should show loading initially', () => {
      const mocks = [
        {
          request: {
            query: GET_ME,
          },
          result: {
            data: { me: null },
          },
        },
      ];

      renderWithProviders(mocks);

      expect(screen.getByTestId('loading')).toHaveTextContent('loading');
    });

    it('should set user to null when not authenticated', async () => {
      const mocks = [
        {
          request: {
            query: GET_ME,
          },
          result: {
            data: { me: null },
          },
        },
      ];

      renderWithProviders(mocks);

      await waitFor(() => {
        expect(screen.getByTestId('user')).toHaveTextContent('no-user');
        expect(screen.getByTestId('loading')).toHaveTextContent('not-loading');
      });
    });

    it('should set user when authenticated', async () => {
      const mockUser = {
        id: '1',
        email: 'test@example.com',
        username: 'testuser',
        is_admin: false,
        storage_quota: 10485760,
        used_storage: 1024,
      };

      const mocks = [
        {
          request: {
            query: GET_ME,
          },
          result: {
            data: { me: mockUser },
          },
        },
      ];

      renderWithProviders(mocks);

      await waitFor(() => {
        expect(screen.getByTestId('user')).toHaveTextContent('test@example.com');
        expect(screen.getByTestId('loading')).toHaveTextContent('not-loading');
      });
    });
  });

  describe('Login functionality', () => {
    it('should handle successful login', async () => {
      const mockUser = {
        id: '1',
        email: 'test@example.com',
        username: 'testuser',
        is_admin: false,
        storage_quota: 10485760,
        used_storage: 1024,
      };

      const mocks = [
        {
          request: {
            query: LOGIN_MUTATION,
            variables: {
              input: { identifier: 'test@example.com', password: 'password' }
            }
          },
          result: {
            data: {
              login: {
                user: mockUser,
                token: 'mock-jwt-token' // This should be ignored in favor of HttpOnly cookies
              }
            }
          }
        }
      ];

      renderWithProviders(mocks);

      // Wait for initial load
      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('not-loading');
      });

      // Click login button
      fireEvent.click(screen.getByText('Login'));

      // Wait for login to complete
      await waitFor(() => {
        expect(screen.getByTestId('user')).toHaveTextContent('test@example.com');
      });
    });

    it('should handle login errors', async () => {
      const mocks = [
        {
          request: {
            query: LOGIN_MUTATION,
            variables: {
              input: { identifier: 'test@example.com', password: 'password' }
            }
          },
          error: new Error('Invalid credentials')
        }
      ];

      // Mock console.error to avoid test output noise
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      renderWithProviders(mocks);

      // Wait for initial load
      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('not-loading');
      });

      // Click login button
      fireEvent.click(screen.getByText('Login'));

      // Wait for error to be logged
      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining('Invalid credentials')
        );
      });

      consoleSpy.mockRestore();
    });

    it('should handle GraphQL errors during login', async () => {
      const mocks = [
        {
          request: {
            query: LOGIN_MUTATION,
            variables: {
              input: { identifier: 'test@example.com', password: 'password' }
            }
          },
          result: {
            errors: [{ message: 'Invalid credentials' }]
          }
        }
      ];

      renderWithProviders(mocks);

      // Wait for initial load
      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('not-loading');
      });

      // Click login button
      fireEvent.click(screen.getByText('Login'));

      // Should throw error that can be caught by error boundary
      await expect(async () => {
        fireEvent.click(screen.getByText('Login'));
      }).rejects.toThrow('Invalid credentials');
    });
  });

  describe('Registration functionality', () => {
    it('should handle successful registration', async () => {
      const mockUser = {
        id: '1',
        email: 'new@example.com',
        username: 'newuser',
        is_admin: false,
        storage_quota: 10485760,
        used_storage: 0,
      };

      const mocks = [
        {
          request: {
            query: REGISTER_MUTATION,
            variables: {
              input: {
                username: 'newuser',
                email: 'new@example.com',
                password: 'password'
              }
            }
          },
          result: {
            data: {
              register: {
                user: mockUser,
                token: 'mock-jwt-token'
              }
            }
          }
        }
      ];

      renderWithProviders(mocks);

      // Wait for initial load
      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('not-loading');
      });

      // Click register button
      fireEvent.click(screen.getByText('Register'));

      // Wait for registration to complete
      await waitFor(() => {
        expect(screen.getByTestId('user')).toHaveTextContent('new@example.com');
      });
    });

    it('should handle registration errors', async () => {
      const mocks = [
        {
          request: {
            query: REGISTER_MUTATION,
            variables: {
              input: {
                username: 'newuser',
                email: 'new@example.com',
                password: 'password'
              }
            }
          },
          result: {
            errors: [{ message: 'Email already exists' }]
          }
        }
      ];

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      renderWithProviders(mocks);

      // Wait for initial load
      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('not-loading');
      });

      // Click register button
      fireEvent.click(screen.getByText('Register'));

      // Should throw error
      await expect(async () => {
        fireEvent.click(screen.getByText('Register'));
      }).rejects.toThrow('Email already exists');

      consoleSpy.mockRestore();
    });
  });

  describe('Logout functionality', () => {
    it('should handle logout', async () => {
      const mockUser = {
        id: '1',
        email: 'test@example.com',
        username: 'testuser',
        is_admin: false,
        storage_quota: 10485760,
        used_storage: 1024,
      };

      const mocks = [
        {
          request: {
            query: GET_ME,
          },
          result: {
            data: { me: mockUser },
          },
        },
        {
          request: {
            query: LOGOUT_MUTATION,
          },
          result: {
            data: { logout: true },
          },
        }
      ];

      renderWithProviders(mocks);

      // Wait for user to be loaded
      await waitFor(() => {
        expect(screen.getByTestId('user')).toHaveTextContent('test@example.com');
      });

      // Click logout button
      fireEvent.click(screen.getByText('Logout'));

      // Wait for logout to complete
      await waitFor(() => {
        expect(screen.getByTestId('user')).toHaveTextContent('no-user');
      });
    });

    it('should handle logout errors gracefully', async () => {
      const mockUser = {
        id: '1',
        email: 'test@example.com',
        username: 'testuser',
        is_admin: false,
        storage_quota: 10485760,
        used_storage: 1024,
      };

      const mocks = [
        {
          request: {
            query: GET_ME,
          },
          result: {
            data: { me: mockUser },
          },
        },
        {
          request: {
            query: LOGOUT_MUTATION,
          },
          error: new Error('Logout failed'),
        }
      ];

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      renderWithProviders(mocks);

      // Wait for user to be loaded
      await waitFor(() => {
        expect(screen.getByTestId('user')).toHaveTextContent('test@example.com');
      });

      // Click logout button
      fireEvent.click(screen.getByText('Logout'));

      // Should still clear user state despite error
      await waitFor(() => {
        expect(screen.getByTestId('user')).toHaveTextContent('no-user');
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Logout error'),
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });
  });

  describe('Token refresh functionality', () => {
    it('should handle successful token refresh', async () => {
      const mockUser = {
        id: '1',
        email: 'test@example.com',
        username: 'testuser',
        is_admin: false,
        storage_quota: 10485760,
        used_storage: 1024,
      };

      const mocks = [
        {
          request: {
            query: GET_ME,
          },
          result: {
            data: { me: mockUser },
          },
        },
        {
          request: {
            query: REFRESH_TOKEN_MUTATION,
          },
          result: {
            data: {
              refreshToken: {
                user: mockUser,
                token: 'new-token'
              }
            }
          }
        }
      ];

      renderWithProviders(mocks);

      // Wait for user to be loaded
      await waitFor(() => {
        expect(screen.getByTestId('user')).toHaveTextContent('test@example.com');
      });

      // Click refresh token button
      fireEvent.click(screen.getByText('Refresh Token'));

      // User should remain the same (refresh doesn't change user data)
      await waitFor(() => {
        expect(screen.getByTestId('user')).toHaveTextContent('test@example.com');
      });
    });

    it('should handle token refresh failure', async () => {
      const mockUser = {
        id: '1',
        email: 'test@example.com',
        username: 'testuser',
        is_admin: false,
        storage_quota: 10485760,
        used_storage: 1024,
      };

      const mocks = [
        {
          request: {
            query: GET_ME,
          },
          result: {
            data: { me: mockUser },
          },
        },
        {
          request: {
            query: REFRESH_TOKEN_MUTATION,
          },
          result: {
            errors: [{ message: 'Token expired' }]
          }
        }
      ];

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      renderWithProviders(mocks);

      // Wait for user to be loaded
      await waitFor(() => {
        expect(screen.getByTestId('user')).toHaveTextContent('test@example.com');
      });

      // Click refresh token button
      fireEvent.click(screen.getByText('Refresh Token'));

      // Should log error and set user to null
      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith(
          'Token refresh failed:',
          'Token expired'
        );
        expect(screen.getByTestId('user')).toHaveTextContent('no-user');
      });

      consoleSpy.mockRestore();
    });
  });

  describe('Security features', () => {
    it('should not store tokens in localStorage', async () => {
      const mockUser = {
        id: '1',
        email: 'test@example.com',
        username: 'testuser',
        is_admin: false,
        storage_quota: 10485760,
        used_storage: 1024,
      };

      const mocks = [
        {
          request: {
            query: LOGIN_MUTATION,
            variables: {
              input: { identifier: 'test@example.com', password: 'password' }
            }
          },
          result: {
            data: {
              login: {
                user: mockUser,
                token: 'should-not-be-stored'
              }
            }
          }
        }
      ];

      renderWithProviders(mocks);

      // Wait for initial load
      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('not-loading');
      });

      // Click login button
      fireEvent.click(screen.getByText('Login'));

      // Wait for login to complete
      await waitFor(() => {
        expect(screen.getByTestId('user')).toHaveTextContent('test@example.com');
      });

      // Verify token is not stored in localStorage
      expect(localStorage.getItem('token')).toBeNull();
      expect(localStorage.getItem('authToken')).toBeNull();
      expect(sessionStorage.getItem('token')).toBeNull();
    });

    it('should handle authentication check failure silently', async () => {
      const mocks = [
        {
          request: {
            query: GET_ME,
          },
          error: new Error('Network error'),
        },
      ];

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      renderWithProviders(mocks);

      // Should not throw error, should set user to null silently
      await waitFor(() => {
        expect(screen.getByTestId('user')).toHaveTextContent('no-user');
        expect(screen.getByTestId('loading')).toHaveTextContent('not-loading');
      });

      // Should not log errors for authentication check failures
      expect(consoleSpy).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe('Error handling', () => {
    it('should throw error when useAuth is used outside provider', () => {
      expect(() => {
        render(<TestComponent />);
      }).toThrow('useAuth must be used within an AuthProvider');
    });
  });
});