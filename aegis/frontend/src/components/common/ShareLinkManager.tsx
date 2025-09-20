import React, { useState } from 'react';
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
  Alert,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
} from '@mui/material';
import {
  Delete as DeleteIcon,
  Share as ShareIcon,
  Link as LinkIcon,
  AccessTime as AccessTimeIcon,
  GetApp as GetAppIcon,
  ContentCopy as CopyIcon,
  Add as AddIcon,
} from '@mui/icons-material';
import { useQuery, useMutation } from '@apollo/client';
import { GET_FILE_SHARES, DELETE_FILE_SHARE_MUTATION, CREATE_FILE_SHARE_MUTATION } from '../../apollo/queries';
import { FileShare, UserFile, CreateFileShareInput } from '../../types';
import { formatFileSize } from '../../shared/utils';
import { ConfirmationDialog, SharePasswordDialog } from '../../shared/components';

interface ShareLinkManagerProps {
  userFileId?: string;
  onShareDeleted?: () => void;
}

interface GetFileSharesResponse {
  myShares: FileShare[];
}

interface DeleteFileShareResponse {
  deleteFileShare: boolean;
}

export const ShareLinkManager: React.FC<ShareLinkManagerProps> = ({
  userFileId,
  onShareDeleted,
}) => {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [shareToDelete, setShareToDelete] = useState<FileShare | null>(null);
  const [copySuccess, setCopySuccess] = useState<string | null>(null);
  const [createShareDialogOpen, setCreateShareDialogOpen] = useState(false);

  const { data, loading, error, refetch } = useQuery<
    GetFileSharesResponse,
    {}
  >(GET_FILE_SHARES);

  const [deleteFileShare, { loading: deletingShare }] = useMutation<
    DeleteFileShareResponse,
    { id: string }
  >(DELETE_FILE_SHARE_MUTATION);

  const [createFileShare, { loading: creatingShare }] = useMutation<
    any,
    { input: CreateFileShareInput }
  >(CREATE_FILE_SHARE_MUTATION);

  const handleDeleteClick = (share: FileShare) => {
    setShareToDelete(share);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!shareToDelete) return;

    try {
      await deleteFileShare({
        variables: { id: shareToDelete.id },
      });

      // Refresh the share links
      refetch();
      
      // Notify parent component if callback provided
      if (onShareDeleted) {
        onShareDeleted();
      }
    } catch (err) {
      console.error('Failed to delete share:', err);
    } finally {
      setDeleteDialogOpen(false);
      setShareToDelete(null);
    }
  };

  const handleCreateShare = async (password: string) => {
    if (!userFileId) return;

    try {
      const result = await createFileShare({
        variables: {
          input: {
            user_file_id: userFileId,
            master_password: password,
          }
        }
      });

      if (result.data?.createFileShare) {
        // Refresh the share links
        refetch();
        setCopySuccess('Share link created successfully!');
        setTimeout(() => setCopySuccess(null), 3000);
      }
    } catch (err) {
      console.error('Failed to create share:', err);
    } finally {
      setCreateShareDialogOpen(false);
    }
  };  const handleCopyLink = async (share: FileShare) => {
    const shareUrl = `${window.location.origin}/shared/${share.share_token}`;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopySuccess(share.id);
      setTimeout(() => setCopySuccess(null), 2000);
    } catch (err) {
      console.error('Failed to copy link:', err);
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

  const getShareStatus = (share: FileShare) => {
    const now = new Date();
    const expiresAt = share.expires_at ? new Date(share.expires_at) : null;
    const isExpired = expiresAt && expiresAt < now;
    const isLimitReached = share.max_downloads && share.download_count >= share.max_downloads;

    if (isExpired) return { label: 'Expired', color: 'error' as const };
    if (isLimitReached) return { label: 'Limit Reached', color: 'warning' as const };
    return { label: 'Active', color: 'success' as const };
  };

  const shares = (data?.myShares || []).filter((share: FileShare) => 
    !userFileId || share.user_file_id === userFileId
  );

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <ShareIcon />
          Share Links
        </Typography>
        {userFileId && (
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setCreateShareDialogOpen(true)}
            size="small"
          >
            Create Share
          </Button>
        )}
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          Failed to load share links
        </Alert>
      )}

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>File</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Created</TableCell>
              <TableCell>Expires</TableCell>
              <TableCell>Downloads</TableCell>
              <TableCell>Password</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} align="center">
                  <Typography>Loading share links...</Typography>
                </TableCell>
              </TableRow>
            ) : shares.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} align="center">
                  <Box display="flex" flexDirection="column" alignItems="center" py={4}>
                    <ShareIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
                    <Typography variant="h6" color="textSecondary">
                      No share links
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      Create share links to allow others to access your files
                    </Typography>
                  </Box>
                </TableCell>
              </TableRow>
            ) : (
              shares.map((share) => {
                const status = getShareStatus(share);
                return (
                  <TableRow key={share.id} hover>
                    <TableCell>
                      <Box>
                        <Typography variant="body2" noWrap sx={{ maxWidth: 200 }}>
                          {share.user_file?.filename || 'Unknown file'}
                        </Typography>
                        {share.user_file?.file && (
                          <Typography variant="caption" color="text.secondary">
                            {formatFileSize(share.user_file.file.size_bytes)}
                          </Typography>
                        )}
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={status.label}
                        color={status.color}
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {formatDate(share.created_at)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {share.expires_at ? (
                        <Typography variant="body2">
                          {formatDate(share.expires_at)}
                        </Typography>
                      ) : (
                        <Typography variant="body2" color="text.secondary">
                          Never
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {share.download_count}
                        {share.max_downloads && ` / ${share.max_downloads}`}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {share.encrypted_key ? (
                        <Chip
                          size="small"
                          icon={<ShareIcon />}
                          label="Protected"
                          color="primary"
                          variant="outlined"
                        />
                      ) : (
                        <Typography variant="body2" color="text.secondary">
                          No
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell align="right">
                      <IconButton
                        size="small"
                        onClick={() => handleCopyLink(share)}
                        title="Copy share link"
                      >
                        <CopyIcon />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={() => handleDeleteClick(share)}
                        title="Delete share"
                      >
                        <DeleteIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {copySuccess && (
        <Alert severity="success" sx={{ mt: 2 }}>
          Share link copied to clipboard!
        </Alert>
      )}

      <ConfirmationDialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        onConfirm={handleDeleteConfirm}
        title="Delete Share Link"
        message={`Are you sure you want to delete this share link? Recipients will no longer be able to access the file.`}
        confirmText="Delete Share"
        confirmColor="error"
        isLoading={deletingShare}
        icon={<DeleteIcon />}
      />

      <SharePasswordDialog
        open={createShareDialogOpen}
        onClose={() => setCreateShareDialogOpen(false)}
        onConfirm={handleCreateShare}
        title="Create Share Link"
        message="Create a password-protected share link for this file"
        isLoading={creatingShare}
      />
    </Box>
  );
};