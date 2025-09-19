import React, { memo } from 'react';
import {
  Box,
  Toolbar,
  Typography,
  Paper,
  Chip,
} from '@mui/material';
import {
  FilterList as FilterIcon,
} from '@mui/icons-material';
import { useQuery } from '@apollo/client';
import { GET_MY_STATS } from '../../apollo/files';
import FileExplorer from '../common/FileExplorer';
import TrashView from './TrashView';
import DashboardAppBar from './DashboardAppBar';
import DashboardSidebar from './DashboardSidebar';
import StatsCards from './StatsCards';
import { useDashboardNavigation } from '../../hooks/useDashboardNavigation';
import { useUserMenu } from '../../hooks/useUserMenu';
import withAuth from '../hocs/withAuth';
import withErrorBoundary from '../hocs/withErrorBoundary';
import withDataFetching from '../hocs/withDataFetching';

const drawerWidth = 240;

const Dashboard: React.FC = () => {
  const { data: statsData, loading: statsLoading } = useQuery(GET_MY_STATS, {
    fetchPolicy: 'cache-and-network',
  });

  // Use custom hooks
  const {
    selectedNav,
    selectedFolderId,
    refreshTrigger,
    handleNavChange,
    handleFolderSelect,
    triggerRefresh,
  } = useDashboardNavigation();

  const {
    anchorEl,
    handleMenuOpen,
    handleMenuClose,
    handleLogout,
    handleAdminPanel,
  } = useUserMenu();

  const handleUploadComplete = () => {
    triggerRefresh();
  };

  const handleFileDeleted = () => {
    triggerRefresh();
  };

  const handleFileRestored = () => {
    triggerRefresh();
  };

  const handleTrashFileDeleted = () => {
    triggerRefresh();
  };

  return (
    <Box sx={{
      display: 'flex',
      minHeight: '100vh',
      backgroundColor: '#f8fafc'
    }}>
      {/* App Bar */}
      <DashboardAppBar
        onMenuOpen={handleMenuOpen}
        anchorEl={anchorEl}
        onMenuClose={handleMenuClose}
      />

      {/* Sidebar */}
      <DashboardSidebar
        selectedNav={selectedNav}
        onNavChange={handleNavChange}
        statsData={statsData}
        statsLoading={statsLoading}
        onUploadComplete={handleUploadComplete}
      />

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
          <StatsCards
            statsData={statsData}
            statsLoading={statsLoading}
          />
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
              onFolderClick={handleFolderSelect}
              key={refreshTrigger}
            />
          </Paper>
        )}
      </Box>
    </Box>
  );
};

// Create enhanced component with HOCs
const DashboardWithAuth = withAuth(Dashboard);
const DashboardWithErrorBoundary = withErrorBoundary(DashboardWithAuth);

export default memo(DashboardWithErrorBoundary);
