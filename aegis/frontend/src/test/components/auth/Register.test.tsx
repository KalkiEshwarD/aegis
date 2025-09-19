import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';

// Mock the dependencies first
const mockRegister = jest.fn();
const mockNavigate = jest.fn();

// Mock react-router-dom
jest.mock('react-router-dom', () => ({
  Link: ({ children, to, ...props }: any) => <a href={to} {...props}>{children}</a>,
  useNavigate: () => mockNavigate,
}));

// Mock the AuthContext
jest.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({
    register: mockRegister,
  }),
}));

// Import the component after mocks
import Register from '../../../components/auth/Register';

const theme = createTheme();

const renderRegister = () => {
  return render(
    <ThemeProvider theme={theme}>
      <Register />
    </ThemeProvider>
  );
};

describe('Register Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders registration form correctly', () => {
    renderRegister();

    expect(screen.getByText('Join AegisDrive')).toBeInTheDocument();
    expect(screen.getByText('Create your secure vault')).toBeInTheDocument();
    expect(screen.getByLabelText(/username/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^password \*/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^confirm password \*$/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create account/i })).toBeInTheDocument();
    expect(screen.getByText("Already have an account? Sign in")).toBeInTheDocument();
  });

  it('updates form fields when user types', () => {
    renderRegister();

    const usernameInput = screen.getByLabelText(/username/i) as HTMLInputElement;
    const emailInput = screen.getByLabelText(/email address/i) as HTMLInputElement;
    const passwordInput = screen.getByLabelText(/^password \*/i) as HTMLInputElement;
    const confirmPasswordInput = screen.getByLabelText(/^confirm password \*$/i) as HTMLInputElement;

    fireEvent.change(usernameInput, { target: { value: 'testuser' } });
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'TestPass123!' } });
    fireEvent.change(confirmPasswordInput, { target: { value: 'TestPass123!' } });

    expect(usernameInput.value).toBe('testuser');
    expect(emailInput.value).toBe('test@example.com');
    expect(passwordInput.value).toBe('TestPass123!');
    expect(confirmPasswordInput.value).toBe('TestPass123!');
  });

  it('toggles password visibility for both password fields', () => {
    renderRegister();

    const passwordInput = screen.getByLabelText(/^password \*/i);
    const confirmPasswordInput = screen.getByLabelText(/^confirm password \*$/i);
    const togglePasswordButton = screen.getByLabelText(/toggle password visibility/i);
    const toggleConfirmPasswordButton = screen.getByLabelText(/toggle confirm password visibility/i);

    expect(passwordInput).toHaveAttribute('type', 'password');
    expect(confirmPasswordInput).toHaveAttribute('type', 'password');

    fireEvent.click(togglePasswordButton);
    expect(passwordInput).toHaveAttribute('type', 'text');
    expect(confirmPasswordInput).toHaveAttribute('type', 'password');

    fireEvent.click(toggleConfirmPasswordButton);
    expect(passwordInput).toHaveAttribute('type', 'text');
    expect(confirmPasswordInput).toHaveAttribute('type', 'text');

    fireEvent.click(togglePasswordButton);
    expect(passwordInput).toHaveAttribute('type', 'password');
    expect(confirmPasswordInput).toHaveAttribute('type', 'text');
  });

  it('calls register function with correct credentials on form submission', async () => {
    mockRegister.mockResolvedValue(undefined);

    renderRegister();

    const usernameInput = screen.getByLabelText(/username/i);
    const emailInput = screen.getByLabelText(/email address/i);
    const passwordInput = screen.getByLabelText(/^password \*/i);
    const confirmPasswordInput = screen.getByLabelText(/^confirm password \*$/i);
    const submitButton = screen.getByRole('button', { name: /create account/i });

    await act(async () => {
      fireEvent.change(usernameInput, { target: { value: 'testuser' } });
      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'TestPass123!' } });
      fireEvent.change(confirmPasswordInput, { target: { value: 'TestPass123!' } });
    });

    await act(async () => {
      fireEvent.click(submitButton);
    });

    await waitFor(() => {
      expect(mockRegister).toHaveBeenCalledWith('testuser', 'test@example.com', 'TestPass123!');
    });
  });

  it('navigates to dashboard on successful registration', async () => {
    mockRegister.mockResolvedValue(undefined);

    renderRegister();

    const usernameInput = screen.getByLabelText(/username/i);
    const emailInput = screen.getByLabelText(/email address/i);
    const passwordInput = screen.getByLabelText(/^password \*/i);
    const confirmPasswordInput = screen.getByLabelText(/^confirm password \*$/i);
    const submitButton = screen.getByRole('button', { name: /create account/i });

    await act(async () => {
      fireEvent.change(usernameInput, { target: { value: 'testuser' } });
      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'TestPass123!' } });
      fireEvent.change(confirmPasswordInput, { target: { value: 'TestPass123!' } });
    });

    await act(async () => {
      fireEvent.click(submitButton);
    });

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
    });
  });

  it('displays error message when passwords do not match', async () => {
    renderRegister();

    const usernameInput = screen.getByLabelText(/username/i);
    const emailInput = screen.getByLabelText(/email address/i);
    const passwordInput = screen.getByLabelText(/^password \*/i);
    const confirmPasswordInput = screen.getByLabelText(/^confirm password \*$/i);
    const submitButton = screen.getByRole('button', { name: /create account/i });

    await act(async () => {
      fireEvent.change(usernameInput, { target: { value: 'testuser' } });
      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'TestPass123!' } });
      fireEvent.change(confirmPasswordInput, { target: { value: 'DifferentPass123!' } });
    });

    await act(async () => {
      fireEvent.click(submitButton);
    });

    await waitFor(() => {
      expect(screen.getByText('Passwords must match')).toBeInTheDocument();
    });

    expect(mockRegister).not.toHaveBeenCalled();
  });

  it('displays error message when password is too short', async () => {
    renderRegister();

    const usernameInput = screen.getByLabelText(/username/i);
    const emailInput = screen.getByLabelText(/email address/i);
    const passwordInput = screen.getByLabelText(/^password \*/i);
    const confirmPasswordInput = screen.getByLabelText(/^confirm password \*$/i);
    const submitButton = screen.getByRole('button', { name: /create account/i });

    await act(async () => {
      fireEvent.change(usernameInput, { target: { value: 'testuser' } });
      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.change(passwordInput, { target: { value: '12345' } });
      fireEvent.change(confirmPasswordInput, { target: { value: '12345' } });
    });

    await act(async () => {
      fireEvent.click(submitButton);
    });

    await waitFor(() => {
      expect(screen.getByText('Password must be at least 8 characters')).toBeInTheDocument();
    });

    expect(mockRegister).not.toHaveBeenCalled();
  });

  it('displays error message on registration failure', async () => {
    mockRegister.mockRejectedValue(new Error('Registration failed'));

    renderRegister();

    const usernameInput = screen.getByLabelText(/username/i);
    const emailInput = screen.getByLabelText(/email address/i);
    const passwordInput = screen.getByLabelText(/^password \*/i);
    const confirmPasswordInput = screen.getByLabelText(/^confirm password \*$/i);
    const submitButton = screen.getByRole('button', { name: /create account/i });

    await act(async () => {
      fireEvent.change(usernameInput, { target: { value: 'testuser' } });
      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'TestPass123!' } });
      fireEvent.change(confirmPasswordInput, { target: { value: 'TestPass123!' } });
    });

    await act(async () => {
      fireEvent.click(submitButton);
    });

    await waitFor(() => {
      expect(screen.getByText('Registration failed')).toBeInTheDocument();
    });
  });

  it('shows loading state during form submission', async () => {
    mockRegister.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));

    renderRegister();

    const usernameInput = screen.getByLabelText(/username/i);
    const emailInput = screen.getByLabelText(/email address/i);
    const passwordInput = screen.getByLabelText(/^password \*/i);
    const confirmPasswordInput = screen.getByLabelText(/^confirm password \*$/i);
    const submitButton = screen.getByRole('button', { name: /create account/i });

    await act(async () => {
      fireEvent.change(usernameInput, { target: { value: 'testuser' } });
      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'TestPass123!' } });
      fireEvent.change(confirmPasswordInput, { target: { value: 'TestPass123!' } });
    });

    await act(async () => {
      fireEvent.click(submitButton);
    });

    // Check loading state
    expect(screen.getByText('Creating Account...')).toBeInTheDocument();
    expect(submitButton).toBeDisabled();

    await waitFor(() => {
      expect(screen.queryByText('Creating Account...')).not.toBeInTheDocument();
    });
  });

  it('handles registration with default error message when no specific error provided', async () => {
    mockRegister.mockRejectedValue(new Error());

    renderRegister();

    const usernameInput = screen.getByLabelText(/username/i);
    const emailInput = screen.getByLabelText(/email address/i);
    const passwordInput = screen.getByLabelText(/^password \*/i);
    const confirmPasswordInput = screen.getByLabelText(/^confirm password \*$/i);
    const submitButton = screen.getByRole('button', { name: /create account/i });

    await act(async () => {
      fireEvent.change(usernameInput, { target: { value: 'testuser' } });
      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'TestPass123!' } });
      fireEvent.change(confirmPasswordInput, { target: { value: 'TestPass123!' } });
    });

    await act(async () => {
      fireEvent.click(submitButton);
    });

    await waitFor(() => {
      expect(screen.getByText('Registration failed. Please try again.')).toBeInTheDocument();
    });
  });

  it('clears error message when form is resubmitted successfully', async () => {
    mockRegister
      .mockRejectedValueOnce(new Error('Email already exists'))
      .mockResolvedValueOnce(undefined);

    renderRegister();

    const usernameInput = screen.getByLabelText(/username/i);
    const emailInput = screen.getByLabelText(/email address/i);
    const passwordInput = screen.getByLabelText(/^password \*/i);
    const confirmPasswordInput = screen.getByLabelText(/^confirm password \*$/i);
    const submitButton = screen.getByRole('button', { name: /create account/i });

    // First attempt - should fail
    await act(async () => {
      fireEvent.change(usernameInput, { target: { value: 'testuser' } });
      fireEvent.change(emailInput, { target: { value: 'existing@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'TestPass123!' } });
      fireEvent.change(confirmPasswordInput, { target: { value: 'TestPass123!' } });
    });

    await act(async () => {
      fireEvent.click(submitButton);
    });

    await waitFor(() => {
      expect(screen.getByText('Email already exists')).toBeInTheDocument();
    });

    // Second attempt - should succeed and clear error
    await act(async () => {
      fireEvent.change(emailInput, { target: { value: 'new@example.com' } });
    });

    await act(async () => {
      fireEvent.click(submitButton);
    });

    await waitFor(() => {
      expect(screen.queryByText('Email already exists')).not.toBeInTheDocument();
    });
  });
});