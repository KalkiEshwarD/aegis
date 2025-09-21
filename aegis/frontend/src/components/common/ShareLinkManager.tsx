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
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
} from '@mui/icons-material';
import { useQuery, useMutation } from '@apollo/client';
import { GET_FILE_SHARES, DELETE_FILE_SHARE_MUTATION, CREATE_FILE_SHARE_MUTATION } from '../../apollo/queries';
import { FileShare, UserFile, CreateFileShareInput } from '../../types';
import { formatFileSize } from '../../shared/utils';
import { ConfirmationDialog, SharePasswordDialog } from '../../shared/components';

interface ShareLinkManagerProps {
  userFileId?: string;
  filename?: string;
  open?: boolean;
  onClose?: () => void;
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
  filename,
  open = false,
  onClose,
  onShareDeleted,
}) => {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [shareToDelete, setShareToDelete] = useState<FileShare | null>(null);
  const [copySuccess, setCopySuccess] = useState<string | null>(null);
  const [createShareDialogOpen, setCreateShareDialogOpen] = useState(false);
  const [visiblePasswords, setVisiblePasswords] = useState<Set<string>>(new Set());

  const { data, loading, error, refetch } = useQuery<
    GetFileSharesResponse,
    {}
  >(GET_FILE_SHARES);

  const [deleteFileShare, { loading: deletingShare }] = useMutation<
    DeleteFileShareResponse,
    { share_id: string }
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
        variables: { share_id: shareToDelete.id },
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

  const handleCreateShare = async (password: string, expiresAt?: Date, maxDownloads?: number) => {
    if (!userFileId) return;

    try {
      const result = await createFileShare({
        variables: {
          input: {
            user_file_id: userFileId,
            master_password: password,
            expires_at: expiresAt?.toISOString(),
            max_downloads: maxDownloads,
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
  };

  const handleCopyLink = async (share: FileShare) => {
    const shareUrl = `${window.location.origin}/share/${share.share_token}`;
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


  const togglePasswordVisibility = (shareId: string) => {
    setVisiblePasswords(prev => {
      const newSet = new Set(prev);
      if (newSet.has(shareId)) {
        newSet.delete(shareId);
      } else {
        newSet.add(shareId);
      }
      return newSet;
    });
  };

  const shares = (data?.myShares || []).filter((share: FileShare) =>
    !userFileId || share.user_file_id === userFileId
  );

  // Get the filename from the prop or from the first share (all shares should be for the same file)
  const fileName = filename || (shares.length > 0 ? shares[0].user_file?.filename : 'File');

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <ShareIcon />
          {fileName}
        </Box>
      </DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
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
                <TableCell colSpan={5} align="center">
                  <Typography>Loading share links...</Typography>
                </TableCell>
              </TableRow>
            ) : shares.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} align="center">
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
                return (
                  <TableRow key={share.id} hover>
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
                      {share.plain_text_password ? (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.875rem' }}>
                            {visiblePasswords.has(share.id) ? share.plain_text_password : '••••••••'}
                          </Typography>
                          <IconButton
                            size="small"
                            onClick={() => togglePasswordVisibility(share.id)}
                            title={visiblePasswords.has(share.id) ? 'Hide password' : 'Show password'}
                          >
                            {visiblePasswords.has(share.id) ? <VisibilityOffIcon /> : <VisibilityIcon />}
                          </IconButton>
                        </Box>
                      ) : (
                        <Typography variant="body2" color="text.secondary">
                          No password
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
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};