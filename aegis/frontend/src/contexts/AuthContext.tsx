import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useMutation, useQuery } from '@apollo/client';
import { LOGIN_MUTATION, REGISTER_MUTATION, GET_ME, LOGOUT_MUTATION } from '../apollo/queries';
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

  const login = async (email: string, password: string): Promise<void> => {
    try {
      setLoading(true);
      const { data, errors } = await loginMutation({
        variables: {
          input: { email, password }
        }
      });

      if (errors && errors.length > 0) {
        throw new Error(errors[0].message);
      }

      if (data?.login) {
        const authPayload: AuthPayload = data.login;
        setUser(authPayload.user);
        // Store token in localStorage for subsequent requests
        localStorage.setItem('auth_token', authPayload.token);
      } else {
        throw new Error('Login failed: No data returned');
      }
    } catch (error) {
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const register = async (email: string, password: string): Promise<void> => {
    try {
      setLoading(true);
      const { data, errors } = await registerMutation({
        variables: {
          input: { email, password }
        }
      });

      if (errors && errors.length > 0) {
        throw new Error(errors[0].message);
      }

      if (data?.register) {
        const authPayload: AuthPayload = data.register;
        setUser(authPayload.user);
        // Store token in localStorage for subsequent requests
        localStorage.setItem('auth_token', authPayload.token);
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
      // Clear token from localStorage
      localStorage.removeItem('auth_token');
    }
  };

  const value: AuthContextType = {
    user,
    token: localStorage.getItem('auth_token'), // Token accessible from localStorage
    login,
    register,
    logout,
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
