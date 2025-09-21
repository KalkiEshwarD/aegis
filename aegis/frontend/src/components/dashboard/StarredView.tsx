import React, { memo, useState } from 'react';
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Chip,
  Button,
  Tooltip,
  Alert,
  CircularProgress,
  Grid,
  Card,
  CardContent,
  CardActions,
  ToggleButton,
  ToggleButtonGroup,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import {
  Star as StarIcon,
  StarBorder as StarBorderIcon,
  Download as DownloadIcon,
  Delete as DeleteIcon,
  ViewList as ListViewIcon,
  ViewModule as TileViewIcon,
  Sort as SortIcon,
  ArrowUpward as ArrowUpIcon,
  ArrowDownward as ArrowDownIcon,
} from '@mui/icons-material';
import { useQuery, useMutation } from '@apollo/client';
import { GET_STARRED_FILES_QUERY, STAR_FILE_MUTATION, UNSTAR_FILE_MUTATION, DELETE_FILE_MUTATION } from '../../apollo/queries';
import { formatFileSize, formatDateTime } from '../../shared/utils';
import { UserFile } from '../../types';

interface StarredViewProps {
  onFileDeleted?: () => void;
}

interface StarredFilesData {
  myStarredFiles: UserFile[];
}

const StarredView: React.FC<StarredViewProps> = ({ onFileDeleted }) => {
  const [viewMode, setViewMode] = useState<'list' | 'tile'>('list');
  const [sortBy, setSortBy] = useState<'name' | 'date' | 'size'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [sortAnchorEl, setSortAnchorEl] = useState<null | HTMLElement>(null);
  
  const { data, loading, error, refetch } = useQuery<StarredFilesData>(GET_STARRED_FILES_QUERY, {
    fetchPolicy: 'cache-and-network',
  });

  const [unstarFile] = useMutation(UNSTAR_FILE_MUTATION);
  const [deleteFile] = useMutation(DELETE_FILE_MUTATION);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mb: 2 }}>
        Failed to load starred files: {error.message}
      </Alert>
    );
  }

  const starredFiles = data?.myStarredFiles || [];

  // Sort files based on current sort settings
  const sortedFiles = [...starredFiles].sort((a, b) => {
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

  const handleUnstar = async (fileId: string) => {
    try {
      await unstarFile({
        variables: { id: fileId },
      });
      refetch();
    } catch (error) {
      console.error('Error unstarring file:', error);
    }
  };

  const handleDelete = async (fileId: string) => {
    try {
      await deleteFile({
        variables: { id: fileId },
      });
      refetch();
      if (onFileDeleted) {
        onFileDeleted();
      }
    } catch (error) {
      console.error('Error deleting file:', error);
    }
  };

  const handleDownload = async (fileId: string) => {
    // Implementation for download
    console.log('Download file:', fileId);
  };

  if (starredFiles.length === 0) {
    return (
      <Box sx={{ 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center', 
        py: 8, 
        color: '#6b7280' 
      }}>
        <StarBorderIcon sx={{ fontSize: 48, mb: 2, color: '#d1d5db' }} />
        <Typography variant="h6" sx={{ mb: 1 }}>
          No starred files
        </Typography>
        <Typography variant="body2">
          Star files to quickly access them here
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 600, color: '#1f2937' }}>
            Starred Files ({sortedFiles.length})
          </Typography>
          <Typography variant="body2" color="#6b7280">
            Files you've marked as favorites for quick access
          </Typography>
        </Box>
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
          <ListItemText>Date Added</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => handleSortChange('size')}>
          <ListItemIcon>
            {sortBy === 'size' && (sortOrder === 'asc' ? <ArrowUpIcon fontSize="small" /> : <ArrowDownIcon fontSize="small" />)}
          </ListItemIcon>
          <ListItemText>Size</ListItemText>
        </MenuItem>
      </Menu>

      {viewMode === 'list' ? (
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Size</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Date Added</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sortedFiles.map((file) => (
                <TableRow key={file.id} hover>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <StarIcon sx={{ color: '#fbbf24', mr: 1, fontSize: 16 }} />
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {file.filename}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="#6b7280">
                      {formatFileSize(file.file?.size_bytes || 0)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={file.mime_type?.split('/')[1]?.toUpperCase() || 'FILE'}
                      size="small"
                      variant="outlined"
                      sx={{
                        borderColor: '#e5e7eb',
                        color: '#6b7280',
                        fontWeight: 500,
                        fontSize: '0.75rem',
                      }}
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="#6b7280">
                      {formatDateTime(file.created_at)}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Tooltip title="Download">
                        <IconButton
                          size="small"
                          onClick={() => handleDownload(file.id)}
                          sx={{ color: '#6b7280' }}
                        >
                          <DownloadIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Remove from starred">
                        <IconButton
                          size="small"
                          onClick={() => handleUnstar(file.id)}
                          sx={{ color: '#fbbf24' }}
                        >
                          <StarIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete">
                        <IconButton
                          size="small"
                          onClick={() => handleDelete(file.id)}
                          sx={{ color: '#ef4444' }}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      ) : (
        <Grid container spacing={2}>
          {sortedFiles.map((file) => (
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
                    <StarIcon sx={{ color: '#fbbf24', mr: 1, fontSize: 16 }} />
                    <Typography variant="body2" sx={{ fontWeight: 500 }} noWrap>
                      {file.filename}
                    </Typography>
                  </Box>
                  <Typography variant="body2" color="#6b7280" sx={{ mb: 1 }}>
                    {formatFileSize(file.file?.size_bytes || 0)}
                  </Typography>
                  <Chip
                    label={file.mime_type?.split('/')[1]?.toUpperCase() || 'FILE'}
                    size="small"
                    variant="outlined"
                    sx={{
                      borderColor: '#e5e7eb',
                      color: '#6b7280',
                      fontWeight: 500,
                      fontSize: '0.75rem',
                      mb: 1
                    }}
                  />
                  <Typography variant="caption" color="#6b7280" display="block">
                    {formatDateTime(file.created_at)}
                  </Typography>
                </CardContent>
                <CardActions>
                  <Tooltip title="Download">
                    <IconButton
                      size="small"
                      onClick={() => handleDownload(file.id)}
                      sx={{ color: '#6b7280' }}
                    >
                      <DownloadIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Remove from starred">
                    <IconButton
                      size="small"
                      onClick={() => handleUnstar(file.id)}
                      sx={{ color: '#fbbf24' }}
                    >
                      <StarIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Delete">
                    <IconButton
                      size="small"
                      onClick={() => handleDelete(file.id)}
                      sx={{ color: '#ef4444' }}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}
    </Box>
  );
};

export default memo(StarredView);