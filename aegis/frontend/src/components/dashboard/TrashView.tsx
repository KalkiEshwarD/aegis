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
  Grid,
  Card,
  CardContent,
  CardActions,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import {
  Restore as RestoreIcon,
  DeleteForever as DeleteForeverIcon,
  Search as SearchIcon,
  InsertDriveFile as FileIcon,
  Storage as StorageIcon,
  ViewList as ListViewIcon,
  ViewModule as TileViewIcon,
  Sort as SortIcon,
  ArrowUpward as ArrowUpIcon,
  ArrowDownward as ArrowDownIcon,
} from '@mui/icons-material';
import { useQuery, useMutation } from '@apollo/client';
import { GET_MY_TRASHED_FILES, RESTORE_FILE_MUTATION, PERMANENTLY_DELETE_FILE_MUTATION } from '../../apollo/trash';
import { formatFileSize } from '../../utils/fileUtils';
import { UserFile } from '../../types';

interface TrashViewProps {
  onFileRestored?: () => void;
  onFileDeleted?: () => void;
}

const TrashView: React.FC<TrashViewProps> = ({ onFileRestored, onFileDeleted }) => {
  const [viewMode, setViewMode] = useState<'list' | 'tile'>('list');
  const [sortBy, setSortBy] = useState<'name' | 'date' | 'size'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [sortAnchorEl, setSortAnchorEl] = useState<null | HTMLElement>(null);
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

  // Sort files based on current sort settings
  const sortedFiles = [...filteredFiles].sort((a, b) => {
    let comparison = 0;
    
    switch (sortBy) {
      case 'name':
        comparison = a.filename.localeCompare(b.filename);
        break;
      case 'date':
        comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        break;
      case 'size':
        const sizeA = a.file?.size_bytes || 0;
        const sizeB = b.file?.size_bytes || 0;
        comparison = sizeA - sizeB;
        break;
      default:
        comparison = 0;
    }
    
    return sortOrder === 'asc' ? comparison : -comparison;
  });

  const handleSortClick = (event: React.MouseEvent<HTMLElement>) => {
    setSortAnchorEl(event.currentTarget);
  };

  const handleSortClose = () => {
    setSortAnchorEl(null);
  };

  const handleSortChange = (newSortBy: 'name' | 'date' | 'size') => {
    if (sortBy === newSortBy) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(newSortBy);
      setSortOrder('asc');
    }
    handleSortClose();
  };

  return (
    <Box>
      {/* Header with view toggle */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6" sx={{ fontWeight: 600, color: '#1f2937' }}>
          Trash ({sortedFiles.length} files)
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <Tooltip title="Sort">
            <IconButton size="small" onClick={handleSortClick}>
              <SortIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <ToggleButtonGroup
            value={viewMode}
            exclusive
            onChange={(_, newMode) => newMode && setViewMode(newMode)}
            size="small"
          >
            <ToggleButton value="list">
              <ListViewIcon fontSize="small" />
            </ToggleButton>
            <ToggleButton value="tile">
              <TileViewIcon fontSize="small" />
            </ToggleButton>
          </ToggleButtonGroup>
        </Box>
      </Box>

      {/* Sort Menu */}
      <Menu
        anchorEl={sortAnchorEl}
        open={Boolean(sortAnchorEl)}
        onClose={handleSortClose}
      >
        <MenuItem onClick={() => handleSortChange('name')}>
          <ListItemIcon>
            {sortBy === 'name' && (sortOrder === 'asc' ? <ArrowUpIcon fontSize="small" /> : <ArrowDownIcon fontSize="small" />)}
          </ListItemIcon>
          <ListItemText>Name</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => handleSortChange('date')}>
          <ListItemIcon>
            {sortBy === 'date' && (sortOrder === 'asc' ? <ArrowUpIcon fontSize="small" /> : <ArrowDownIcon fontSize="small" />)}
          </ListItemIcon>
          <ListItemText>Date Deleted</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => handleSortChange('size')}>
          <ListItemIcon>
            {sortBy === 'size' && (sortOrder === 'asc' ? <ArrowUpIcon fontSize="small" /> : <ArrowDownIcon fontSize="small" />)}
          </ListItemIcon>
          <ListItemText>Size</ListItemText>
        </MenuItem>
      </Menu>

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

      {/* File Table or Grid */}
      {viewMode === 'list' ? (
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
              ) : sortedFiles.length === 0 ? (
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
                sortedFiles.map((file: UserFile) => (
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
      ) : (
        <Box>
          {loading ? (
            <Typography>Loading trashed files...</Typography>
          ) : sortedFiles.length === 0 ? (
            <Box sx={{ py: 4, textAlign: 'center' }}>
              <FileIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
              <Typography variant="h6" color="textSecondary">
                {searchTerm ? 'No files match your search' : 'Trash is empty'}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                {searchTerm ? 'Try a different search term' : 'Deleted files will appear here'}
              </Typography>
            </Box>
          ) : (
            <Grid container spacing={2}>
              {sortedFiles.map((file: UserFile) => (
                <Grid item xs={12} sm={6} md={4} lg={3} key={file.id}>
                  <Card sx={{ 
                    height: '100%', 
                    display: 'flex', 
                    flexDirection: 'column',
                    '&:hover': {
                      boxShadow: 6,
                      transform: 'translateY(-2px)',
                      transition: 'all 0.2s ease-in-out'
                    }
                  }}>
                    <CardContent sx={{ flexGrow: 1 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                        <FileIcon sx={{ color: 'action.active', mr: 1, fontSize: 16 }} />
                        <Typography variant="body2" sx={{ fontWeight: 500 }} noWrap>
                          {file.filename}
                        </Typography>
                      </Box>
                      <Typography variant="body2" color="#6b7280" sx={{ mb: 1 }}>
                        {file.file ? formatFileSize(file.file.size_bytes) : 'Unknown'}
                      </Typography>
                      <Chip
                        size="small"
                        label={file.mime_type.split('/')[1]?.toUpperCase() || 'FILE'}
                        color={getFileTypeColor(file.mime_type)}
                        variant="outlined"
                        sx={{ mb: 1 }}
                      />
                      <Typography variant="caption" color="#6b7280" display="block">
                        Deleted: {formatDate(file.created_at)}
                      </Typography>
                    </CardContent>
                    <CardActions>
                      <Tooltip title="Restore file">
                        <IconButton
                          size="small"
                          onClick={() => handleRestoreClick(file)}
                          sx={{ color: 'success.main' }}
                        >
                          <RestoreIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Permanently delete file">
                        <IconButton
                          size="small"
                          onClick={() => handleDeleteClick(file)}
                          sx={{ color: 'error.main' }}
                        >
                          <DeleteForeverIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </CardActions>
                  </Card>
                </Grid>
              ))}
            </Grid>
          )}
        </Box>
      )}

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

export default memo(TrashView);