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
  Tabs,
  Tab,
  Container,
  Grid,
  Card,
  CardContent,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
} from '@mui/material';
import {
  Share as ShareIcon,
  Delete as DeleteIcon,
  Download as DownloadIcon,
  Link as LinkIcon,
  Person as PersonIcon,
  Edit as EditIcon,
} from '@mui/icons-material';
import { useQuery, useMutation } from '@apollo/client';
import { GET_FILE_SHARES, DELETE_FILE_SHARE_MUTATION, GET_SHARED_WITH_ME_QUERY, UPDATE_FILE_SHARE_MUTATION } from '../../apollo/queries';
import { formatFileSize, formatDateTime } from '../../shared/utils';
import { FileShare, SharedWithMeFile, UpdateFileShareInput } from '../../types';
import { ShareLinkManager } from '../common/ShareLinkManager';

interface SharedViewProps {
  onShareDeleted?: () => void;
}

interface FileSharesData {
  myShares: FileShare[];
}

interface SharedWithMeData {
  sharedWithMe: SharedWithMeFile[];
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`shared-tabpanel-${index}`}
      aria-labelledby={`shared-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ p: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

function a11yProps(index: number) {
  return {
    id: `shared-tab-${index}`,
    'aria-controls': `shared-tabpanel-${index}`,
  };
}

const SharedView: React.FC<SharedViewProps> = ({ onShareDeleted }) => {
  const [tabValue, setTabValue] = useState(0);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingShare, setEditingShare] = useState<FileShare | null>(null);
  const [shareManagerOpen, setShareManagerOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<any>(null);
  const [editForm, setEditForm] = useState({
    max_downloads: '',
    expires_at: '',
  });

  const { data: mySharesData, loading: mySharesLoading, error: mySharesError, refetch: refetchMyShares } = useQuery<FileSharesData>(GET_FILE_SHARES, {
    fetchPolicy: 'cache-and-network',
  });

  const { data: sharedWithMeData, loading: sharedWithMeLoading, error: sharedWithMeError } = useQuery<SharedWithMeData>(GET_SHARED_WITH_ME_QUERY, {
    fetchPolicy: 'cache-and-network',
  });

  const [deleteFileShare] = useMutation(DELETE_FILE_SHARE_MUTATION, {
    onCompleted: () => {
      refetchMyShares();
      onShareDeleted?.();
    },
  });

  const [updateFileShare] = useMutation(UPDATE_FILE_SHARE_MUTATION, {
    onCompleted: () => {
      refetchMyShares();
      setEditDialogOpen(false);
      setEditingShare(null);
    },
  });

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const handleDeleteShare = async (shareId: string) => {
    if (window.confirm('Are you sure you want to delete this shared link? This action cannot be undone.')) {
      try {
        await deleteFileShare({
          variables: { share_id: shareId },
        });
      } catch (err) {
        console.error('Failed to delete share:', err);
      }
    }
  };

  const handleCopyLink = (shareToken: string) => {
    const shareUrl = `${window.location.origin}/share/${shareToken}`;
    navigator.clipboard.writeText(shareUrl).then(() => {
      console.log('Share link copied to clipboard');
    });
  };


  const handleUpdateShare = async () => {
    if (!editingShare) return;

    try {
      const input: UpdateFileShareInput = {
        share_id: editingShare.id,
        max_downloads: editForm.max_downloads ? parseInt(editForm.max_downloads, 10) : undefined,
        expires_at: editForm.expires_at ? `${editForm.expires_at}T23:59:59Z` : undefined,
      };

      await updateFileShare({
        variables: { input },
      });
    } catch (err) {
      console.error('Failed to update share:', err);
    }
  };

  const handleCloseEditDialog = () => {
    setEditDialogOpen(false);
    setEditingShare(null);
    setEditForm({
      max_downloads: '',
      expires_at: '',
    });
  };

  const handleOpenShareManager = (file: any) => {
    setSelectedFile(file);
    setShareManagerOpen(true);
  };

  const handleCloseShareManager = () => {
    setShareManagerOpen(false);
    setSelectedFile(null);
  };

  const formatDate = (dateString: string) => {
    try {
      return formatDateTime(dateString);
    } catch {
      return 'Invalid date';
    }
  };

  const renderMyShares = () => {
    if (mySharesLoading) {
      return (
        <Box display="flex" justifyContent="center" alignItems="center" minHeight={200}>
          <CircularProgress />
        </Box>
      );
    }

    if (mySharesError) {
      return (
        <Alert severity="error">
          Failed to load shared files: {mySharesError.message}
        </Alert>
      );
    }

    const shares = mySharesData?.myShares || [];

    if (shares.length === 0) {
      return (
        <Box textAlign="center" py={8}>
          <ShareIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h6" gutterBottom>
            No shared files yet
          </Typography>
          <Typography variant="body2" color="text.secondary" paragraph>
            Files you share will appear here. Share files to collaborate with others securely.
          </Typography>
        </Box>
      );
    }

    // Group shares by file ID to show unique filenames
    const groupedShares = shares.reduce((acc: Record<string, FileShare[]>, share: FileShare) => {
      const fileId = share.user_file?.id;
      if (fileId) {
        if (!acc[fileId]) {
          acc[fileId] = [];
        }
        acc[fileId].push(share);
      }
      return acc;
    }, {});

    return (
      <TableContainer>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>File Name</TableCell>
              <TableCell>Size</TableCell>
              <TableCell>Total Shares</TableCell>
              <TableCell>Total Downloads</TableCell>
              <TableCell>Latest Created</TableCell>
              <TableCell align="center">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {Object.entries(groupedShares).map(([fileId, fileShares]) => {
              const firstShare = fileShares[0];
              const totalDownloads = fileShares.reduce((sum, share) => sum + share.download_count, 0);
              const latestCreated = fileShares.reduce((latest, share) => {
                return new Date(share.created_at) > new Date(latest.created_at) ? share : latest;
              });
              
              return (
                <TableRow key={fileId}>
                  <TableCell>
                    <Box display="flex" alignItems="center">
                      <Box>
                        <Typography 
                          variant="body2" 
                          fontWeight={500}
                          sx={{ 
                            cursor: 'pointer', 
                            color: 'primary.main',
                            '&:hover': { textDecoration: 'underline' }
                          }}
                          onClick={() => handleOpenShareManager(firstShare.user_file!)}
                        >
                          {firstShare.user_file?.filename || 'Unknown'}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {firstShare.user_file?.mime_type}
                        </Typography>
                      </Box>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {firstShare.user_file?.file?.size_bytes ? formatFileSize(firstShare.user_file.file.size_bytes) : 'Unknown'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {fileShares.length}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {totalDownloads}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {formatDate(latestCreated.created_at)}
                    </Typography>
                  </TableCell>
                  <TableCell align="center">
                    <Box display="flex" gap={1}>
                      <Tooltip title="Manage Shares">
                        <IconButton
                          size="small"
                          onClick={() => handleOpenShareManager(firstShare.user_file!)}
                          color="primary"
                        >
                          <EditIcon />
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
    );
  };

  const renderSharedWithMe = () => {
    if (sharedWithMeLoading) {
      return (
        <Box display="flex" justifyContent="center" alignItems="center" minHeight={200}>
          <CircularProgress />
        </Box>
      );
    }

    if (sharedWithMeError) {
      return (
        <Alert severity="error">
          Failed to load shared files: {sharedWithMeError.message}
        </Alert>
      );
    }

    const sharedFiles = sharedWithMeData?.sharedWithMe || [];

    if (sharedFiles.length === 0) {
      return (
        <Box textAlign="center" py={8}>
          <PersonIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h6" gutterBottom>
            No files shared with you
          </Typography>
          <Typography variant="body2" color="text.secondary" paragraph>
            Files that others share with you will appear here.
          </Typography>
        </Box>
      );
    }

    return (
      <Grid container spacing={2} sx={{ mt: 1 }}>
        {sharedFiles.map((sharedFile) => (
          <Grid item xs={12} key={sharedFile.id}>
            <Card>
              <CardContent>
                <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                  <Box flex={1}>
                    <Typography variant="h6" gutterBottom>
                      {sharedFile.filename}
                    </Typography>
                    <Box display="flex" gap={2} alignItems="center" mb={1}>
                      <Chip label={`${(sharedFile.size_bytes / 1024 / 1024).toFixed(2)} MB`} size="small" />
                      <Typography variant="body2" color="text.secondary">
                        Shared by: {sharedFile.shared_by.username}
                      </Typography>
                    </Box>
                    <Box display="flex" gap={2} alignItems="center" mb={1}>
                      <Typography variant="body2" color="text.secondary">
                        Access count: {sharedFile.access_count}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Last accessed: {sharedFile.last_access_at ? new Date(sharedFile.last_access_at).toLocaleString() : 'Never'}
                      </Typography>
                    </Box>
                    {sharedFile.max_downloads && (
                      <Typography variant="body2" color="text.secondary">
                        Download limit: {sharedFile.download_count} / {sharedFile.max_downloads}
                      </Typography>
                    )}
                    {sharedFile.expires_at && (
                      <Typography variant="body2" color="text.secondary">
                        Expires: {new Date(sharedFile.expires_at).toLocaleString()}
                      </Typography>
                    )}
                  </Box>
                  <Box display="flex" gap={1}>
                    <Button
                      variant="contained"
                      color="primary"
                      onClick={() => handleDownloadSharedFile(sharedFile)}
                      startIcon={<DownloadIcon />}
                    >
                      Download
                    </Button>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    );
  };

  const handleDownloadSharedFile = (sharedFile: SharedWithMeFile) => {
    window.open(`/share/${sharedFile.share_token}`, '_blank');
  };

  return (
    <Container maxWidth="lg">
      <Box mt={3}>
        <Typography variant="h4" gutterBottom>
          Shared Files
        </Typography>
        
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={tabValue} onChange={handleTabChange} aria-label="shared files tabs">
            <Tab label="My Shares" {...a11yProps(0)} />
            <Tab label="Shared with Me" {...a11yProps(1)} />
          </Tabs>
        </Box>
        
        <TabPanel value={tabValue} index={0}>
          {renderMyShares()}
        </TabPanel>
        
        <TabPanel value={tabValue} index={1}>
          {renderSharedWithMe()}
        </TabPanel>
      </Box>

      {/* Edit Share Dialog */}
      <Dialog open={editDialogOpen} onClose={handleCloseEditDialog} maxWidth="sm" fullWidth>
        <DialogTitle>Edit Share Settings</DialogTitle>
        <DialogContent>
          <Box display="flex" flexDirection="column" gap={2} mt={1}>
            {editingShare && (
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Editing settings for: {editingShare.user_file?.filename || 'Unknown file'}
              </Typography>
            )}
            
            <TextField
              label="Download Limit"
              type="number"
              value={editForm.max_downloads}
              onChange={(e) => setEditForm(prev => ({ ...prev, max_downloads: e.target.value }))}
              placeholder="Leave empty for unlimited"
              helperText="Maximum number of downloads allowed"
              inputProps={{ min: 0 }}
              fullWidth
            />
            
            <TextField
              label="Expiry Date"
              type="date"
              value={editForm.expires_at}
              onChange={(e) => setEditForm(prev => ({ ...prev, expires_at: e.target.value }))}
              helperText="Leave empty for no expiry"
              InputLabelProps={{
                shrink: true,
              }}
              fullWidth
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseEditDialog}>Cancel</Button>
          <Button onClick={handleUpdateShare} variant="contained">Save Changes</Button>
        </DialogActions>
      </Dialog>

      {/* Share Link Manager Dialog */}
      {shareManagerOpen && selectedFile && (
        <ShareLinkManager
          userFileId={selectedFile.id}
          filename={selectedFile.filename}
          open={shareManagerOpen}
          onClose={handleCloseShareManager}
          onShareDeleted={() => {
            refetchMyShares();
            handleCloseShareManager();
          }}
        />
      )}
    </Container>
  );
};

export default memo(SharedView);
