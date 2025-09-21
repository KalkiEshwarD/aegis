import React, { memo, useState } from 'react';
import {
  Box,
  Toolbar,
  Typography,
  Paper,
  Chip,
  Breadcrumbs,
  IconButton,
  Link,
} from '@mui/material';
import {
  FilterList as FilterIcon,
  ArrowBack as ArrowBackIcon,
  ChevronRight as ChevronRightIcon,
} from '@mui/icons-material';
import { useQuery } from '@apollo/client';
import { GET_MY_STATS } from '../../apollo/files';
import FileExplorer from '../common/FileExplorer';
import TrashView from './TrashView';
import SharedView from './SharedView';
import StarredView from './StarredView';
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
        onSearch={setSearchTerm}
        searchTerm={searchTerm}
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
             selectedNav === 'shared' ? 'Shared Files' :
             selectedNav === 'starred' ? 'Starred Files' :
             selectedFolderId ? 'Folder Files' : 'My Files'}
          </Typography>
          <Typography variant="body1" sx={{ color: '#6b7280' }}>
            {selectedNav === 'trash'
              ? 'Manage your deleted files - restore or permanently delete'
              : selectedNav === 'shared'
                ? 'View and manage your shared files'
              : selectedNav === 'starred'
                ? 'Your starred files for quick access'
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
        ) : selectedNav === 'shared' ? (
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
        ) : selectedNav === 'starred' ? (
          <Paper sx={{
            p: 4,
            border: '1px solid #e5e7eb',
            boxShadow: 'none',
            borderRadius: 3
          }}>
            <StarredView
              onFileDeleted={handleFileDeleted}
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
              onFolderClick={(folderId, folderName) => handleFolderSelect(folderId, folderName)}
              externalSearchTerm={searchTerm}
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
