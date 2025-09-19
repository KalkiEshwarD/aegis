import React, { ComponentType } from 'react';
import { Box, Typography, Alert } from '@mui/material';
import { useAuth } from '../../contexts/AuthContext';

interface WithPermissionsOptions {
  requiredPermissions?: string[];
  requiredRoles?: string[];
  fallbackMessage?: string;
  showFallback?: boolean;
}

interface PermissionsProps {
  hasPermission: (permission: string) => boolean;
  hasRole: (role: string) => boolean;
  userPermissions: string[];
  userRoles: string[];
}

function withPermissions<P extends object>(
  WrappedComponent: ComponentType<P & PermissionsProps>,
  options: WithPermissionsOptions = {}
) {
  const {
    requiredPermissions = [],
    requiredRoles = [],
    fallbackMessage = 'You do not have permission to access this content',
    showFallback = true
  } = options;

  const WithPermissionsComponent: React.FC<P> = (props) => {
    const { user } = useAuth();

    // Basic permission/role checking based on user.is_admin
    const userPermissions = user?.is_admin ? ['admin', 'read', 'write', 'delete'] : ['read', 'write'];
    const userRoles = user?.is_admin ? ['admin'] : ['user'];

    const hasPermission = (permission: string) => userPermissions.includes(permission);
    const hasRole = (role: string) => userRoles.includes(role);

    const hasRequiredPermissions = requiredPermissions.length === 0 ||
      requiredPermissions.every(permission => hasPermission(permission));

    const hasRequiredRoles = requiredRoles.length === 0 ||
      requiredRoles.every(role => hasRole(role));

    const hasAccess = hasRequiredPermissions && hasRequiredRoles;

    if (!hasAccess) {
      if (!showFallback) {
        return null;
      }

      return (
        <Box sx={{ p: 3 }}>
          <Alert severity="warning">
            <Typography variant="body1">{fallbackMessage}</Typography>
            {requiredPermissions.length > 0 && (
              <Typography variant="body2" sx={{ mt: 1 }}>
                Required permissions: {requiredPermissions.join(', ')}
              </Typography>
            )}
            {requiredRoles.length > 0 && (
              <Typography variant="body2" sx={{ mt: 1 }}>
                Required roles: {requiredRoles.join(', ')}
              </Typography>
            )}
          </Alert>
        </Box>
      );
    }

    return (
      <WrappedComponent
        {...props}
        hasPermission={hasPermission}
        hasRole={hasRole}
        userPermissions={userPermissions}
        userRoles={userRoles}
      />
    );
  };

  WithPermissionsComponent.displayName = `withPermissions(${WrappedComponent.displayName || WrappedComponent.name})`;

  return WithPermissionsComponent;
}

export default withPermissions;