import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';

// Mock the dependencies first
const mockUser = {
  id: '1',
  email: 'test@example.com',
  storage_quota: 1000000,
  used_storage: 500000,
  is_admin: false,
  created_at: '2023-01-01T00:00:00Z'
};

const mockAdminUser = {
  ...mockUser,
  is_admin: true
};

const mockLogout = jest.fn();
const mockNavigate = jest.fn();

// Mock react-router-dom
jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

// Mock the AuthContext
jest.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: mockUser,
    logout: mockLogout,
  }),
}));

// Import the component after mocks
import Dashboard from '../../../components/dashboard/Dashboard';

const theme = createTheme();

const renderDashboard = () => {
  return render(
    <ThemeProvider theme={theme}>
      <Dashboard />
    </ThemeProvider>
  );
};

const renderDashboardWithAdmin = () => {
  // Re-mock with admin user
  jest.mock('../../../contexts/AuthContext', () => ({
    useAuth: () => ({
      user: mockAdminUser,
      logout: mockLogout,
    }),
  }), { virtual: true });

  return render(
    <ThemeProvider theme={theme}>
      <Dashboard />
    </ThemeProvider>
  );
};

describe('Dashboard Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders dashboard correctly for regular user', () => {
    renderDashboard();

    expect(screen.getByText('Aegis File Vault')).toBeInTheDocument();
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Welcome, test@example.com')).toBeInTheDocument();
    expect(screen.getByText('Welcome to your secure file vault!')).toBeInTheDocument();
    expect(screen.getByText('Quick Stats')).toBeInTheDocument();
    expect(screen.getByText('Storage Used: 500000 / 1000000 bytes')).toBeInTheDocument();
    expect(screen.getByText('Account Type: User')).toBeInTheDocument();
  });

  it('renders dashboard correctly for admin user', () => {
    renderDashboardWithAdmin();

    expect(screen.getByText('Welcome, test@example.com')).toBeInTheDocument();
    expect(screen.getByText('Account Type: Administrator')).toBeInTheDocument();
  });

  it('opens and closes user menu', () => {
    renderDashboard();

    const menuButton = screen.getByLabelText(/account of current user/i);
    expect(screen.queryByText('Logout')).not.toBeInTheDocument();

    fireEvent.click(menuButton);
    expect(screen.getByText('Logout')).toBeInTheDocument();

    // Click outside or close menu
    fireEvent.click(document.body);
    expect(screen.queryByText('Logout')).not.toBeInTheDocument();
  });

  it('shows admin panel option for admin users', () => {
    renderDashboardWithAdmin();

    const menuButton = screen.getByLabelText(/account of current user/i);
    fireEvent.click(menuButton);

    expect(screen.getByText('Admin Panel')).toBeInTheDocument();
    expect(screen.getByText('Logout')).toBeInTheDocument();
  });

  it('does not show admin panel option for regular users', () => {
    renderDashboard();

    const menuButton = screen.getByLabelText(/account of current user/i);
    fireEvent.click(menuButton);

    expect(screen.queryByText('Admin Panel')).not.toBeInTheDocument();
    expect(screen.getByText('Logout')).toBeInTheDocument();
  });

  it('calls logout and closes menu when logout is clicked', () => {
    renderDashboard();

    const menuButton = screen.getByLabelText(/account of current user/i);
    fireEvent.click(menuButton);

    const logoutButton = screen.getByText('Logout');
    fireEvent.click(logoutButton);

    expect(mockLogout).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Logout')).not.toBeInTheDocument();
  });

  it('navigates to admin panel when admin panel is clicked', () => {
    renderDashboardWithAdmin();

    const menuButton = screen.getByLabelText(/account of current user/i);
    fireEvent.click(menuButton);

    const adminButton = screen.getByText('Admin Panel');
    fireEvent.click(adminButton);

    expect(mockNavigate).toHaveBeenCalledWith('/admin');
    expect(screen.queryByText('Admin Panel')).not.toBeInTheDocument();
  });

  it('handles user with null values gracefully', () => {
    // Mock with null user
    jest.mock('../../../contexts/AuthContext', () => ({
      useAuth: () => ({
        user: null,
        logout: mockLogout,
      }),
    }), { virtual: true });

    render(
      <ThemeProvider theme={theme}>
        <Dashboard />
      </ThemeProvider>
    );

    expect(screen.getByText('Welcome,')).toBeInTheDocument();
    expect(screen.getByText('Storage Used: / bytes')).toBeInTheDocument();
    expect(screen.getByText('Account Type: User')).toBeInTheDocument();
  });

  it('handles user with missing storage values', () => {
    const userWithoutStorage = {
      ...mockUser,
      used_storage: undefined,
      storage_quota: undefined
    };

    jest.doMock('../../../contexts/AuthContext', () => ({
      useAuth: () => ({
        user: userWithoutStorage,
        logout: mockLogout,
      }),
    }));

    const DashboardComponent = require('../../../components/dashboard/Dashboard').default;

    render(
      <ThemeProvider theme={theme}>
        <DashboardComponent />
      </ThemeProvider>
    );

    expect(screen.getByText('Storage Used: undefined / undefined bytes')).toBeInTheDocument();
  });

  it('renders app bar with correct styling', () => {
    renderDashboard();

    const appBar = screen.getByRole('banner');
    expect(appBar).toBeInTheDocument();

    const toolbar = screen.getByText('Aegis File Vault').parentElement;
    expect(toolbar).toBeInTheDocument();
  });

  it('renders container with correct content', () => {
    renderDashboard();

    const container = screen.getByText('Dashboard').parentElement;
    expect(container).toBeInTheDocument();

    expect(screen.getByText('Total Users')).toBeInTheDocument();
    expect(screen.getByText('Total Files')).toBeInTheDocument();
    expect(screen.getByText('Storage Used')).toBeInTheDocument();
    expect(screen.getByText('Active Rooms')).toBeInTheDocument();

    // Check that stats show 0 (hardcoded values)
    expect(screen.getAllByText('0')).toHaveLength(4);
  });
});