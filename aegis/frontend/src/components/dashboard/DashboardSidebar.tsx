import React, { memo } from 'react';
import {
  Box,
  Drawer,
  Toolbar,
  Paper,
  Typography,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Divider,
  LinearProgress,
} from '@mui/material';
import {
  Add as AddIcon,
  CloudUpload as CloudUploadIcon,
  Storage as StorageIcon,
  Home as HomeIcon,
  Schedule as RecentIcon,
  Share as SharedIcon,
  Star as StarredIcon,
  Delete as TrashIcon,
  CreateNewFolder as NewFolderIcon,
} from '@mui/icons-material';
import { formatFileSize } from '../../utils/fileUtils';

const drawerWidth = 240;

interface NavigationItem {
  id: string;
  label: string;
  icon: React.ReactElement;
}

interface QuickAction {
  label: string;
  icon: React.ReactElement;
}

interface DashboardSidebarProps {
  selectedNav: string;
  onNavChange: (navId: string) => void;
  statsData?: any;
  statsLoading: boolean;
}

const DashboardSidebar: React.FC<DashboardSidebarProps> = ({
  selectedNav,
  onNavChange,
  statsData,
  statsLoading,
}) => {
  const navigationItems: NavigationItem[] = [
    { id: 'home', label: 'Home', icon: <HomeIcon /> },
    { id: 'recent', label: 'Recent', icon: <RecentIcon /> },
    { id: 'shared', label: 'Shared', icon: <SharedIcon /> },
    { id: 'starred', label: 'Starred', icon: <StarredIcon /> },
    { id: 'trash', label: 'Trash', icon: <TrashIcon /> },
  ];

  const quickActions: QuickAction[] = [
    { label: 'Upload File', icon: <CloudUploadIcon /> },
    { label: 'New Folder', icon: <NewFolderIcon /> },
  ];

  return (
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
                onClick={() => onNavChange(item.id)}
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
  );
};

export default memo(DashboardSidebar);