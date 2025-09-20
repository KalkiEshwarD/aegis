import React, { memo } from 'react';
import {
  Box,
  Typography,
  Paper,
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
} from '@mui/material';
import {
  Share as ShareIcon,
  Delete as DeleteIcon,
  Download as DownloadIcon,
  Link as LinkIcon,
  Visibility as VisibilityIcon,
  AccessTime as AccessTimeIcon,
  GetApp as GetAppIcon,
} from '@mui/icons-material';
import { useQuery, useMutation } from '@apollo/client';
import { GET_FILE_SHARES, DELETE_FILE_SHARE_MUTATION } from '../../apollo/queries';
import { formatFileSize, formatDateTime } from '../../shared/utils';
import { FileShare } from '../../types';

interface SharedViewProps {
  onShareDeleted?: () => void;
}

interface FileSharesData {
  myShares: FileShare[];
}

const SharedView: React.FC<SharedViewProps> = ({ onShareDeleted }) => {
  const { data, loading, error, refetch } = useQuery<FileSharesData>(GET_FILE_SHARES, {
    fetchPolicy: 'cache-and-network',
  });

  const [deleteFileShare] = useMutation(DELETE_FILE_SHARE_MUTATION, {
    onCompleted: () => {
      refetch();
      onShareDeleted?.();
    },
  });

  const handleDeleteShare = async (shareId: string) => {
    if (window.confirm('Are you sure you want to delete this shared link? This action cannot be undone.')) {
      try {
        await deleteFileShare({
          variables: { id: shareId },
        });
      } catch (err) {
        console.error('Failed to delete share:', err);
      }
    }
  };

  const handleCopyLink = (shareToken: string) => {
    const shareUrl = `${window.location.origin}/share/${shareToken}`;
    navigator.clipboard.writeText(shareUrl).then(() => {
      // You could add a toast notification here
      console.log('Share link copied to clipboard');
    });
  };

  const formatDate = (dateString: string) => {
    try {
      return formatDateTime(dateString);
    } catch {
      return 'Invalid date';
    }
  };

  const getShareStatus = (share: FileShare) => {
    const now = new Date();
    const expiresAt = share.expires_at ? new Date(share.expires_at) : null;
    
    if (expiresAt && expiresAt < now) {
      return { label: 'Expired', color: 'error' as const };
    }
    
    if (share.max_downloads && share.download_count >= share.max_downloads) {
      return { label: 'Limit Reached', color: 'warning' as const };
    }
    
    return { label: 'Active', color: 'success' as const };
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 8 }}>
        <CircularProgress />
        <Typography sx={{ ml: 2 }}>Loading shared files...</Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mt: 2 }}>
        Failed to load shared files: {error.message}
      </Alert>
    );
  }

  const shares = data?.myShares || [];

  if (shares.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 8 }}>
        <ShareIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
        <Typography variant="h6" color="text.secondary" gutterBottom>
          No Shared Files
        </Typography>
        <Typography variant="body2" color="text.secondary">
          You haven't shared any files yet. Share files to see them here.
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h6" sx={{ fontWeight: 600, color: '#1f2937', mb: 1 }}>
          Shared Files
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Manage your shared files and view sharing statistics.
        </Typography>
      </Box>

      <TableContainer component={Paper} sx={{ boxShadow: 'none', border: '1px solid #e5e7eb' }}>
        <Table>
          <TableHead>
            <TableRow sx={{ backgroundColor: '#f9fafb' }}>
              <TableCell sx={{ fontWeight: 600 }}>File Name</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Size</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Downloads</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Created</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Expires</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {shares.map((share) => {
              const status = getShareStatus(share);
              return (
                <TableRow key={share.id} hover>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <GetAppIcon sx={{ mr: 1, color: 'text.secondary' }} />
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {share.user_file?.filename || 'Unknown file'}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary">
                      {formatFileSize(share.user_file?.file?.size_bytes || 0)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={status.label}
                      color={status.color}
                      size="small"
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {share.download_count}
                      {share.max_downloads && ` / ${share.max_downloads}`}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary">
                      {formatDate(share.created_at)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary">
                      {share.expires_at ? formatDate(share.expires_at) : 'Never'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Tooltip title="Copy share link">
                        <IconButton
                          size="small"
                          onClick={() => handleCopyLink(share.share_token)}
                          disabled={status.label === 'Expired' || status.label === 'Limit Reached'}
                        >
                          <LinkIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="View details">
                        <IconButton
                          size="small"
                          disabled={status.label === 'Expired' || status.label === 'Limit Reached'}
                        >
                          <VisibilityIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete share">
                        <IconButton
                          size="small"
                          onClick={() => handleDeleteShare(share.id)}
                          color="error"
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>

      <Box sx={{ mt: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="body2" color="text.secondary">
          {shares.length} shared file{shares.length !== 1 ? 's' : ''}
        </Typography>
        <Button variant="outlined" onClick={() => refetch()} size="small">
          Refresh
        </Button>
      </Box>
    </Box>
  );
};

export default memo(SharedView);