import React, { memo, useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Box,
  Toolbar,
  Paper,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
} from '@mui/material';
import { useQuery, useMutation } from '@apollo/client';
import { GET_MY_STATS } from '../../apollo/files';
import { CREATE_FOLDER_MUTATION } from '../../apollo/folders';
import FileExplorer from '../common/FileExplorer';
import TrashView from './TrashView';
import SharedView from './SharedView';
import StarredView from './StarredView';
import RoomView from './RoomView';
import StarredSidebar from '../common/StarredSidebar';
import DashboardAppBar from './DashboardAppBar';
import DashboardSidebar from './DashboardSidebar';
import StatsCards from './StatsCards';
import { useDashboardNavigation } from '../../hooks/useDashboardNavigation';
import { useUserMenu } from '../../hooks/useUserMenu';
import { useFileUpload } from '../../hooks/useFileUpload';
import { isFile } from '../../types';
import withAuth from '../hocs/withAuth';
import withErrorBoundary from '../hocs/withErrorBoundary';


const Dashboard: React.FC = () => {
  const location = useLocation();
  const [viewMode, setViewMode] = useState<'list' | 'tile'>('tile');
  const [createFolderDialogOpen, setCreateFolderDialogOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [folderCreationError, setFolderCreationError] = useState<string | null>(null);
  const [starredSidebarCollapsed, setStarredSidebarCollapsed] = useState(true);

  const { data: statsData, loading: statsLoading } = useQuery(GET_MY_STATS, {
    fetchPolicy: 'cache-and-network',
  });

  const [createFolderMutation] = useMutation(CREATE_FOLDER_MUTATION);

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

  useEffect(() => {
    if (location.state?.selectedNav) {
      handleNavChange(location.state.selectedNav);
    }
  }, [location.state, handleNavChange]);

  const {
    anchorEl,
    handleMenuOpen,
    handleMenuClose,
  } = useUserMenu();

  const handleUploadComplete = () => {
    triggerRefresh();
  };

  const { handleFiles } = useFileUpload(handleUploadComplete);

  const handleFileSelect = (files: File[]) => {
    handleFiles(files);
  };

  const handleFileRestored = () => {
    triggerRefresh();
  };

  const handleFileDeleted = () => {
    triggerRefresh();
  };

  const handleTrashFileDeleted = () => {
    triggerRefresh();
  };

  const handleCreateFolderClick = () => {
    setNewFolderName('');
    setFolderCreationError(null);
    setCreateFolderDialogOpen(true);
  };

  const handleCreateFolderConfirm = async () => {
    if (!newFolderName.trim()) {
      setFolderCreationError('Folder name cannot be empty');
      return;
    }

    try {
      await createFolderMutation({
        variables: {
          input: {
            name: newFolderName.trim(),
            parent_id: selectedFolderId || undefined,
          },
        },
      });

      // Close dialog and reset state
      setCreateFolderDialogOpen(false);
      setNewFolderName('');
      setFolderCreationError(null);

      // Refresh data
      triggerRefresh();
    } catch (error: any) {
      console.error('Error creating folder:', error);
      setFolderCreationError(error.message || 'Failed to create folder');
    }
  };

  const handleCreateFolderCancel = () => {
    setCreateFolderDialogOpen(false);
    setNewFolderName('');
    setFolderCreationError(null);
  };

  const handleToggleStarredSidebar = () => {
    setStarredSidebarCollapsed(!starredSidebarCollapsed);
  };

  const handleStarredItemClick = (item: any) => {
    if (isFile(item)) {
      // Navigate to the folder containing this file
      if (item.folder_id) {
        handleFolderSelect(item.folder_id, item.folder?.name || 'Folder');
      } else {
        // File is in root, navigate to home
        handleNavChange('home');
      }
    }
    // For folders, onFolderClick handles it
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
        onToggleStarredSidebar={handleToggleStarredSidebar}
        starredSidebarCollapsed={starredSidebarCollapsed}
      />

      {/* Sidebar */}
      <DashboardSidebar
        selectedNav={selectedNav}
        onNavChange={handleNavChange}
        statsData={statsData}
        statsLoading={statsLoading}
        onUploadComplete={handleUploadComplete}
      />

      {/* Starred Sidebar */}
      {!starredSidebarCollapsed && (
        <StarredSidebar
          isCollapsed={false}
          onToggleCollapse={handleToggleStarredSidebar}
          onFolderClick={handleFolderSelect}
          onItemClick={handleStarredItemClick}
        />
      )}

      {/* Main Content */}
      <Box component="main" sx={{ flexGrow: 1, p: 3 }}>
        <Toolbar />
        

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
            <StarredView />
          </Paper>
        ) : selectedNav === 'rooms' ? (
          <Paper sx={{
            p: 4,
            border: '1px solid #e5e7eb',
            boxShadow: 'none',
            borderRadius: 3
          }}>
            <RoomView />
          </Paper>
        ) : (
          <Paper sx={{
            p: 4,
            border: '1px solid #e5e7eb',
            boxShadow: 'none',
            borderRadius: 3
          }}>


            <FileExplorer
              folderId={selectedFolderId}
              onFileDeleted={handleFileDeleted}
              onUploadComplete={handleUploadComplete}
              onFolderClick={(folderId, folderName) => handleFolderSelect(folderId, folderName)}
              externalViewMode={viewMode}
              key={refreshTrigger}
              // Header props
              showHeader={true}
              title={selectedFolderId ? 'Folder Files' : 'My Files'}
              description={selectedFolderId ? 'Files in selected folder' : 'Manage your secure encrypted files'}
              showBreadcrumbs={true}
              folderPath={folderPath}
              onBreadcrumbClick={handleBreadcrumbClick}
              canNavigateBack={canNavigateBack}
              onNavigateBack={handleNavigateBack}
              showNewFolderButton={true}
              onCreateFolder={handleCreateFolderClick}
              onViewModeChange={setViewMode}
              onFileSelect={handleFileSelect}
            />
          </Paper>
        )}

        {/* Create Folder Dialog */}
        <Dialog open={createFolderDialogOpen} onClose={handleCreateFolderCancel}>
          <DialogTitle>Create New Folder</DialogTitle>
          <DialogContent>
            <TextField
              autoFocus
              margin="dense"
              label="Folder Name"
              fullWidth
              variant="outlined"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              error={!!folderCreationError}
              helperText={folderCreationError}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleCreateFolderConfirm();
                }
              }}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCreateFolderCancel}>Cancel</Button>
            <Button
              onClick={handleCreateFolderConfirm}
              variant="contained"
              disabled={!newFolderName.trim()}
            >
              Create
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </Box>
  );
};

// Create enhanced component with HOCs
const DashboardWithAuth = withAuth(Dashboard);
const DashboardWithErrorBoundary = withErrorBoundary(DashboardWithAuth);

export default memo(DashboardWithErrorBoundary);
