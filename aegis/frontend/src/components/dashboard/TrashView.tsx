import React, { useState } from 'react';
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
  Restore as RestoreIcon,
  DeleteForever as DeleteForeverIcon,
  Search as SearchIcon,
  InsertDriveFile as FileIcon,
} from '@mui/icons-material';
import { useQuery, useMutation } from '@apollo/client';
import { GET_MY_TRASHED_FILES, RESTORE_FILE_MUTATION, PERMANENTLY_DELETE_FILE_MUTATION } from '../../apollo/queries';
import { formatFileSize } from '../../utils/crypto';
import { UserFile } from '../../types';

interface TrashViewProps {
  onFileRestored?: () => void;
  onFileDeleted?: () => void;
}

const TrashView: React.FC<TrashViewProps> = ({ onFileRestored, onFileDeleted }) => {
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [fileToRestore, setFileToRestore] = useState<UserFile | null>(null);
  const [fileToDelete, setFileToDelete] = useState<UserFile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const { data, loading, error: queryError, refetch } = useQuery(GET_MY_TRASHED_FILES, {
    fetchPolicy: 'cache-and-network',
  });

  const [restoreFileMutation] = useMutation(RESTORE_FILE_MUTATION);
  const [permanentlyDeleteFileMutation] = useMutation(PERMANENTLY_DELETE_FILE_MUTATION);

  const handleRestoreClick = (file: UserFile) => {
    setFileToRestore(file);
    setRestoreDialogOpen(true);
  };

  const handleDeleteClick = (file: UserFile) => {
    setFileToDelete(file);
    setDeleteDialogOpen(true);
  };

  const handleRestoreConfirm = async () => {
    if (!fileToRestore) return;

    try {
      await restoreFileMutation({
        variables: { fileID: fileToRestore.id },
      });

      setRestoreDialogOpen(false);
      setFileToRestore(null);

      // Refetch files or call callback
      refetch();
      if (onFileRestored) {
        onFileRestored();
      }
    } catch (err: any) {
      console.error('Restore error:', err);
      setError(err.graphQLErrors?.[0]?.message || err.message || 'Restore failed');
    }
  };

  const handleDeleteConfirm = async () => {
    if (!fileToDelete) return;

    try {
      await permanentlyDeleteFileMutation({
        variables: { fileID: fileToDelete.id },
      });

      setDeleteDialogOpen(false);
      setFileToDelete(null);

      // Refetch files or call callback
      refetch();
      if (onFileDeleted) {
        onFileDeleted();
      }
    } catch (err: any) {
      console.error('Permanent delete error:', err);
      setError(err.graphQLErrors?.[0]?.message || err.message || 'Permanent delete failed');
    }
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
        Failed to load trashed files: {queryError.message}
      </Alert>
    );
  }

  const files = data?.myTrashedFiles || [];
  const filteredFiles = files.filter((file: UserFile) =>
    file.filename.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Box>
      {/* Search */}
      <Box sx={{ mb: 2 }}>
        <TextField
          fullWidth
          variant="outlined"
          placeholder="Search trashed files by name..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
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
              <TableCell>Deleted</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} align="center">
                  <Typography>Loading trashed files...</Typography>
                </TableCell>
              </TableRow>
            ) : filteredFiles.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} align="center">
                  <Box display="flex" flexDirection="column" alignItems="center" py={4}>
                    <FileIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
                    <Typography variant="h6" color="textSecondary">
                      {searchTerm ? 'No files match your search' : 'Trash is empty'}
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      {searchTerm ? 'Try a different search term' : 'Deleted files will appear here'}
                    </Typography>
                  </Box>
                </TableCell>
              </TableRow>
            ) : (
              filteredFiles.map((file: UserFile) => (
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
                      onClick={() => handleRestoreClick(file)}
                      title="Restore file"
                      sx={{ color: 'success.main' }}
                    >
                      <RestoreIcon />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => handleDeleteClick(file)}
                      title="Permanently delete file"
                      sx={{ color: 'error.main' }}
                    >
                      <DeleteForeverIcon />
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

      {/* Restore Confirmation Dialog */}
      <Dialog open={restoreDialogOpen} onClose={() => setRestoreDialogOpen(false)}>
        <DialogTitle>Restore File</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to restore "{fileToRestore?.filename}"?
            The file will be moved back to your main files.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRestoreDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleRestoreConfirm} color="success" variant="contained">
            Restore
          </Button>
        </DialogActions>
      </Dialog>

      {/* Permanent Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Permanently Delete File</DialogTitle>
        <DialogContent>
          <Typography sx={{ mb: 2 }}>
            Are you sure you want to permanently delete "{fileToDelete?.filename}"?
          </Typography>
          <Alert severity="warning">
            This action cannot be undone. The file will be completely removed from the system.
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleDeleteConfirm} color="error" variant="contained">
            Delete Permanently
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default TrashView;