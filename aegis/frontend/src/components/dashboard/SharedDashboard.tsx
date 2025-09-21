import React, { memo, useState } from 'react';
import {
  Box,
  Toolbar,
  Typography,
  Paper,
  Breadcrumbs,
  IconButton,
  Link,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  ChevronRight as ChevronRightIcon,
} from '@mui/icons-material';
import { useQuery } from '@apollo/client';
import { GET_MY_STATS } from '../../apollo/files';
import TrashView from './TrashView';
import StarredView from './StarredView';
import SharedView from './SharedView';
import DashboardAppBar from './DashboardAppBar';
import StatsCards from './StatsCards';
import { useDashboardNavigation } from '../../hooks/useDashboardNavigation';
import { useUserMenu } from '../../hooks/useUserMenu';
import withAuth from '../hocs/withAuth';
import withErrorBoundary from '../hocs/withErrorBoundary';
import withDataFetching from '../hocs/withDataFetching';

import DashboardSidebar from './DashboardSidebar';

const drawerWidth = 240;

const SharedDashboard: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  
  const { data: statsData, loading: statsLoading } = useQuery(GET_MY_STATS, {
    fetchPolicy: 'cache-and-network',
  });

  // Use custom hooks
  const {
    selectedNav,
    selectedFolderId,
    folderPath,
    canNavigateBack,
    refreshTrigger,
    handleNavChange,
    handleFolderSelect,
    handleNavigateBack,
    handleBreadcrumbClick,
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

      {/* Sidebar - without shared tab */}
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
        
        {/* Header with Breadcrumbs */}
        <Box sx={{ mb: 3 }}>
          {/* Back Navigation and Breadcrumbs - Only show when in folder navigation mode */}
          {selectedNav === 'home' && selectedFolderId && (
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <IconButton 
                onClick={handleNavigateBack}
                disabled={!canNavigateBack}
                sx={{ mr: 1 }}
                size="small"
              >
                <ArrowBackIcon />
              </IconButton>
              <Breadcrumbs 
                separator={<ChevronRightIcon fontSize="small" />}
                sx={{ flexGrow: 1 }}
              >
                {folderPath.map((pathItem, index) => (
                  <Link
                    key={pathItem.id || 'root'}
                    color={index === folderPath.length - 1 ? 'text.primary' : 'primary'}
                    component="button"
                    variant="body2"
                    onClick={() => handleBreadcrumbClick(index)}
                    sx={{
                      textDecoration: 'none',
                      '&:hover': {
                        textDecoration: index === folderPath.length - 1 ? 'none' : 'underline',
                      },
                      cursor: index === folderPath.length - 1 ? 'default' : 'pointer',
                      border: 'none',
                      background: 'none',
                      padding: 0,
                      font: 'inherit',
                    }}
                  >
                    {pathItem.name}
                  </Link>
                ))}
              </Breadcrumbs>
            </Box>
          )}
          
          <Typography variant="h4" sx={{ fontWeight: 600, color: '#1f2937', mb: 1 }}>
            {selectedNav === 'trash' ? 'Trash' : 
             selectedNav === 'starred' ? 'Starred Files' :
             selectedFolderId ? 'Folder Files' : 'Shared Files'}
          </Typography>
          <Typography variant="body1" sx={{ color: '#6b7280' }}>
            {selectedNav === 'trash'
              ? 'Manage your deleted files - restore or permanently delete'
              : selectedNav === 'starred'
                ? 'Your starred files for quick access'
              : selectedFolderId
                ? 'Files in selected folder'
                : 'View and manage your shared files'
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

        {/* Content based on selected navigation - NO SHARED TAB */}
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
        ) : selectedNav === 'starred' ? (
          <Paper sx={{
            p: 4,
            border: '1px solid #e5e7eb',
            boxShadow: 'none',
            borderRadius: 3
          }}>
            <StarredView />
          </Paper>
        ) : (
          <Paper sx={{
            p: 4,
            border: '1px solid #e5e7eb',
            boxShadow: 'none',
            borderRadius: 3
          }}>
            <SharedView
              onShareDeleted={triggerRefresh}
            />
          </Paper>
        )}
      </Box>
    </Box>
  );
};

// Create enhanced component with HOCs
const SharedDashboardWithAuth = withAuth(SharedDashboard);
const SharedDashboardWithErrorBoundary = withErrorBoundary(SharedDashboardWithAuth);

export default memo(SharedDashboardWithErrorBoundary);