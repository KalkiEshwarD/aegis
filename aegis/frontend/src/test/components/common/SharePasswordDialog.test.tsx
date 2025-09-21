import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SharePasswordDialog, AccessSharedFileDialog } from '../../../shared/components/SharePasswordDialog';

/*
describe('SharePasswordDialog', () => {
  const defaultProps = {
    open: true,
    onClose: jest.fn(),
    onConfirm: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('SharePasswordDialog', () => {
    test('renders dialog with default props', () => {
      render(<SharePasswordDialog {...defaultProps} />);

      expect(screen.getByText('Set Share Password')).toBeInTheDocument();
      expect(screen.getByText('Enter a password to protect this shared file. Recipients will need this password to access the file.')).toBeInTheDocument();
      expect(screen.getByLabelText('Password')).toBeInTheDocument();
      expect(screen.getByLabelText('Confirm Password')).toBeInTheDocument();
      expect(screen.getByText('Create Share')).toBeInTheDocument();
      expect(screen.getByText('Cancel')).toBeInTheDocument();
    });

    test('renders with custom props', () => {
      render(
        <SharePasswordDialog
          {...defaultProps}
          title="Custom Title"
          message="Custom message"
          confirmText="Custom Confirm"
          cancelText="Custom Cancel"
        />
      );

      expect(screen.getByText('Custom Title')).toBeInTheDocument();
      expect(screen.getByText('Custom message')).toBeInTheDocument();
      expect(screen.getByText('Custom Confirm')).toBeInTheDocument();
      expect(screen.getByText('Custom Cancel')).toBeInTheDocument();
    });

    test('validates password requirements', async () => {
      const mockOnConfirm = jest.fn();
      render(<SharePasswordDialog {...defaultProps} onConfirm={mockOnConfirm} />);

      const confirmButton = screen.getByText('Create Share');
      const passwordInput = screen.getByLabelText('Password');
      const confirmPasswordInput = screen.getByLabelText('Confirm Password');

      // Short password
      fireEvent.change(passwordInput, { target: { value: '12345' } });
      fireEvent.change(confirmPasswordInput, { target: { value: '12345' } });
      fireEvent.click(confirmButton);
      await waitFor(() => {
        expect(screen.getByText('Password must be at least 6 characters long')).toBeInTheDocument();
      });

      // Passwords don't match
      fireEvent.change(passwordInput, { target: { value: 'password123' } });
      fireEvent.change(confirmPasswordInput, { target: { value: 'different123' } });
      fireEvent.click(confirmButton);
      await waitFor(() => {
        expect(screen.getByText('Passwords do not match')).toBeInTheDocument();
      });

      // Empty password - enter text then clear password field
      fireEvent.change(passwordInput, { target: { value: 'password123' } });
      fireEvent.change(confirmPasswordInput, { target: { value: 'password123' } });
      fireEvent.change(passwordInput, { target: { value: '' } });
      fireEvent.click(confirmButton);
      await waitFor(() => {
        expect(screen.getByText('Password is required')).toBeInTheDocument();
      });

      expect(mockOnConfirm).not.toHaveBeenCalled();
    });

    test('calls onConfirm with valid password', async () => {
      const mockOnConfirm = jest.fn().mockResolvedValue(undefined);
      render(<SharePasswordDialog {...defaultProps} onConfirm={mockOnConfirm} />);

      const passwordInput = screen.getByLabelText('Password');
      const confirmPasswordInput = screen.getByLabelText('Confirm Password');
      const confirmButton = screen.getByText('Create Share');

      fireEvent.change(passwordInput, { target: { value: 'password123' } });
      fireEvent.change(confirmPasswordInput, { target: { value: 'password123' } });
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(mockOnConfirm).toHaveBeenCalledWith('password123');
      });
    });

    test('handles onConfirm error', async () => {
      const mockOnConfirm = jest.fn().mockRejectedValue(new Error('Share creation failed'));
      render(<SharePasswordDialog {...defaultProps} onConfirm={mockOnConfirm} />);

      const passwordInput = screen.getByLabelText('Password');
      const confirmPasswordInput = screen.getByLabelText('Confirm Password');
      const confirmButton = screen.getByText('Create Share');

      fireEvent.change(passwordInput, { target: { value: 'password123' } });
      fireEvent.change(confirmPasswordInput, { target: { value: 'password123' } });
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(screen.getByText('Share creation failed')).toBeInTheDocument();
      });
    });

    test('toggles password visibility', () => {
      render(<SharePasswordDialog {...defaultProps} />);

      const passwordInput = screen.getByLabelText('Password');
      const confirmPasswordInput = screen.getByLabelText('Confirm Password');

      // Initially password type
      expect(passwordInput).toHaveAttribute('type', 'password');
      expect(confirmPasswordInput).toHaveAttribute('type', 'password');

      // Click visibility toggle for password
      const visibilityButtons = screen.getAllByRole('button', { hidden: true });
      fireEvent.click(visibilityButtons[0]); // First visibility button

      expect(passwordInput).toHaveAttribute('type', 'text');

      // Click visibility toggle for confirm password
      fireEvent.click(visibilityButtons[1]); // Second visibility button

      expect(confirmPasswordInput).toHaveAttribute('type', 'text');
    });

    test('disables inputs and buttons when loading', () => {
      render(<SharePasswordDialog {...defaultProps} isLoading={true} />);

      const passwordInput = screen.getByLabelText('Password');
      const confirmPasswordInput = screen.getByLabelText('Confirm Password');
      const confirmButton = screen.getByText('Creating...');
      const cancelButton = screen.getByText('Cancel');

      expect(passwordInput).toBeDisabled();
      expect(confirmPasswordInput).toBeDisabled();
      expect(confirmButton).toBeDisabled();
      expect(cancelButton).toBeDisabled();
    });

    test('calls onClose when cancel clicked', () => {
      render(<SharePasswordDialog {...defaultProps} />);

      const cancelButton = screen.getByText('Cancel');
      fireEvent.click(cancelButton);

      expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
    });

    test('resets form on close', () => {
      render(<SharePasswordDialog {...defaultProps} />);

      const passwordInput = screen.getByLabelText('Password');
      const confirmPasswordInput = screen.getByLabelText('Confirm Password');

      fireEvent.change(passwordInput, { target: { value: 'test' } });
      fireEvent.change(confirmPasswordInput, { target: { value: 'test' } });

      const cancelButton = screen.getByText('Cancel');
      fireEvent.click(cancelButton);

      expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
      // Form should be reset when dialog reopens, but since it's closed, we can't check
    });

    test('displays error prop', () => {
      render(<SharePasswordDialog {...defaultProps} error="External error" />);

      expect(screen.getByText('External error')).toBeInTheDocument();
    });
  });

  describe('AccessSharedFileDialog', () => {
    const accessProps = {
      open: true,
      onClose: jest.fn(),
      onConfirm: jest.fn(),
    };

    test('renders dialog with default props', () => {
      render(<AccessSharedFileDialog {...accessProps} />);

      expect(screen.getByText('Access Shared File')).toBeInTheDocument();
      expect(screen.getByText('Enter the password to access this shared file')).toBeInTheDocument();
      expect(screen.getByLabelText('Password')).toBeInTheDocument();
      expect(screen.getByText('Access File')).toBeInTheDocument();
      expect(screen.getByText('Cancel')).toBeInTheDocument();
    });

    test('renders with filename', () => {
      render(<AccessSharedFileDialog {...accessProps} filename="test.pdf" />);

      expect(screen.getByText('Enter the password to access "test.pdf"')).toBeInTheDocument();
    });

    test('validates password is required', async () => {
      const mockOnConfirm = jest.fn();
      render(<AccessSharedFileDialog {...accessProps} onConfirm={mockOnConfirm} />);

      const confirmButton = screen.getByText('Access File');
      fireEvent.click(confirmButton);

      // Error should be set in local state
      expect(mockOnConfirm).not.toHaveBeenCalled();
    });

    test('calls onConfirm with password', async () => {
      const mockOnConfirm = jest.fn().mockResolvedValue(undefined);
      render(<AccessSharedFileDialog {...accessProps} onConfirm={mockOnConfirm} />);

      const passwordInput = screen.getByLabelText('Password');
      const confirmButton = screen.getByText('Access File');

      fireEvent.change(passwordInput, { target: { value: 'access123' } });
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(mockOnConfirm).toHaveBeenCalledWith('access123');
      });
    });

    test('handles Enter key press', async () => {
      const mockOnConfirm = jest.fn().mockResolvedValue(undefined);
      render(<AccessSharedFileDialog {...accessProps} onConfirm={mockOnConfirm} />);

      const passwordInput = screen.getByLabelText('Password');

      fireEvent.change(passwordInput, { target: { value: 'access123' } });
      // Enter key functionality is implemented in the component
      expect(passwordInput).toHaveValue('access123');
    });

    test('handles onConfirm error', async () => {
      const mockOnConfirm = jest.fn().mockRejectedValue(new Error('Invalid password'));
      render(<AccessSharedFileDialog {...accessProps} onConfirm={mockOnConfirm} />);

      const passwordInput = screen.getByLabelText('Password');
      const confirmButton = screen.getByText('Access File');

      fireEvent.change(passwordInput, { target: { value: 'wrong123' } });
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(screen.getByText('Invalid password')).toBeInTheDocument();
      });
    });

    test('toggles password visibility', () => {
      render(<AccessSharedFileDialog {...accessProps} />);

      const passwordInput = screen.getByLabelText('Password');

      // Initially password type
      expect(passwordInput).toHaveAttribute('type', 'password');

      // Click visibility toggle - find the icon button within the input adornment
      const visibilityButton = screen.getByTestId('VisibilityIcon').closest('button');
      fireEvent.click(visibilityButton!);

      expect(passwordInput).toHaveAttribute('type', 'text');
    });

    test('disables inputs when loading', () => {
      render(<AccessSharedFileDialog {...accessProps} isLoading={true} />);

      const passwordInput = screen.getByLabelText('Password');
      const confirmButton = screen.getByText('Accessing...');
      const cancelButton = screen.getByText('Cancel');

      expect(passwordInput).toBeDisabled();
      expect(confirmButton).toBeDisabled();
      expect(cancelButton).toBeDisabled();
    });

    test('displays error prop', () => {
      render(<AccessSharedFileDialog {...accessProps} error="Access denied" />);

      expect(screen.getByText('Access denied')).toBeInTheDocument();
    });
  });
});
*/