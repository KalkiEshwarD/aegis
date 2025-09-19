import React, { useState, memo } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Chip,
  Typography,
  Box,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  InputAdornment,
} from '@mui/material';
import {
  Download as DownloadIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
  InsertDriveFile as FileIcon,
} from '@mui/icons-material';
import { useQuery, useMutation } from '@apollo/client';
import { GET_MY_FILES } from '../../apollo/files';
import { DELETE_FILE_MUTATION, DOWNLOAD_FILE_MUTATION } from '../../apollo/files';
import {
  decryptFile,
  base64ToEncryptionKey,
  createDownloadBlob,
  downloadFile,
  formatFileSize,
  extractNonceAndData,
} from '../../utils/crypto';
import { UserFile, FileFilterInput } from '../../types';
import { useAuth } from '../../contexts/AuthContext';

interface FileTableProps {
  folderId?: string | null;
  onFileDeleted?: () => void;
}

const FileTable: React.FC<FileTableProps> = ({ folderId, onFileDeleted }) => {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [fileToDelete, setFileToDelete] = useState<UserFile | null>(null);
  const [downloadingFile, setDownloadingFile] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FileFilterInput>({});

  const { token } = useAuth();

  const { data, loading, error: queryError, refetch } = useQuery(GET_MY_FILES, {
    variables: {
      filter: {
        ...filter,
        folder_id: folderId || undefined
      }
    },
    fetchPolicy: 'cache-and-network',
  });

  const [deleteFileMutation] = useMutation(DELETE_FILE_MUTATION);
  const [downloadFileMutation] = useMutation(DOWNLOAD_FILE_MUTATION);

  const handleDeleteClick = (file: UserFile) => {
    setFileToDelete(file);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!fileToDelete) return;

    try {
      await deleteFileMutation({
        variables: { id: fileToDelete.id },
      });

      setDeleteDialogOpen(false);
      setFileToDelete(null);

      // Refetch files or call callback
      refetch();
      if (onFileDeleted) {
        onFileDeleted();
      }
    } catch (err: any) {
      console.error('Delete error:', err);
      setError(err.graphQLErrors?.[0]?.message || err.message || 'Delete failed');
    }
  };

  const handleDownload = async (file: UserFile) => {
    setDownloadingFile(file.id);
    setError(null);

    try {
      // Validate that we have the encryption key
      if (!file.encryption_key) {
        throw new Error('No encryption key available for this file');
      }

      // Get download URL from server
      const result = await downloadFileMutation({
        variables: { id: file.id },
      });

      const downloadUrl = result.data.downloadFile;

      if (!downloadUrl) {
        throw new Error('No download URL received');
      }

      // Fetch the encrypted file with authentication headers
      const response = await fetch(downloadUrl, {
        headers: {
          'Authorization': token ? `Bearer ${token}` : '',
        },
        credentials: 'include', // Include cookies for authentication
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
      console.error('Download error:', err);
      setError(err.message || 'Download failed');
    } finally {
      setDownloadingFile(null);
    }
  };

  const handleFilterChange = (field: keyof FileFilterInput, value: string) => {
    setFilter(prev => ({
      ...prev,
      [field]: value || undefined,
    }));
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const getFileTypeColor = (mimeType: string) => {
    if (mimeType.startsWith('image/')) return 'primary';
    if (mimeType.startsWith('video/')) return 'secondary';
    if (mimeType.startsWith('audio/')) return 'success';
    if (mimeType.includes('pdf')) return 'error';
    return 'default';
  };

  if (queryError) {
    return (
      <Alert severity="error">
        Failed to load files: {queryError.message}
      </Alert>
    );
  }

  const files = data?.myFiles || [];

  return (
    <Box>
      {/* Search and Filter */}
      <Box sx={{ mb: 2 }}>
        <TextField
          fullWidth
          variant="outlined"
          placeholder="Search files by name..."
          value={filter.filename || ''}
          onChange={(e) => handleFilterChange('filename', e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
        />
      </Box>

      {/* File Table */}
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>File Name</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Size</TableCell>
              <TableCell>Uploaded</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} align="center">
                  <Typography>Loading files...</Typography>
                </TableCell>
              </TableRow>
            ) : files.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} align="center">
                  <Box display="flex" flexDirection="column" alignItems="center" py={4}>
                    <FileIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
                    <Typography variant="h6" color="textSecondary">
                      No files found
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      Upload some files to get started
                    </Typography>
                  </Box>
                </TableCell>
              </TableRow>
            ) : (
              files.map((file: UserFile) => (
                <TableRow key={file.id} hover>
                  <TableCell>
                    <Box display="flex" alignItems="center">
                      <FileIcon sx={{ mr: 1, color: 'action.active' }} />
                      <Typography variant="body2" noWrap sx={{ maxWidth: 200 }}>
                        {file.filename}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={file.mime_type.split('/')[1]?.toUpperCase() || 'FILE'}
                      color={getFileTypeColor(file.mime_type)}
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell>
                    {file.file ? formatFileSize(file.file.size_bytes) : 'Unknown'}
                  </TableCell>
                  <TableCell>
                    {formatDate(file.created_at)}
                  </TableCell>
                  <TableCell align="right">
                    <IconButton
                      size="small"
                      onClick={() => handleDownload(file)}
                      disabled={downloadingFile === file.id}
                      title="Download file"
                    >
                      <DownloadIcon />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => handleDeleteClick(file)}
                      title="Delete file"
                    >
                      <DeleteIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Error Display */}
      {error && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {error}
        </Alert>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Delete File</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete "{fileToDelete?.filename}"?
            This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleDeleteConfirm} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default memo(FileTable);