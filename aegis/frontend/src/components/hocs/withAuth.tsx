import React, { ComponentType, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import LoadingSpinner from '../common/LoadingSpinner';

interface WithAuthOptions {
  redirectTo?: string;
  requireAuth?: boolean;
}

interface AuthProps {
  user: any;
  isAuthenticated: boolean;
}

function withAuth<P extends object>(
  WrappedComponent: ComponentType<P & AuthProps>,
  options: WithAuthOptions = {}
) {
  const { redirectTo = '/login', requireAuth = true } = options;

  const WithAuthComponent: React.FC<P> = (props) => {
    const { user, loading } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
      if (!loading) {
        if (requireAuth && !user) {
          navigate(redirectTo);
        }
      }
    }, [user, loading, navigate]);

    if (loading) {
      return <LoadingSpinner message="Checking authentication..." />;
    }

    if (requireAuth && !user) {
      return null; // Will redirect
    }

    return (
      <WrappedComponent
        {...props}
        user={user}
        isAuthenticated={!!user}
      />
    );
  };

  WithAuthComponent.displayName = `withAuth(${WrappedComponent.displayName || WrappedComponent.name})`;

  return WithAuthComponent;
}

export default withAuth;