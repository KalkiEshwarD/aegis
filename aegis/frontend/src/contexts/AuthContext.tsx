import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useMutation } from '@apollo/client';
import { LOGIN_MUTATION, REGISTER_MUTATION } from '../apollo/queries';
import { AuthContextType, User, AuthPayload } from '../types';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [loginMutation] = useMutation(LOGIN_MUTATION);
  const [registerMutation] = useMutation(REGISTER_MUTATION);

  // Initialize auth state from localStorage
  useEffect(() => {
    const storedToken = localStorage.getItem('aegis_token');
    const storedUser = localStorage.getItem('aegis_user');

    if (storedToken && storedUser) {
      try {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
      } catch (error) {
        console.error('Error parsing stored user data:', error);
        // Clear both localStorage and state on error
        localStorage.removeItem('aegis_token');
        localStorage.removeItem('aegis_user');
        setToken(null);
        setUser(null);
      }
    }
    setLoading(false);
  }, []);

  const login = async (email: string, password: string): Promise<void> => {
    console.log('DEBUG: Starting login for email:', email);
    try {
      setLoading(true);
      const { data, errors } = await loginMutation({
        variables: {
          input: { email, password }
        }
      });

      console.log('DEBUG: Login mutation response:', { data, errors });

      if (errors && errors.length > 0) {
        console.error('DEBUG: GraphQL errors:', errors);
        throw new Error(errors[0].message);
      }

      if (data?.login) {
        const authPayload: AuthPayload = data.login;
        console.log('DEBUG: Login successful, setting user and token');
        setToken(authPayload.token);
        setUser(authPayload.user);

        // Store in localStorage
        localStorage.setItem('aegis_token', authPayload.token);
        localStorage.setItem('aegis_user', JSON.stringify(authPayload.user));
      } else {
        console.error('DEBUG: No login data in response');
        throw new Error('Login failed: No data returned');
      }
    } catch (error) {
      console.error('DEBUG: Login error:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const register = async (email: string, password: string): Promise<void> => {
    try {
      setLoading(true);
      const { data } = await registerMutation({
        variables: {
          input: { email, password }
        }
      });

      if (data?.register) {
        const authPayload: AuthPayload = data.register;
        setToken(authPayload.token);
        setUser(authPayload.user);

        // Store in localStorage
        localStorage.setItem('aegis_token', authPayload.token);
        localStorage.setItem('aegis_user', JSON.stringify(authPayload.user));
      }
    } catch (error) {
      console.error('Registration error:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const logout = (): void => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('aegis_token');
    localStorage.removeItem('aegis_user');
  };

  const value: AuthContextType = {
    user,
    token,
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
