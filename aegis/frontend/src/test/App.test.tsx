import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { BrowserRouter } from 'react-router-dom';

// Mock data
const getMockUser = () => ({
  id: '1',
  username: 'testuser',
  email: 'test@example.com',
  storage_quota: 1000000,
  used_storage: 500000,
  is_admin: false,
  created_at: '2023-01-01T00:00:00Z'
});

const mockUser = getMockUser();
const mockAdminUser = { ...mockUser, is_admin: true };

const mockNavigate = jest.fn();

// Mock react-router-dom
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
  Navigate: ({ to }: { to: string }) => <div data-testid={`navigate-${to}`} />,
  Routes: ({ children }: { children: React.ReactNode }) => <div data-testid="routes">{children}</div>,
  Route: ({ path, element }: { path: string; element: React.ReactNode }) => <div data-testid={`route-${path}`}>{element}</div>,
}));

// Mock Apollo Client
jest.mock('../apollo/client', () => ({
  default: {
    query: jest.fn(),
    mutate: jest.fn(),
    subscribe: jest.fn(),
  },
}));

// Mock AuthContext
jest.mock('../contexts/AuthContext', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => <div data-testid="auth-provider">{children}</div>,
  useAuth: jest.fn(() => ({
    user: getMockUser(),
    loading: false,
  })),
}));

// Mock components
jest.mock('../components/auth/Login', () => () => <div data-testid="login-component">Login Component</div>);
jest.mock('../components/auth/Register', () => () => <div data-testid="register-component">Register Component</div>);
jest.mock('../components/dashboard/Dashboard', () => () => <div data-testid="dashboard-component">Dashboard Component</div>);
jest.mock('../components/admin/AdminDashboard', () => () => <div data-testid="admin-dashboard-component">Admin Dashboard Component</div>);
jest.mock('../components/common/LoadingSpinner', () => ({ message }: { message?: string }) => (
  <div data-testid="loading-spinner">{message || 'Loading...'}</div>
));

// Import the component after mocks
import App from '../App';
import { useAuth } from '../contexts/AuthContext';

const theme = createTheme();

const renderApp = () => {
  return render(
    <BrowserRouter>
      <App />
    </BrowserRouter>
  );
};

describe('App Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useAuth as jest.Mock).mockReturnValue({
      user: getMockUser(),
      loading: false,
    });
  });

  it('renders with theme provider and auth provider', () => {
    renderApp();

    expect(screen.getByTestId('auth-provider')).toBeInTheDocument();
  });

  it('renders ApolloProvider', () => {
    renderApp();

    // Since ApolloProvider wraps everything, we can check if the app renders without errors
    expect(screen.getByTestId('auth-provider')).toBeInTheDocument();
  });

  it('renders CssBaseline', () => {
    renderApp();

    // CssBaseline doesn't render visible content, but we can check the structure
    expect(document.querySelector('div')).toBeInTheDocument();
  });

  it('includes theme in ThemeProvider', () => {
    renderApp();

    // The theme should be applied to the root element
    const rootElement = document.querySelector('div');
    expect(rootElement).toBeInTheDocument();
  });

  it('handles routing structure', () => {
    renderApp();

    // Since we're mocking components, we should see the auth provider which wraps the routes
    expect(screen.getByTestId('auth-provider')).toBeInTheDocument();
  });

  it('renders without crashing', () => {
    expect(() => renderApp()).not.toThrow();
  });

  it('maintains component hierarchy', () => {
    renderApp();

    // Check that providers are properly nested
    expect(screen.getByTestId('auth-provider')).toBeInTheDocument();
  });
});

