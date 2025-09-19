import React, { useState } from 'react';
import {
  Box,
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
  Drawer,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemButton,
  Divider,
  LinearProgress,
  Chip,
} from '@mui/material';
import {
  ExitToApp,
  AdminPanelSettings,
  CloudUpload as CloudUploadIcon,
  Storage as StorageIcon,
  Home as HomeIcon,
  Schedule as RecentIcon,
  Share as SharedIcon,
  Star as StarredIcon,
  Delete as TrashIcon,
  Add as AddIcon,
  CreateNewFolder as NewFolderIcon,
  FilterList as FilterIcon,
  Search as SearchIcon,
  Notifications as NotificationsIcon,
  Settings as SettingsIcon,
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@apollo/client';
import { GET_MY_STATS } from '../../apollo/queries';
import FileExplorer from '../common/FileExplorer';
import TrashView from './TrashView';
import { formatFileSize } from '../../utils/crypto';

const drawerWidth = 240;

const Dashboard: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const [selectedNav, setSelectedNav] = useState('home');
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
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
    setRefreshTrigger(prev => prev + 1);
  };

  const handleFileDeleted = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  const handleFileRestored = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  const handleTrashFileDeleted = () => {
    setRefreshTrigger(prev => prev + 1);
  };


  const navigationItems = [
    { id: 'home', label: 'Home', icon: <HomeIcon /> },
    { id: 'recent', label: 'Recent', icon: <RecentIcon /> },
    { id: 'shared', label: 'Shared', icon: <SharedIcon /> },
    { id: 'starred', label: 'Starred', icon: <StarredIcon /> },
    { id: 'trash', label: 'Trash', icon: <TrashIcon /> },
  ];

  const quickActions = [
    { label: 'Upload File', icon: <CloudUploadIcon /> },
    { label: 'New Folder', icon: <NewFolderIcon /> },
  ];

  return (
    <Box sx={{ 
      display: 'flex', 
      minHeight: '100vh',
      backgroundColor: '#f8fafc'
    }}>
      {/* App Bar */}
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
              onClick={handleMenu}
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

      {/* Sidebar */}
      <Drawer
        variant="permanent"
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: drawerWidth,
            boxSizing: 'border-box',
            backgroundColor: '#ffffff',
            borderRight: '1px solid #e5e7eb',
            boxShadow: 'none'
          },
        }}
      >
        <Toolbar />
        <Box sx={{ overflow: 'auto', p: 2 }}>
          {/* Create New Button */}
          <Paper sx={{ 
            p: 2, 
            mb: 3,
            backgroundColor: '#3b82f6',
            color: 'white',
            borderRadius: 2,
            cursor: 'pointer',
            boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
            '&:hover': {
              backgroundColor: '#2563eb',
              transform: 'translateY(-1px)',
              boxShadow: '0 4px 12px 0 rgb(0 0 0 / 0.15)'
            },
            transition: 'all 0.2s ease-in-out'
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <AddIcon sx={{ mr: 1, fontSize: 20 }} />
              <Typography variant="body2" fontWeight={600}>
                New Upload
              </Typography>
            </Box>
          </Paper>

          {/* Navigation */}
          <List sx={{ px: 0 }}>
            {navigationItems.map((item) => (
              <ListItem key={item.id} disablePadding sx={{ mb: 0.5 }}>
                <ListItemButton 
                  selected={selectedNav === item.id}
                  onClick={() => setSelectedNav(item.id)}
                  sx={{
                    borderRadius: 2,
                    '&.Mui-selected': {
                      backgroundColor: '#eff6ff',
                      color: '#2563eb',
                      '&:hover': {
                        backgroundColor: '#dbeafe',
                      },
                      '& .MuiListItemIcon-root': {
                        color: '#2563eb',
                      }
                    },
                    '&:hover': {
                      backgroundColor: '#f8fafc',
                    }
                  }}
                >
                  <ListItemIcon sx={{ color: '#6b7280', minWidth: 36 }}>
                    {item.icon}
                  </ListItemIcon>
                  <ListItemText 
                    primary={item.label} 
                    primaryTypographyProps={{ 
                      fontSize: '0.875rem',
                      fontWeight: selectedNav === item.id ? 600 : 400
                    }}
                  />
                </ListItemButton>
              </ListItem>
            ))}
          </List>


          <Divider sx={{ my: 2 }} />

          {/* Quick Actions */}
          <Typography variant="subtitle2" sx={{ color: '#6b7280', mb: 2, fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Quick Actions
          </Typography>
          <List sx={{ px: 0 }}>
            {quickActions.map((action, index) => (
              <ListItem key={index} disablePadding sx={{ mb: 0.5 }}>
                <ListItemButton sx={{ 
                  borderRadius: 2,
                  '&:hover': {
                    backgroundColor: '#f8fafc',
                  }
                }}>
                  <ListItemIcon sx={{ color: '#6b7280', minWidth: 36 }}>
                    {action.icon}
                  </ListItemIcon>
                  <ListItemText 
                    primary={action.label}
                    primaryTypographyProps={{ 
                      fontSize: '0.875rem'
                    }}
                  />
                </ListItemButton>
              </ListItem>
            ))}
          </List>

          {/* Storage Info */}
          <Box sx={{ mt: 4, p: 3, backgroundColor: '#f8fafc', borderRadius: 3, border: '1px solid #e5e7eb' }}>
            <Typography variant="subtitle2" sx={{ color: '#374151', mb: 2, fontWeight: 600 }}>
              Storage Usage
            </Typography>
            <Typography variant="body2" sx={{ mb: 2, color: '#6b7280' }}>
              {statsLoading ? '...' : formatFileSize(statsData?.myStats?.used_storage || 0)} of {statsLoading ? '...' : formatFileSize(statsData?.myStats?.storage_quota || 0)} used
            </Typography>
            <LinearProgress 
              variant="determinate" 
              value={statsLoading ? 0 : Math.min((statsData?.myStats?.used_storage || 0) / (statsData?.myStats?.storage_quota || 1) * 100, 100)}
              sx={{ 
                height: 8, 
                borderRadius: 4,
                backgroundColor: '#e5e7eb',
                '& .MuiLinearProgress-bar': {
                  backgroundColor: '#3b82f6',
                  borderRadius: 4
                }
              }}
            />
            <Typography variant="caption" sx={{ color: '#6b7280', mt: 1, display: 'block' }}>
              {statsLoading ? '...' : `${Math.round((statsData?.myStats?.storage_savings || 0) / 1024)}KB`} space saved
            </Typography>
          </Box>
        </Box>
      </Drawer>

      {/* Main Content */}
      <Box component="main" sx={{ flexGrow: 1, p: 3 }}>
        <Toolbar />
        
        {/* Header */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="h4" sx={{ fontWeight: 600, color: '#1f2937', mb: 1 }}>
            {selectedNav === 'trash' ? 'Trash' : selectedFolderId ? 'Folder Files' : 'My Files'}
          </Typography>
          <Typography variant="body1" sx={{ color: '#6b7280' }}>
            {selectedNav === 'trash'
              ? 'Manage your deleted files - restore or permanently delete'
              : selectedFolderId
                ? 'Files in selected folder'
                : 'Manage your secure encrypted files'
            }
          </Typography>
        </Box>

        {/* Stats Cards - Only show for home view */}
        {selectedNav === 'home' && (
          <Grid container spacing={3} sx={{ mb: 4 }}>
            <Grid item xs={12} sm={6} md={3}>
              <Card sx={{ border: '1px solid #e5e7eb', boxShadow: 'none' }}>
                <CardContent>
                  <Box display="flex" alignItems="center">
                    <Box sx={{
                      p: 1.5,
                      borderRadius: 2,
                      backgroundColor: '#eff6ff',
                      mr: 2
                    }}>
                      <StorageIcon sx={{ color: '#2563eb', fontSize: 24 }} />
                    </Box>
                    <Box>
                      <Typography variant="h6" sx={{ fontWeight: 600, color: '#1f2937' }}>
                        {statsLoading ? '...' : statsData?.myStats?.total_files || 0}
                      </Typography>
                      <Typography variant="body2" color="#6b7280">
                        Total Files
                      </Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <Card sx={{ border: '1px solid #e5e7eb', boxShadow: 'none' }}>
                <CardContent>
                  <Box display="flex" alignItems="center">
                    <Box sx={{
                      p: 1.5,
                      borderRadius: 2,
                      backgroundColor: '#f0fdf4',
                      mr: 2
                    }}>
                      <CloudUploadIcon sx={{ color: '#16a34a', fontSize: 24 }} />
                    </Box>
                    <Box>
                      <Typography variant="h6" sx={{ fontWeight: 600, color: '#1f2937' }}>
                        {statsLoading ? '...' : formatFileSize(statsData?.myStats?.used_storage || 0)}
                      </Typography>
                      <Typography variant="body2" color="#6b7280">
                        Storage Used
                      </Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <Card sx={{ border: '1px solid #e5e7eb', boxShadow: 'none' }}>
                <CardContent>
                  <Box display="flex" alignItems="center">
                    <Box sx={{
                      p: 1.5,
                      borderRadius: 2,
                      backgroundColor: '#fef3c7',
                      mr: 2
                    }}>
                      <StorageIcon sx={{ color: '#d97706', fontSize: 24 }} />
                    </Box>
                    <Box>
                      <Typography variant="h6" sx={{ fontWeight: 600, color: '#1f2937' }}>
                        {statsLoading ? '...' : formatFileSize(statsData?.myStats?.storage_quota || 0)}
                      </Typography>
                      <Typography variant="body2" color="#6b7280">
                        Storage Quota
                      </Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <Card sx={{ border: '1px solid #e5e7eb', boxShadow: 'none' }}>
                <CardContent>
                  <Box display="flex" alignItems="center">
                    <Box sx={{
                      p: 1.5,
                      borderRadius: 2,
                      backgroundColor: '#fdf2f8',
                      mr: 2
                    }}>
                      <StorageIcon sx={{ color: '#dc2626', fontSize: 24 }} />
                    </Box>
                    <Box>
                      <Typography variant="h6" sx={{ fontWeight: 600, color: '#1f2937' }}>
                        {statsLoading ? '...' : `${Math.round((statsData?.myStats?.storage_savings || 0) / 1024)}KB`}
                      </Typography>
                      <Typography variant="body2" color="#6b7280">
                        Space Saved
                      </Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        )}


        {/* Content based on selected navigation */}
        {selectedNav === 'trash' ? (
          <Paper sx={{
            p: 4,
            border: '1px solid #e5e7eb',
            boxShadow: 'none',
            borderRadius: 3
          }}>
            <TrashView
              onFileRestored={handleFileRestored}
              onFileDeleted={handleTrashFileDeleted}
            />
          </Paper>
        ) : (
          <Paper sx={{
            p: 4,
            border: '1px solid #e5e7eb',
            boxShadow: 'none',
            borderRadius: 3
          }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 600, color: '#1f2937' }}>
                  Your Files
                </Typography>
                <Typography variant="body2" color="#6b7280">
                  Manage your encrypted files. Click download to decrypt and save locally.
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Chip
                  icon={<FilterIcon />}
                  label="Filter"
                  variant="outlined"
                  size="small"
                  sx={{
                    borderColor: '#d1d5db',
                    color: '#6b7280',
                    '&:hover': {
                      borderColor: '#3b82f6',
                      backgroundColor: '#eff6ff'
                    }
                  }}
                />
              </Box>
            </Box>
            <FileExplorer
              folderId={selectedFolderId}
              onFileDeleted={handleFileDeleted}
              onUploadComplete={handleUploadComplete}
              key={refreshTrigger}
            />
          </Paper>
        )}
      </Box>
    </Box>
  );
};

export default Dashboard;
