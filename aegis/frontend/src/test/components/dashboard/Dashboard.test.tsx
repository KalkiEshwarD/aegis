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
  useAuth: jest.fn(() => ({
    user: mockUser,
    logout: mockLogout,
  })),
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


describe('Dashboard Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset to default mock
    const { useAuth } = require('../../../contexts/AuthContext');
    useAuth.mockReturnValue({
      user: mockUser,
      logout: mockLogout,
    });
  });

  it('renders dashboard correctly for regular user', () => {
    renderDashboard();

    expect(screen.getByText('Aegis File Vault')).toBeInTheDocument();
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Welcome, test@example.com')).toBeInTheDocument();
    expect(screen.getByText('Welcome to your secure file vault! Upload, manage, and share your files with end-to-end encryption.')).toBeInTheDocument();
    expect(screen.getByText('Quick Stats')).toBeInTheDocument();
    expect(screen.getByText('Storage Used: 500000 / 1000000 bytes')).toBeInTheDocument();
    expect(screen.getByText('Account Type: User')).toBeInTheDocument();
  });

  it('renders dashboard correctly for admin user', () => {
    const { useAuth } = require('../../../contexts/AuthContext');
    useAuth.mockReturnValue({
      user: mockAdminUser,
      logout: mockLogout,
    });

    renderDashboard();

    expect(screen.getByText('Welcome, test@example.com')).toBeInTheDocument();
    expect(screen.getByText('Account Type: Administrator')).toBeInTheDocument();
  });

  it('opens and closes user menu', () => {
    renderDashboard();

    const menuButton = screen.getByLabelText(/account of current user/i);
    // Menu items are always in DOM but hidden when closed
    expect(screen.getByText('Logout')).toBeInTheDocument();

    fireEvent.click(menuButton);
    expect(screen.getByText('Logout')).toBeInTheDocument();

    // Click outside or close menu
    fireEvent.click(document.body);
    expect(screen.getByText('Logout')).toBeInTheDocument();
  });

  it('shows admin panel option for admin users', () => {
    const { useAuth } = require('../../../contexts/AuthContext');
    useAuth.mockReturnValue({
      user: mockAdminUser,
      logout: mockLogout,
    });

    renderDashboard();

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
    expect(screen.getByText('Logout')).toBeInTheDocument();
  });

  it('navigates to admin panel when admin panel is clicked', () => {
    const { useAuth } = require('../../../contexts/AuthContext');
    useAuth.mockReturnValue({
      user: mockAdminUser,
      logout: mockLogout,
    });

    renderDashboard();

    const menuButton = screen.getByLabelText(/account of current user/i);
    fireEvent.click(menuButton);

    const adminButton = screen.getByText('Admin Panel');
    fireEvent.click(adminButton);

    expect(mockNavigate).toHaveBeenCalledWith('/admin');
    expect(screen.getByText('Admin Panel')).toBeInTheDocument();
  });

  it('handles user with null values gracefully', () => {
    const { useAuth } = require('../../../contexts/AuthContext');
    useAuth.mockReturnValue({
      user: null,
      logout: mockLogout,
    });

    renderDashboard();

    expect(screen.getByText(/^Welcome,$/)).toBeInTheDocument();
    expect(screen.getByText('Storage Used: / bytes')).toBeInTheDocument();
    expect(screen.getByText('Account Type: User')).toBeInTheDocument();
  });

  it('handles user with missing storage values', () => {
    const userWithoutStorage = {
      ...mockUser,
      used_storage: undefined,
      storage_quota: undefined
    };

    const { useAuth } = require('../../../contexts/AuthContext');
    useAuth.mockReturnValue({
      user: userWithoutStorage,
      logout: mockLogout,
    });

    renderDashboard();

    expect(screen.getByText('Storage Used: / bytes')).toBeInTheDocument();
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

    expect(screen.getByText('Quick Stats')).toBeInTheDocument();
    expect(screen.getByText('Storage Used: 500000 / 1000000 bytes')).toBeInTheDocument();
    expect(screen.getByText('Account Type: User')).toBeInTheDocument();
  });
});