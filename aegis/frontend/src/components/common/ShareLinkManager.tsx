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
  const [emailsDialogOpen, setEmailsDialogOpen] = useState(false);
  const [selectedEmails, setSelectedEmails] = useState<string[]>([]);

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

  const handleCreateShare = async (password?: string, expiresAt?: Date, maxDownloads?: number, allowedEmails?: string[]) => {
    if (!userFileId) return;

    try {
      const result = await createFileShare({
        variables: {
          input: {
            user_file_id: userFileId,
            master_password: password || undefined,
            expires_at: expiresAt?.toISOString(),
            max_downloads: maxDownloads,
            allowed_emails: allowedEmails,
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
    }) + ' ' + new Date(dateString).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleCopyPassword = async (password: string, shareId: string) => {
    try {
      await navigator.clipboard.writeText(password);
      setCopySuccess(shareId);
      setTimeout(() => setCopySuccess(null), 2000);
    } catch (err) {
      console.error('Failed to copy password:', err);
    }
  };

  const handleShowEmails = (emails: string[]) => {
    setSelectedEmails(emails);
    setEmailsDialogOpen(true);
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
              <TableCell>Shared With</TableCell>
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
                <TableCell colSpan={6} align="center">
                  <Typography>Loading share links...</Typography>
                </TableCell>
              </TableRow>
            ) : shares.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} align="center">
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
                const allowedEmails = share.allowed_emails || [];
                const isEmailShare = allowedEmails.length > 0;
                
                return (
                  <TableRow key={share.id} hover>
                    <TableCell>
                      {isEmailShare ? (
                        <Button
                          variant="text"
                          size="small"
                          onClick={() => handleShowEmails(allowedEmails)}
                          sx={{ textTransform: 'none' }}
                        >
                          <Typography variant="body2" fontWeight="medium">
                            Direct Share ({allowedEmails.length})
                          </Typography>
                        </Button>
                      ) : (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <LinkIcon fontSize="small" />
                          <Typography variant="body2" color="text.secondary">
                            Public Link
                          </Typography>
                        </Box>
                      )}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ whiteSpace: 'nowrap' }}>
                        {formatDate(share.created_at)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {share.expires_at ? (
                        <Typography variant="body2" sx={{ whiteSpace: 'nowrap' }}>
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
                        {share.max_downloads && share.max_downloads > 0 ? ` / ${share.max_downloads}` : ' / Unlimited'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {share.plain_text_password ? (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.875rem' }}>
                            ••••••••
                          </Typography>
                          <IconButton
                            size="small"
                            onClick={() => handleCopyPassword(share.plain_text_password!, share.id)}
                            title="Copy password"
                          >
                            <CopyIcon />
                          </IconButton>
                        </Box>
                      ) : (
                        <Typography variant="body2" color="text.secondary">
                          No password
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell align="right">
                      <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'flex-end' }}>
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
                      </Box>
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

      <Dialog open={emailsDialogOpen} onClose={() => setEmailsDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Shared With</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, pt: 1 }}>
            {selectedEmails.map((email, idx) => (
              <Chip 
                key={idx}
                label={email} 
                variant="outlined"
                sx={{ width: 'fit-content' }}
              />
            ))}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEmailsDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};