import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Alert,
} from '@mui/material';
import { Delete as DeleteIcon } from '@mui/icons-material';

interface ConfirmationDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  confirmColor?: 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning';
  isLoading?: boolean;
  error?: string;
  icon?: React.ReactNode;
}

export const ConfirmationDialog: React.FC<ConfirmationDialogProps> = ({
  open,
  onClose,
  onConfirm,
  title = 'Confirm Action',
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  confirmColor = 'primary',
  isLoading = false,
  error,
  icon,
}) => {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        {icon}
        {title}
      </DialogTitle>
      <DialogContent>
        <Typography variant="body1" sx={{ mb: error ? 2 : 0 }}>
          {message}
        </Typography>
        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={isLoading}>
          {cancelText}
        </Button>
        <Button
          onClick={onConfirm}
          color={confirmColor}
          variant="contained"
          disabled={isLoading}
          startIcon={icon}
        >
          {isLoading ? 'Processing...' : confirmText}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// Specialized delete confirmation dialog
interface DeleteConfirmationDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  itemName: string;
  itemType: 'file' | 'folder' | 'item';
  isDeleting?: boolean;
  error?: string;
}

export const DeleteConfirmationDialog: React.FC<DeleteConfirmationDialogProps> = ({
  open,
  onClose,
  onConfirm,
  itemName,
  itemType,
  isDeleting = false,
  error,
}) => {
  const title = `Delete ${itemType === 'file' ? 'File' : itemType === 'folder' ? 'Folder' : 'Item'}`;
  const message = `Are you sure you want to delete the ${itemType} "${itemName}"? ${
    itemType === 'folder' ? 'This will also delete all contents.' : ''
  } This action cannot be undone.`;

  return (
    <ConfirmationDialog
      open={open}
      onClose={onClose}
      onConfirm={onConfirm}
      title={title}
      message={message}
      confirmText="Delete"
      confirmColor="error"
      isLoading={isDeleting}
      error={error}
      icon={<DeleteIcon />}
    />
  );
};