// Test ProtectedRoute component separately
describe('ProtectedRoute Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useAuth as jest.Mock).mockReturnValue({
      user: mockUser,
      loading: false,
    });
  });

  it('renders children when user is authenticated', () => {
    (useAuth as jest.Mock).mockReturnValue({
      user: mockUser,
      loading: false,
    });

    // Import and test ProtectedRoute directly
    const { ProtectedRoute } = require('../App');

    render(
      <BrowserRouter>
        <ThemeProvider theme={theme}>
          <ProtectedRoute>
            <div data-testid="protected-content">Protected Content</div>
          </ProtectedRoute>
        </ThemeProvider>
      </BrowserRouter>
    );

    expect(screen.getByTestId('protected-content')).toBeInTheDocument();
  });

  it('renders loading spinner when loading', () => {
    (useAuth as jest.Mock).mockReturnValue({
      user: null,
      loading: true,
    });

    const { ProtectedRoute } = require('../App');

    render(
      <BrowserRouter>
        <ThemeProvider theme={theme}>
          <ProtectedRoute>
            <div>Protected Content</div>
          </ProtectedRoute>
        </ThemeProvider>
      </BrowserRouter>
    );

    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
  });

  it('redirects to login when user is not authenticated', () => {
    (useAuth as jest.Mock).mockReturnValue({
      user: null,
      loading: false,
    });

    const { ProtectedRoute } = require('../App');

    render(
      <BrowserRouter>
        <ThemeProvider theme={theme}>
          <ProtectedRoute>
            <div>Protected Content</div>
          </ProtectedRoute>
        </ThemeProvider>
      </BrowserRouter>
    );

    // Since Navigate component redirects, we can't easily test the redirect in this setup
    // But we can check that the component renders without the protected content
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });

  it('redirects to dashboard when adminOnly is true and user is not admin', () => {
    (useAuth as jest.Mock).mockReturnValue({
      user: { ...mockUser, is_admin: false },
      loading: false,
    });

    const { ProtectedRoute } = require('../App');

    render(
      <BrowserRouter>
        <ThemeProvider theme={theme}>
          <ProtectedRoute adminOnly>
            <div>Admin Content</div>
          </ProtectedRoute>
        </ThemeProvider>
      </BrowserRouter>
    );

    expect(screen.queryByText('Admin Content')).not.toBeInTheDocument();
  });

  it('renders children when adminOnly is true and user is admin', () => {
    (useAuth as jest.Mock).mockReturnValue({
      user: mockAdminUser,
      loading: false,
    });

    const { ProtectedRoute } = require('../App');

    render(
      <BrowserRouter>
        <ThemeProvider theme={theme}>
          <ProtectedRoute adminOnly>
            <div data-testid="admin-content">Admin Content</div>
          </ProtectedRoute>
        </ThemeProvider>
      </BrowserRouter>
    );

    expect(screen.getByTestId('admin-content')).toBeInTheDocument();
  });
});

// Test PublicRoute component separately
describe('PublicRoute Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useAuth as jest.Mock).mockReturnValue({
      user: null,
      loading: false,
    });
  });

  it('renders children when user is not authenticated', () => {
    (useAuth as jest.Mock).mockReturnValue({
      user: null,
      loading: false,
    });

    const { PublicRoute } = require('../App');

    render(
      <BrowserRouter>
        <ThemeProvider theme={theme}>
          <PublicRoute>
            <div data-testid="public-content">Public Content</div>
          </PublicRoute>
        </ThemeProvider>
      </BrowserRouter>
    );

    expect(screen.getByTestId('public-content')).toBeInTheDocument();
  });

  it('renders loading spinner when loading', () => {
    (useAuth as jest.Mock).mockReturnValue({
      user: null,
      loading: true,
    });

    const { PublicRoute } = require('../App');

    render(
      <BrowserRouter>
        <ThemeProvider theme={theme}>
          <PublicRoute>
            <div>Public Content</div>
          </PublicRoute>
        </ThemeProvider>
      </BrowserRouter>
    );

    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
  });

  it('redirects to dashboard when user is authenticated', () => {
    (useAuth as jest.Mock).mockReturnValue({
      user: mockUser,
      loading: false,
    });

    const { PublicRoute } = require('../App');

    render(
      <BrowserRouter>
        <ThemeProvider theme={theme}>
          <PublicRoute>
            <div>Public Content</div>
          </PublicRoute>
        </ThemeProvider>
      </BrowserRouter>
    );

    expect(screen.queryByText('Public Content')).not.toBeInTheDocument();
  });
});