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
  InputAdornment,
  IconButton,
  Box,
  Autocomplete,
  Chip,
} from '@mui/material';
import {
  Lock as LockIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  Share as ShareIcon,
  AccessTime as AccessTimeIcon,
  GetApp as GetAppIcon,
  People as PeopleIcon,
} from '@mui/icons-material';
import { DateTimePicker } from '@mui/x-date-pickers';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { useLazyQuery } from '@apollo/client';
import { GET_USERS } from '../../apollo/queries';

interface SharePasswordDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (password?: string, expiresAt?: Date, maxDownloads?: number, allowedUsernames?: string[]) => Promise<void>;
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
  title = 'Share File',
  message = 'Optionally set a password to protect this shared file. Leave empty for passwordless access.',
  confirmText = 'Create Share',
  cancelText = 'Cancel',
  isLoading = false,
  error,
}) => {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const [maxDownloads, setMaxDownloads] = useState<string>('');
  const [selectedUsers, setSelectedUsers] = useState<any[]>([]);

  const [searchUsers, { data: usersData, loading: usersLoading }] = useLazyQuery(GET_USERS);

  const handleConfirm = async () => {
    setLocalError(null);

    // Allow empty password for passwordless shares
    if (password.trim() !== "" && password.length < 12) {
      setLocalError('Password must be at least 12 characters long');
      return;
    }

    if (password.trim() !== "" && !/[A-Z]/.test(password)) {
      setLocalError('Password must contain at least one uppercase letter');
      return;
    }

    if (password.trim() !== "" && !/[a-z]/.test(password)) {
      setLocalError('Password must contain at least one lowercase letter');
      return;
    }

    if (password.trim() !== "" && !/\d/.test(password)) {
      setLocalError('Password must contain at least one digit');
      return;
    }

    if (password.trim() !== "" && !/[!@#$%^&*()_+\-={}|;:,.<>?]/.test(password)) {
      setLocalError('Password must contain at least one special character');
      return;
    }

    // Validate expiry date
    if (expiresAt && expiresAt <= new Date()) {
      setLocalError('Expiry date must be in the future');
      return;
    }

    // Validate download limit
    const maxDownloadsNum = maxDownloads ? parseInt(maxDownloads, 10) : undefined;
    if (maxDownloadsNum !== undefined && (isNaN(maxDownloadsNum) || maxDownloadsNum <= 0)) {
      setLocalError('Download limit must be a positive number');
      return;
    }

    const allowedUsernames = selectedUsers.length > 0 ? selectedUsers.map(user => user.username) : undefined;

    try {
      await onConfirm(password.trim() || undefined, expiresAt || undefined, maxDownloadsNum, allowedUsernames);
      handleClose();
    } catch (err: any) {
      setLocalError(err.message || 'Failed to create share');
    }
  };

  const handleClose = () => {
    setPassword('');
    setLocalError(null);
    setShowPassword(false);
    setExpiresAt(null);
    setMaxDownloads('');
    setSelectedUsers([]);
    onClose();
  };

  const displayError = localError || error;

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <ShareIcon />
          {title}
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {message}
          </Typography>

          <TextField
            fullWidth
            type={showPassword ? 'text' : 'password'}
            label="Password (Optional)"
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

          <Autocomplete
            multiple
            options={usersData?.users || []}
            getOptionLabel={(option) => option.username}
            value={selectedUsers}
            onChange={(_, newValue) => setSelectedUsers(newValue)}
            onInputChange={(_, newInputValue) => {
              if (newInputValue) {
                searchUsers({ variables: { search: newInputValue } });
              }
            }}
            loading={usersLoading}
            disabled={isLoading}
            renderTags={(tagValue, getTagProps) =>
              tagValue.map((option, index) => (
                <Chip label={option.username} {...getTagProps({ index })} />
              ))
            }
            renderInput={(params) => (
              <TextField
                {...params}
                label="Allowed Usernames (Optional)"
                helperText="Leave empty for public access. Search and select usernames to restrict access."
                InputProps={{
                  ...params.InputProps,
                  startAdornment: (
                    <InputAdornment position="start">
                      <PeopleIcon />
                    </InputAdornment>
                  ),
                }}
              />
            )}
            sx={{ mb: 2 }}
          />

          <Box sx={{ display: 'flex', gap: 2, mb: displayError ? 2 : 0 }}>
            <DateTimePicker
              label="Expiry Date (Optional)"
              value={expiresAt}
              onChange={(newValue: Date | null) => setExpiresAt(newValue)}
              disabled={isLoading}
              slotProps={{
                textField: {
                  sx: { flex: 1 },
                  InputProps: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <AccessTimeIcon />
                      </InputAdornment>
                    ),
                  },
                },
              }}
            />

            <TextField
              type="number"
              label="Download Limit (Optional)"
              value={maxDownloads}
              onChange={(e) => setMaxDownloads(e.target.value)}
              disabled={isLoading}
              sx={{ width: 250 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <GetAppIcon />
                  </InputAdornment>
                ),
                inputProps: { min: 1 },
              }}
              helperText="Leave empty for unlimited downloads"
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
            disabled={isLoading}
            startIcon={<ShareIcon />}
          >
            {isLoading ? 'Creating...' : confirmText}
          </Button>
        </DialogActions>
      </Dialog>
    </LocalizationProvider>
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