import React from 'react';
import { render, screen } from '@testing-library/react';
import withPermissions from '../../../components/hocs/withPermissions';

// Mock the AuthContext
const mockUseAuth = jest.fn();
jest.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

// Mock Material-UI components
jest.mock('@mui/material', () => ({
  Box: ({ children }: { children: React.ReactNode }) => <div data-testid="box">{children}</div>,
  Typography: ({ children, variant }: { children: React.ReactNode; variant: string }) => (
    <span data-testid={`typography-${variant}`}>{children}</span>
  ),
  Alert: ({ children, severity }: { children: React.ReactNode; severity: string }) => (
    <div data-testid={`alert-${severity}`}>{children}</div>
  ),
}));

describe('withPermissions HOC', () => {
  const TestComponent = ({
    hasPermission,
    hasRole,
    userPermissions,
    userRoles
  }: {
    hasPermission: (permission: string) => boolean;
    hasRole: (role: string) => boolean;
    userPermissions: string[];
    userRoles: string[];
  }) => (
    <div data-testid="test-component">
      Permissions: {userPermissions.join(', ')}
      Roles: {userRoles.join(', ')}
      Has Admin: {hasPermission('admin') ? 'true' : 'false'}
      Has User Role: {hasRole('user') ? 'true' : 'false'}
    </div>
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render component when user has admin permissions', () => {
    const mockUser = { id: 1, username: 'admin', is_admin: true };
    mockUseAuth.mockReturnValue({ user: mockUser });

    const WrappedComponent = withPermissions(TestComponent);

    render(<WrappedComponent />);

    expect(screen.getByTestId('test-component')).toBeInTheDocument();
    expect(screen.getByText('Permissions: admin, read, write, delete')).toBeInTheDocument();
    expect(screen.getByText('Roles: admin')).toBeInTheDocument();
    expect(screen.getByText('Has Admin: true')).toBeInTheDocument();
    expect(screen.getByText('Has User Role: false')).toBeInTheDocument();
  });

  it('should render component when user has regular permissions', () => {
    const mockUser = { id: 2, username: 'user', is_admin: false };
    mockUseAuth.mockReturnValue({ user: mockUser });

    const WrappedComponent = withPermissions(TestComponent);

    render(<WrappedComponent />);

    expect(screen.getByTestId('test-component')).toBeInTheDocument();
    expect(screen.getByText('Permissions: read, write')).toBeInTheDocument();
    expect(screen.getByText('Roles: user')).toBeInTheDocument();
    expect(screen.getByText('Has Admin: false')).toBeInTheDocument();
    expect(screen.getByText('Has User Role: true')).toBeInTheDocument();
  });

  it('should show fallback when user lacks required permissions', () => {
    const mockUser = { id: 2, username: 'user', is_admin: false };
    mockUseAuth.mockReturnValue({ user: mockUser });

    const WrappedComponent = withPermissions(TestComponent, {
      requiredPermissions: ['admin'],
    });

    render(<WrappedComponent />);

    expect(screen.queryByTestId('test-component')).not.toBeInTheDocument();
    expect(screen.getByTestId('alert-warning')).toBeInTheDocument();
    expect(screen.getByText('You do not have permission to access this content')).toBeInTheDocument();
    expect(screen.getByText('Required permissions: admin')).toBeInTheDocument();
  });

  it('should show fallback when user lacks required roles', () => {
    const mockUser = { id: 2, username: 'user', is_admin: false };
    mockUseAuth.mockReturnValue({ user: mockUser });

    const WrappedComponent = withPermissions(TestComponent, {
      requiredRoles: ['admin'],
    });

    render(<WrappedComponent />);

    expect(screen.queryByTestId('test-component')).not.toBeInTheDocument();
    expect(screen.getByTestId('alert-warning')).toBeInTheDocument();
    expect(screen.getByText('Required roles: admin')).toBeInTheDocument();
  });

  it('should render component when user has all required permissions', () => {
    const mockUser = { id: 1, username: 'admin', is_admin: true };
    mockUseAuth.mockReturnValue({ user: mockUser });

    const WrappedComponent = withPermissions(TestComponent, {
      requiredPermissions: ['read', 'write'],
      requiredRoles: ['admin'],
    });

    render(<WrappedComponent />);

    expect(screen.getByTestId('test-component')).toBeInTheDocument();
  });

  it('should show custom fallback message', () => {
    const mockUser = { id: 2, username: 'user', is_admin: false };
    mockUseAuth.mockReturnValue({ user: mockUser });

    const WrappedComponent = withPermissions(TestComponent, {
      requiredPermissions: ['admin'],
      fallbackMessage: 'Custom access denied message',
    });

    render(<WrappedComponent />);

    expect(screen.getByText('Custom access denied message')).toBeInTheDocument();
  });

  it('should not show fallback when showFallback is false', () => {
    const mockUser = { id: 2, username: 'user', is_admin: false };
    mockUseAuth.mockReturnValue({ user: mockUser });

    const WrappedComponent = withPermissions(TestComponent, {
      requiredPermissions: ['admin'],
      showFallback: false,
    });

    render(<WrappedComponent />);

    expect(screen.queryByTestId('test-component')).not.toBeInTheDocument();
    expect(screen.queryByTestId('alert-warning')).not.toBeInTheDocument();
    expect(screen.queryByTestId('box')).not.toBeInTheDocument();
  });

  it('should handle no user (not authenticated)', () => {
    mockUseAuth.mockReturnValue({ user: null });

    const WrappedComponent = withPermissions(TestComponent);

    render(<WrappedComponent />);

    // Should show fallback since user is null
    expect(screen.queryByTestId('test-component')).not.toBeInTheDocument();
    expect(screen.getByTestId('alert-warning')).toBeInTheDocument();
  });

  it('should handle empty required permissions and roles', () => {
    const mockUser = { id: 2, username: 'user', is_admin: false };
    mockUseAuth.mockReturnValue({ user: mockUser });

    const WrappedComponent = withPermissions(TestComponent, {
      requiredPermissions: [],
      requiredRoles: [],
    });

    render(<WrappedComponent />);

    expect(screen.getByTestId('test-component')).toBeInTheDocument();
  });

  it('should pass through additional props', () => {
    const mockUser = { id: 1, username: 'admin', is_admin: true };
    mockUseAuth.mockReturnValue({ user: mockUser });

    const WrappedComponent = withPermissions(TestComponent);

    render(<WrappedComponent customProp="value" />);

    expect(screen.getByTestId('test-component')).toBeInTheDocument();
  });

  it('should set correct displayName', () => {
    const WrappedComponent = withPermissions(TestComponent);
    expect(WrappedComponent.displayName).toBe('withPermissions(TestComponent)');
  });

  it('should handle component with custom displayName', () => {
    const ComponentWithDisplayName = () => <div>Test</div>;
    ComponentWithDisplayName.displayName = 'CustomComponent';

    const WrappedComponent = withPermissions(ComponentWithDisplayName);
    expect(WrappedComponent.displayName).toBe('withPermissions(CustomComponent)');
  });

  it('should correctly check hasPermission function', () => {
    const mockUser = { id: 1, username: 'admin', is_admin: true };
    mockUseAuth.mockReturnValue({ user: mockUser });

    let capturedHasPermission: (permission: string) => boolean;

    const TestHasPermissionComponent = ({
      hasPermission,
    }: {
      hasPermission: (permission: string) => boolean;
    }) => {
      capturedHasPermission = hasPermission;
      return <div>Test</div>;
    };

    const WrappedComponent = withPermissions(TestHasPermissionComponent);

    render(<WrappedComponent />);

    expect(capturedHasPermission!('admin')).toBe(true);
    expect(capturedHasPermission!('read')).toBe(true);
    expect(capturedHasPermission!('write')).toBe(true);
    expect(capturedHasPermission!('delete')).toBe(true);
    expect(capturedHasPermission!('nonexistent')).toBe(false);
  });

  it('should correctly check hasRole function', () => {
    const mockUser = { id: 2, username: 'user', is_admin: false };
    mockUseAuth.mockReturnValue({ user: mockUser });

    let capturedHasRole: (role: string) => boolean;

    const TestHasRoleComponent = ({
      hasRole,
    }: {
      hasRole: (role: string) => boolean;
    }) => {
      capturedHasRole = hasRole;
      return <div>Test</div>;
    };

    const WrappedComponent = withPermissions(TestHasRoleComponent);

    render(<WrappedComponent />);

    expect(capturedHasRole!('user')).toBe(true);
    expect(capturedHasRole!('admin')).toBe(false);
  });

  it('should handle multiple required permissions', () => {
    const mockUser = { id: 1, username: 'admin', is_admin: true };
    mockUseAuth.mockReturnValue({ user: mockUser });

    const WrappedComponent = withPermissions(TestComponent, {
      requiredPermissions: ['read', 'write', 'admin'],
    });

    render(<WrappedComponent />);

    expect(screen.getByTestId('test-component')).toBeInTheDocument();
  });

  it('should deny access when missing one of multiple required permissions', () => {
    const mockUser = { id: 2, username: 'user', is_admin: false };
    mockUseAuth.mockReturnValue({ user: mockUser });

    const WrappedComponent = withPermissions(TestComponent, {
      requiredPermissions: ['read', 'admin'], // user has 'read' but not 'admin'
    });

    render(<WrappedComponent />);

    expect(screen.queryByTestId('test-component')).not.toBeInTheDocument();
    expect(screen.getByTestId('alert-warning')).toBeInTheDocument();
  });
});