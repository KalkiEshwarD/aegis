import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';

// Mock the dependencies first
const mockUser = {
  id: '1',
  email: 'admin@example.com',
  storage_quota: 1000000,
  used_storage: 500000,
  is_admin: true,
  created_at: '2023-01-01T00:00:00Z'
};

const mockNavigate = jest.fn();

// Mock react-router-dom
jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

// Mock the AuthContext
jest.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: mockUser,
  }),
}));

// Import the component after mocks
import AdminDashboard from '../../../components/admin/AdminDashboard';

const theme = createTheme();

const renderAdminDashboard = () => {
  return render(
    <ThemeProvider theme={theme}>
      <AdminDashboard />
    </ThemeProvider>
  );
};

/*
describe('AdminDashboard Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders admin dashboard correctly', () => {
    renderAdminDashboard();

    expect(screen.getByText('Admin Dashboard')).toBeInTheDocument();
    expect(screen.getByText('System Administration')).toBeInTheDocument();
    expect(screen.getByText('Manage users, files, and system statistics.')).toBeInTheDocument();
    expect(screen.getByText('admin@example.com')).toBeInTheDocument();
  });

  it('renders statistics cards', () => {
    renderAdminDashboard();

    expect(screen.getByText('Total Users')).toBeInTheDocument();
    expect(screen.getByText('Total Files')).toBeInTheDocument();
    expect(screen.getByText('Storage Used')).toBeInTheDocument();
    expect(screen.getByText('Active Rooms')).toBeInTheDocument();

    // Check hardcoded values
    expect(screen.getAllByText('0')).toHaveLength(3);
    expect(screen.getByText('0 MB')).toBeInTheDocument();
  });

  it('renders administrative actions section', () => {
    renderAdminDashboard();

    expect(screen.getByText('Administrative Actions')).toBeInTheDocument();
    expect(screen.getByText('Admin features will be implemented in the next phase.')).toBeInTheDocument();
  });

  it('navigates back to dashboard when back button is clicked', () => {
    renderAdminDashboard();

    const backButton = screen.getByLabelText('back');
    fireEvent.click(backButton);

    expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
  });

  it('handles user with null values gracefully', () => {
    // Mock with null user using jest.spyOn
    const useAuthSpy = jest.spyOn(require('../../../contexts/AuthContext'), 'useAuth');
    useAuthSpy.mockReturnValue({
      user: null,
    });

    renderAdminDashboard();

    expect(screen.getByText('Admin Dashboard')).toBeInTheDocument();
    // Should not crash, but email display might be empty
    expect(screen.queryByText('admin@example.com')).not.toBeInTheDocument();

    useAuthSpy.mockRestore();
  });

  it('renders app bar with correct styling', () => {
    renderAdminDashboard();

    const appBar = screen.getByRole('banner');
    expect(appBar).toBeInTheDocument();

    const backButton = screen.getByLabelText('back');
    expect(backButton).toBeInTheDocument();

    const title = screen.getByText('Admin Dashboard');
    expect(title).toBeInTheDocument();
  });

  it('renders paper cards with correct layout', () => {
    renderAdminDashboard();

    const cards = screen.getAllByRole('generic').filter(card =>
      card.classList.contains('MuiPaper-root') &&
      !card.classList.contains('MuiPaper-elevation4') // Exclude AppBar
    );
    expect(cards).toHaveLength(4);

    cards.forEach(card => {
      expect(card).toHaveClass('MuiPaper-root');
    });
  });

  it('displays statistics with correct formatting', () => {
    renderAdminDashboard();

    // Check that numbers are displayed correctly
    const statValues = screen.getAllByText('0');
    expect(statValues).toHaveLength(3);

    // Check storage display
    expect(screen.getByText('0 MB')).toBeInTheDocument();
  });
});
*/