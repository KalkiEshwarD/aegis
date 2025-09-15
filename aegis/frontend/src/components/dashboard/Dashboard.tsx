import React from 'react';
import {
  Box,
  Container,
  AppBar,
  Toolbar,
  Typography,
  Button,
  IconButton,
  Menu,
  MenuItem,
  Avatar
} from '@mui/material';
import { AccountCircle, ExitToApp, AdminPanelSettings } from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

const Dashboard: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);

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
        
        <Typography variant="body1" color="textSecondary">
          Welcome to your secure file vault! Upload, manage, and share your files with end-to-end encryption.
        </Typography>

        {/* TODO: Add file upload, file list, and other dashboard components */}
        <Box sx={{ mt: 4 }}>
          <Typography variant="h6" gutterBottom>
            Quick Stats
          </Typography>
          <Typography variant="body2">
            Storage Used: {user?.used_storage} / {user?.storage_quota} bytes
          </Typography>
          <Typography variant="body2">
            Account Type: {user?.is_admin ? 'Administrator' : 'User'}
          </Typography>
        </Box>
      </Container>
    </Box>
  );
};

export default Dashboard;
