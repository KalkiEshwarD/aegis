import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Typography,
  Alert,
  Box,
  InputAdornment,
  IconButton,
} from '@mui/material';
import {
  Lock as LockIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  Share as ShareIcon,
} from '@mui/icons-material';

interface SharePasswordDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (password: string) => Promise<void>;
  title?: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  isLoading?: boolean;
  error?: string;
}

export const SharePasswordDialog: React.FC<SharePasswordDialogProps> = ({
  open,
  onClose,
  onConfirm,
  title = 'Set Share Password',
  message = 'Enter a password to protect this shared file. Recipients will need this password to access the file.',
  confirmText = 'Create Share',
  cancelText = 'Cancel',
  isLoading = false,
  error,
}) => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleConfirm = async () => {
    setLocalError(null);

    if (!password.trim()) {
      setLocalError('Password is required');
      return;
    }

    if (password.length < 6) {
      setLocalError('Password must be at least 6 characters long');
      return;
    }

    if (password !== confirmPassword) {
      setLocalError('Passwords do not match');
      return;
    }

    try {
      await onConfirm(password);
      handleClose();
    } catch (err: any) {
      setLocalError(err.message || 'Failed to create share');
    }
  };

  const handleClose = () => {
    setPassword('');
    setConfirmPassword('');
    setLocalError(null);
    setShowPassword(false);
    setShowConfirmPassword(false);
    onClose();
  };

  const displayError = localError || error;

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <ShareIcon />
        {title}
      </DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {message}
        </Typography>

        <Box sx={{ mb: 2 }}>
          <TextField
            fullWidth
            type={showPassword ? 'text' : 'password'}
            label="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={isLoading}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <LockIcon />
                </InputAdornment>
              ),
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    onClick={() => setShowPassword(!showPassword)}
                    edge="end"
                  >
                    {showPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
            sx={{ mb: 2 }}
          />

          <TextField
            fullWidth
            type={showConfirmPassword ? 'text' : 'password'}
            label="Confirm Password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            disabled={isLoading}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <LockIcon />
                </InputAdornment>
              ),
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    edge="end"
                  >
                    {showConfirmPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />
        </Box>

        {displayError && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {displayError}
          </Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={isLoading}>
          {cancelText}
        </Button>
        <Button
          onClick={handleConfirm}
          variant="contained"
          disabled={isLoading || !password.trim() || !confirmPassword.trim()}
          startIcon={<ShareIcon />}
        >
          {isLoading ? 'Creating...' : confirmText}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// Specialized dialog for accessing shared files with password
interface AccessSharedFileDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (password: string) => Promise<void>;
  filename?: string;
  isLoading?: boolean;
  error?: string;
}

export const AccessSharedFileDialog: React.FC<AccessSharedFileDialogProps> = ({
  open,
  onClose,
  onConfirm,
  filename,
  isLoading = false,
  error,
}) => {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleConfirm = async () => {
    setLocalError(null);

    if (!password.trim()) {
      setLocalError('Password is required');
      return;
    }

    try {
      await onConfirm(password);
      handleClose();
    } catch (err: any) {
      setLocalError(err.message || 'Invalid password');
    }
  };

  const handleClose = () => {
    setPassword('');
    setLocalError(null);
    setShowPassword(false);
    onClose();
  };

  const displayError = localError || error;

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <LockIcon />
        Access Shared File
      </DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {filename ? `Enter the password to access "${filename}"` : 'Enter the password to access this shared file'}
        </Typography>

        <TextField
          fullWidth
          type={showPassword ? 'text' : 'password'}
          label="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={isLoading}
          onKeyPress={(e) => {
            if (e.key === 'Enter' && password.trim()) {
              handleConfirm();
            }
          }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <LockIcon />
              </InputAdornment>
            ),
            endAdornment: (
              <InputAdornment position="end">
                <IconButton
                  onClick={() => setShowPassword(!showPassword)}
                  edge="end"
                >
                  {showPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                </IconButton>
              </InputAdornment>
            ),
          }}
          sx={{ mb: displayError ? 2 : 0 }}
        />

        {displayError && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {displayError}
          </Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={isLoading}>
          Cancel
        </Button>
        <Button
          onClick={handleConfirm}
          variant="contained"
          disabled={isLoading || !password.trim()}
          startIcon={<LockIcon />}
        >
          {isLoading ? 'Accessing...' : 'Access File'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};