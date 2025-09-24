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
  Button,
  TextField,
  InputAdornment,
} from '@mui/material';
import {
  Download as DownloadIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
  InsertDriveFile as FileIcon,
  Share as ShareIcon,
} from '@mui/icons-material';
import { GET_MY_FILES } from '../../apollo/files';
import { formatFileSize } from '../../shared/utils';
import { DeleteConfirmationDialog, SharePasswordDialog } from '../../shared/components';
import { UserFile, FileFilterInput, CreateFileShareInput } from '../../types';
import { useFileOperations } from '../../hooks/useFileOperations';
import withErrorBoundary from '../hocs/withErrorBoundary';
import withLoading from '../hocs/withLoading';
import withDataFetching from '../hocs/withDataFetching';

interface FileTableProps {
  folderId?: string | null;
  onFileDeleted?: () => void;
}

interface FileTableWithDataProps extends FileTableProps {
  data: any;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

const FileTableBase: React.FC<FileTableWithDataProps> = ({
  folderId,
  onFileDeleted,
  data,
  loading,
  error,
  refetch
}) => {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [fileToDelete, setFileToDelete] = useState<UserFile | null>(null);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [fileToShare, setFileToShare] = useState<UserFile | null>(null);
  const [filter, setFilter] = useState<FileFilterInput>({});

  const { downloadingFile, downloadFile, deleteFile, createShare } = useFileOperations();

  const handleDeleteClick = (file: UserFile) => {
    setFileToDelete(file);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!fileToDelete) return;

    const success = await deleteFile(fileToDelete);
    if (success) {
      setDeleteDialogOpen(false);
      setFileToDelete(null);

      // Refetch files or call callback
      if (refetch) refetch();
      if (onFileDeleted) {
        onFileDeleted();
      }
    }
    // Error handling is done by the hook
  };

  const handleDownload = async (file: UserFile) => {
    await downloadFile(file);
  };

  const handleShareClick = (file: UserFile) => {
    setFileToShare(file);
    setShareDialogOpen(true);
  };

  const handleShareConfirm = async (password: string) => {
    if (!fileToShare) return;

    const shareInput: CreateFileShareInput = {
      user_file_id: fileToShare.id,
      master_password: password,
    };

    const result = await createShare(shareInput);
    if (result) {
      // Share created successfully
      console.log('Share created:', result);
      // TODO: Show success message or copy link to clipboard
    }

    setShareDialogOpen(false);
    setFileToShare(null);
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
                      onClick={() => handleShareClick(file)}
                      title="Share file"
                    >
                      <ShareIcon />
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
      <DeleteConfirmationDialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        onConfirm={handleDeleteConfirm}
        itemName={fileToDelete?.filename || ''}
        itemType="file"
      />

      {/* Share Password Dialog */}
      <SharePasswordDialog
        open={shareDialogOpen}
        onClose={() => setShareDialogOpen(false)}
        onConfirm={handleShareConfirm}
        title="Create Share Link"
        message={`Create a password-protected share link for "${fileToShare?.filename || 'this file'}"`}
      />
    </Box>
  );
};

// Create enhanced component with HOCs
const FileTableWithDataFetching = withDataFetching(FileTableBase, {
  query: GET_MY_FILES,
  variables: (props: FileTableProps) => ({
    filter: {
      folder_id: props.folderId || undefined
    }
  }),
  loadingMessage: 'Loading files...',
  errorMessage: 'Failed to load files'
});

const FileTableWithLoading = withLoading(FileTableWithDataFetching, {
  loadingMessage: 'Loading files...',
  errorMessage: 'Failed to load files'
});

const FileTableWithErrorBoundary = withErrorBoundary(FileTableWithLoading);

export default memo(FileTableWithErrorBoundary);