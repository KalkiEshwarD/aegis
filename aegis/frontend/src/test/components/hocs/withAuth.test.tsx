import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import withAuth from '../../../components/hocs/withAuth';
import { AuthProvider } from '../../../contexts/AuthContext';

// Mock the AuthContext
const mockUseAuth = jest.fn();
jest.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

// Mock react-router-dom
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

// Mock LoadingSpinner
jest.mock('../../../components/common/LoadingSpinner', () => {
  return function MockLoadingSpinner({ message }: { message: string }) {
    return <div data-testid="loading-spinner">{message}</div>;
  };
});

describe('withAuth HOC', () => {
  const TestComponent = ({ user, isAuthenticated }: { user: any; isAuthenticated: boolean }) => (
    <div data-testid="test-component">
      User: {user ? user.username : 'null'}, Authenticated: {isAuthenticated ? 'true' : 'false'}
    </div>
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render component when user is authenticated', async () => {
    const mockUser = { id: 1, username: 'testuser' };
    mockUseAuth.mockReturnValue({
      user: mockUser,
      loading: false,
    });

    const WrappedComponent = withAuth(TestComponent);

    render(
      <MemoryRouter>
        <WrappedComponent />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('test-component')).toBeInTheDocument();
      expect(screen.getByText('User: testuser, Authenticated: true')).toBeInTheDocument();
    });

    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('should redirect when user is not authenticated and auth is required', async () => {
    mockUseAuth.mockReturnValue({
      user: null,
      loading: false,
    });

    const WrappedComponent = withAuth(TestComponent);

    render(
      <MemoryRouter>
        <WrappedComponent />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/login');
    });

    expect(screen.queryByTestId('test-component')).not.toBeInTheDocument();
  });

  it('should show loading spinner while checking authentication', () => {
    mockUseAuth.mockReturnValue({
      user: null,
      loading: true,
    });

    const WrappedComponent = withAuth(TestComponent);

    render(
      <MemoryRouter>
        <WrappedComponent />
      </MemoryRouter>
    );

    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
    expect(screen.getByText('Checking authentication...')).toBeInTheDocument();
  });

  it('should redirect to custom path when specified', async () => {
    mockUseAuth.mockReturnValue({
      user: null,
      loading: false,
    });

    const WrappedComponent = withAuth(TestComponent, { redirectTo: '/custom-login' });

    render(
      <MemoryRouter>
        <WrappedComponent />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/custom-login');
    });
  });

  it('should not require authentication when requireAuth is false', async () => {
    mockUseAuth.mockReturnValue({
      user: null,
      loading: false,
    });

    const WrappedComponent = withAuth(TestComponent, { requireAuth: false });

    render(
      <MemoryRouter>
        <WrappedComponent />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('test-component')).toBeInTheDocument();
      expect(screen.getByText('User: null, Authenticated: false')).toBeInTheDocument();
    });

    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('should render component after loading completes with authenticated user', async () => {
    // Start with loading
    mockUseAuth.mockReturnValue({
      user: null,
      loading: true,
    });

    const WrappedComponent = withAuth(TestComponent);

    const { rerender } = render(
      <MemoryRouter>
        <WrappedComponent />
      </MemoryRouter>
    );

    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();

    // Complete loading with authenticated user
    const mockUser = { id: 1, username: 'testuser' };
    mockUseAuth.mockReturnValue({
      user: mockUser,
      loading: false,
    });

    rerender(
      <MemoryRouter>
        <WrappedComponent />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('test-component')).toBeInTheDocument();
      expect(screen.getByText('User: testuser, Authenticated: true')).toBeInTheDocument();
    });
  });

  it('should set correct displayName', () => {
    const WrappedComponent = withAuth(TestComponent);
    expect(WrappedComponent.displayName).toBe('withAuth(TestComponent)');
  });

  it('should pass through additional props', async () => {
    const mockUser = { id: 1, username: 'testuser' };
    mockUseAuth.mockReturnValue({
      user: mockUser,
      loading: false,
    });

    const WrappedComponent = withAuth(TestComponent);

    render(
      <MemoryRouter>
        <WrappedComponent customProp="test" />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('test-component')).toBeInTheDocument();
    });
  });
});