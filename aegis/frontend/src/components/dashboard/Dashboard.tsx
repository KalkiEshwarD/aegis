import React, { useState } from 'react';
import {
  Box,
  Container,
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Menu,
  MenuItem,
  Avatar,
  Grid,
  Paper,
  Card,
  CardContent,
} from '@mui/material';
import {
  AccountCircle,
  ExitToApp,
  AdminPanelSettings,
  CloudUpload as CloudUploadIcon,
  Folder as FolderIcon,
  Storage as StorageIcon,
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@apollo/client';
import { GET_MY_STATS } from '../../apollo/queries';
import FileUploadDropzone from '../common/FileUploadDropzone';
import FileTable from '../common/FileTable';
import { formatFileSize } from '../../utils/crypto';

const Dashboard: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const { data: statsData, loading: statsLoading } = useQuery(GET_MY_STATS, {
    fetchPolicy: 'cache-and-network',
  });

  const handleMenu = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = () => {
    logout();
    handleClose();
  };

  const handleAdminPanel = () => {
    navigate('/admin');
    handleClose();
  };

  const handleUploadComplete = () => {
    // Trigger refresh of file list and stats
    setRefreshTrigger(prev => prev + 1);
  };

  const handleFileDeleted = () => {
    // Trigger refresh of file list and stats
    setRefreshTrigger(prev => prev + 1);
  };

  return (
    <Box sx={{ flexGrow: 1 }}>
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            Aegis File Vault
          </Typography>
          
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Typography variant="body2" sx={{ mr: 2 }}>
              Welcome, {user?.email}
            </Typography>
            
            <IconButton
              size="large"
              aria-label="account of current user"
              aria-controls="menu-appbar"
              aria-haspopup="true"
              onClick={handleMenu}
              color="inherit"
            >
              <Avatar sx={{ width: 32, height: 32 }}>
                <AccountCircle />
              </Avatar>
            </IconButton>
            
            <Menu
              id="menu-appbar"
              anchorEl={anchorEl}
              anchorOrigin={{
                vertical: 'top',
                horizontal: 'right',
              }}
              keepMounted
              transformOrigin={{
                vertical: 'top',
                horizontal: 'right',
              }}
              open={Boolean(anchorEl)}
              onClose={handleClose}
            >
              {user?.is_admin && (
                <MenuItem onClick={handleAdminPanel}>
                  <AdminPanelSettings sx={{ mr: 1 }} />
                  Admin Panel
                </MenuItem>
              )}
              <MenuItem onClick={handleLogout}>
                <ExitToApp sx={{ mr: 1 }} />
                Logout
              </MenuItem>
            </Menu>
          </Box>
        </Toolbar>
      </AppBar>

      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Typography variant="h4" gutterBottom>
          Dashboard
        </Typography>

        <Typography variant="body1" color="textSecondary" sx={{ mb: 4 }}>
          Welcome to your secure file vault! Upload, manage, and share your files with end-to-end encryption.
        </Typography>

        {/* Stats Cards */}
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center">
                  <FolderIcon color="primary" sx={{ mr: 1 }} />
                  <Box>
                    <Typography variant="h6">
                      {statsLoading ? '...' : statsData?.myStats?.total_files || 0}
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      Total Files
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center">
                  <StorageIcon color="secondary" sx={{ mr: 1 }} />
                  <Box>
                    <Typography variant="h6">
                      {statsLoading ? '...' : formatFileSize(statsData?.myStats?.used_storage || 0)}
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      Storage Used
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center">
                  <CloudUploadIcon color="success" sx={{ mr: 1 }} />
                  <Box>
                    <Typography variant="h6">
                      {statsLoading ? '...' : formatFileSize(statsData?.myStats?.storage_quota || 0)}
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      Storage Quota
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center">
                  <StorageIcon color="info" sx={{ mr: 1 }} />
                  <Box>
                    <Typography variant="h6">
                      {statsLoading ? '...' : `${Math.round((statsData?.myStats?.storage_savings || 0) / 1024)}KB`}
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      Space Saved
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* File Upload Section */}
        <Paper sx={{ p: 3, mb: 4 }}>
          <Typography variant="h6" gutterBottom>
            Upload Files
          </Typography>
          <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
            Drag and drop files here or click to browse. Files are encrypted before upload.
          </Typography>
          <FileUploadDropzone onUploadComplete={handleUploadComplete} />
        </Paper>

        {/* File List Section */}
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            Your Files
          </Typography>
          <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
            Manage your encrypted files. Click download to decrypt and save locally.
          </Typography>
          <FileTable onFileDeleted={handleFileDeleted} key={refreshTrigger} />
        </Paper>
      </Container>
    </Box>
  );
};

export default Dashboard;
