import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useMutation, useQuery } from '@apollo/client';
import { LOGIN_MUTATION, REGISTER_MUTATION, GET_ME, LOGOUT_MUTATION, REFRESH_TOKEN_MUTATION } from '../apollo/auth';
import { AuthContextType, User, AuthPayload } from '../types';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const [loginMutation] = useMutation(LOGIN_MUTATION);
  const [registerMutation] = useMutation(REGISTER_MUTATION);
  const [logoutMutation] = useMutation(LOGOUT_MUTATION);
  const [refreshTokenMutation] = useMutation(REFRESH_TOKEN_MUTATION);

  const { refetch: refetchMe } = useQuery(GET_ME, {
    skip: true, // Skip initial query
  });

  // Check authentication on mount
  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const { data } = await refetchMe();
      if (data?.me) {
        setUser(data.me);
      } else {
        setUser(null);
      }
    } catch (error) {
      // Not authenticated or token invalid - silently set user to null
      // Don't log or throw errors to avoid triggering Apollo error handlers
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const refreshToken = async (): Promise<boolean> => {
    try {
      const { data, errors } = await refreshTokenMutation();

      if (errors && errors.length > 0) {
        console.error('Token refresh failed:', errors[0].message);
        setUser(null);
        return false;
      }

      if (data?.refreshToken) {
        const authPayload: AuthPayload = data.refreshToken;
        setUser(authPayload.user);
        return true;
      }

      return false;
    } catch (error) {
      console.error('Token refresh error:', error);
      setUser(null);
      return false;
    }
  };

  const login = async (identifier: string, password: string): Promise<void> => {
    try {
      console.log('DEBUG: AuthContext.login called with identifier:', identifier);
      setLoading(true);
      const { data, errors } = await loginMutation({
        variables: {
          input: { identifier, password }
        }
      });

      console.log('DEBUG: Login mutation response - errors:', errors, 'data:', data);

      if (errors && errors.length > 0) {
        console.error('DEBUG: Login failed with GraphQL errors:', errors);
        throw new Error(errors[0].message);
      }

      if (data?.login) {
        const authPayload: AuthPayload = data.login;
        console.log('DEBUG: Login successful, user:', authPayload.user);
        setUser(authPayload.user);
        // Token is now stored in HttpOnly cookies by the backend
        // No longer storing in localStorage for security
      } else {
        console.error('DEBUG: Login failed: No data returned from mutation');
        throw new Error('Login failed: No data returned');
      }
    } catch (error) {
      console.error('DEBUG: Login error:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const register = async (username: string, email: string, password: string): Promise<void> => {
    try {
      setLoading(true);
      const { data, errors } = await registerMutation({
        variables: {
          input: { username, email, password }
        }
      });

      if (errors && errors.length > 0) {
        throw new Error(errors[0].message);
      }

      if (data?.register) {
        const authPayload: AuthPayload = data.register;
        setUser(authPayload.user);
        // Token is now stored in HttpOnly cookies by the backend
        // No longer storing in localStorage for security
      } else {
        throw new Error('Registration failed: No data returned');
      }
    } catch (error) {
      console.error('Registration error:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const logout = async (): Promise<void> => {
    try {
      await logoutMutation();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setUser(null);
      // Cookies will be cleared by the backend during logout
    }
  };

  const value: AuthContextType = {
    user,
    token: null, // Token is now stored in HttpOnly cookies, not accessible to frontend
    login,
    register,
    logout,
    refreshToken,
    loading
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
