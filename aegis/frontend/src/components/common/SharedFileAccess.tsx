import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  Alert,
  Chip,
  Divider,
  Card,
  CardContent,
  CardActions,
} from '@mui/material';
import {
  Download as DownloadIcon,
  Lock as LockIcon,
  InsertDriveFile as FileIcon,
  AccessTime as AccessTimeIcon,
  GetApp as GetAppIcon,
} from '@mui/icons-material';
import { useMutation } from '@apollo/client';
import { AccessSharedFileDialog } from '../../shared/components';
import { ACCESS_SHARED_FILE_MUTATION } from '../../apollo/queries';
import { formatFileSize } from '../../shared/utils';
import { SharedFileAccess as SharedFileAccessType, AccessSharedFileInput } from '../../types';
import { decryptFile, base64ToEncryptionKey, createDownloadBlob, downloadFile, extractNonceAndData } from '../../utils/crypto';
import { getErrorMessage } from '../../utils/errorHandling';

interface SharedFileAccessProps {
  shareToken: string;
  onAccessSuccess?: () => void;
  onAccessError?: (error: string) => void;
}

interface AccessSharedFileResponse {
  accessSharedFile: SharedFileAccessType;
}

export const SharedFileAccess: React.FC<SharedFileAccessProps> = ({
  shareToken,
  onAccessSuccess,
  onAccessError,
}) => {
  const [accessDialogOpen, setAccessDialogOpen] = useState(false);
  const [sharedFileData, setSharedFileData] = useState<SharedFileAccessType | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const [accessSharedFile, { loading: accessingFile, error: accessError }] = useMutation<
    AccessSharedFileResponse,
    { input: AccessSharedFileInput }
  >(ACCESS_SHARED_FILE_MUTATION);

  useEffect(() => {
    // If no password is required, try to access immediately
    handleAccessSharedFile();
  }, []);

  const handleAccessSharedFile = async (password?: string) => {
    try {
      const result = await accessSharedFile({
        variables: {
          input: {
            token: shareToken,
            master_password: password || '',
          },
        },
      });

      if (result.data?.accessSharedFile) {
        setSharedFileData(result.data.accessSharedFile);
        setAccessDialogOpen(false);
        onAccessSuccess?.();
      }
    } catch (err: any) {
      const errorMessage = getErrorMessage(err) || 'Failed to access shared file';

      // If password is required, show the dialog
      if (errorMessage.includes('password') || errorMessage.includes('authentication')) {
        setAccessDialogOpen(true);
      } else {
        onAccessError?.(errorMessage);
      }
    }
  };

  const handleDownload = async () => {
    if (!sharedFileData) return;

    setIsDownloading(true);
    setDownloadError(null);

    try {
      const { file, download_url } = sharedFileData;

      if (!file.encryption_key) {
        throw new Error('No encryption key available for this file');
      }

      // Fetch the encrypted file
      const response = await fetch(download_url, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to download file');
      }

      const encryptedDataWithNonce = new Uint8Array(await response.arrayBuffer());

      // Extract nonce and encrypted data
      const { nonce, encryptedData } = extractNonceAndData(encryptedDataWithNonce);

      // Convert base64 encryption key back to Uint8Array
      const encryptionKey = base64ToEncryptionKey(file.encryption_key);

      // Decrypt the file
      const decryptedData = decryptFile(encryptedData, nonce, encryptionKey);

      if (!decryptedData) {
        throw new Error('Failed to decrypt file - invalid key or corrupted data');
      }

      // Create download blob from decrypted data and trigger download
      const blob = createDownloadBlob(decryptedData, file.mime_type);
      downloadFile(blob, file.filename);

    } catch (err: any) {
      const errorMessage = getErrorMessage(err) || 'Download failed';
      setDownloadError(errorMessage);
    } finally {
      setIsDownloading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getFileTypeColor = (mimeType: string) => {
    if (mimeType.startsWith('image/')) return 'primary';
    if (mimeType.startsWith('video/')) return 'secondary';
    if (mimeType.startsWith('audio/')) return 'success';
    if (mimeType.includes('pdf')) return 'error';
    return 'default';
  };

  if (accessingFile && !sharedFileData) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
        <Typography>Accessing shared file...</Typography>
      </Box>
    );
  }

  if (accessError && !accessDialogOpen) {
    return (
      <Box p={3}>
        <Alert severity="error">
          {getErrorMessage(accessError) || 'Failed to access shared file'}
        </Alert>
      </Box>
    );
  }

  if (!sharedFileData) {
    return (
      <Box p={3}>
        <Typography>Loading shared file information...</Typography>
      </Box>
    );
  }

  const { file, share } = sharedFileData;
  const isExpired = share.expires_at && new Date(share.expires_at) < new Date();
  const isDownloadLimitReached = Boolean(share.max_downloads && share.download_count >= share.max_downloads);

  return (
    <Box p={3}>
      <Paper elevation={2} sx={{ p: 3, mb: 3 }}>
        <Typography variant="h5" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <FileIcon />
          Shared File Access
        </Typography>

        <Divider sx={{ my: 2 }} />

        <Box sx={{ mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            {file.filename}
          </Typography>

          <Box display="flex" gap={1} flexWrap="wrap" sx={{ mb: 2 }}>
            <Chip
              size="small"
              label={file.mime_type.split('/')[1]?.toUpperCase() || 'FILE'}
              color={getFileTypeColor(file.mime_type)}
              variant="outlined"
            />
            <Chip
              size="small"
              label={file.file ? formatFileSize(file.file.size_bytes) : 'Unknown size'}
              variant="outlined"
            />
          </Box>

          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            Shared by: {file.user?.email || 'Unknown user'}
          </Typography>

          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            Created: {formatDate(file.created_at)}
          </Typography>

          {share.expires_at && (
            <Typography
              variant="body2"
              color={isExpired ? 'error' : 'text.secondary'}
              sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
            >
              <AccessTimeIcon fontSize="small" />
              Expires: {formatDate(share.expires_at)}
              {isExpired && ' (Expired)'}
            </Typography>
          )}

          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Downloads: {share.download_count}
            {share.max_downloads && share.max_downloads !== -1 
              ? ` / ${share.max_downloads}` 
              : share.max_downloads === -1 
                ? " / Unlimited" 
                : ""
            }
            {isDownloadLimitReached && ' (Limit reached)'}
          </Typography>
        </Box>

        {downloadError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {downloadError}
          </Alert>
        )}

        <Box display="flex" gap={2}>
          <Button
            variant="contained"
            startIcon={<DownloadIcon />}
            onClick={handleDownload}
            disabled={isDownloading || isExpired || isDownloadLimitReached}
            fullWidth
          >
            {isDownloading ? 'Downloading...' : 'Download File'}
          </Button>
        </Box>

        {(isExpired || isDownloadLimitReached) && (
          <Alert severity="warning" sx={{ mt: 2 }}>
            {isExpired ? 'This share link has expired.' : 'Download limit has been reached.'}
          </Alert>
        )}
      </Paper>

      <AccessSharedFileDialog
        open={accessDialogOpen}
        onClose={() => setAccessDialogOpen(false)}
        onConfirm={handleAccessSharedFile}
        filename={file.filename}
        isLoading={accessingFile}
        error={accessError ? getErrorMessage(accessError) : undefined}
      />
    </Box>
  );
};