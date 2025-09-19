import React, { memo } from 'react';
import {
  AppBar,
  Toolbar,
  Box,
  Typography,
  IconButton,
  Menu,
  MenuItem,
  Avatar,
} from '@mui/material';
import {
  ExitToApp,
  AdminPanelSettings,
  Search as SearchIcon,
  Notifications as NotificationsIcon,
  Settings as SettingsIcon,
  Storage as StorageIcon,
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

interface DashboardAppBarProps {
  onMenuOpen: (event: React.MouseEvent<HTMLElement>) => void;
  anchorEl: HTMLElement | null;
  onMenuClose: () => void;
}

const DashboardAppBar: React.FC<DashboardAppBarProps> = ({
  onMenuOpen,
  anchorEl,
  onMenuClose,
}) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    onMenuClose();
  };

  const handleAdminPanel = () => {
    navigate('/admin');
    onMenuClose();
  };

  return (
    <AppBar
      position="fixed"
      sx={{
        zIndex: (theme) => theme.zIndex.drawer + 1,
        backgroundColor: '#ffffff',
        color: '#1f2937',
        boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
        borderBottom: '1px solid #e5e7eb'
      }}
    >
      <Toolbar>
        <Box sx={{ display: 'flex', alignItems: 'center', flexGrow: 1 }}>
          <Box sx={{
            width: 36,
            height: 36,
            borderRadius: 2,
            background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            mr: 2
          }}>
            <StorageIcon sx={{ color: 'white', fontSize: 20 }} />
          </Box>
          <Typography variant="h6" component="div" sx={{ fontWeight: 600, color: '#1f2937' }}>
            AegisDrive
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <IconButton sx={{ color: '#6b7280' }}>
            <SearchIcon />
          </IconButton>

          <IconButton sx={{ color: '#6b7280' }}>
            <NotificationsIcon />
          </IconButton>

          <IconButton sx={{ color: '#6b7280' }}>
            <SettingsIcon />
          </IconButton>

          <IconButton
            size="large"
            aria-label="account of current user"
            aria-controls="menu-appbar"
            aria-haspopup="true"
            onClick={onMenuOpen}
            sx={{ ml: 1 }}
          >
            <Avatar sx={{
              width: 32,
              height: 32,
              backgroundColor: '#3b82f6',
              fontSize: '0.875rem'
            }}>
              {user?.email?.charAt(0).toUpperCase()}
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
            onClose={onMenuClose}
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
  );
};

export default memo(DashboardAppBar);