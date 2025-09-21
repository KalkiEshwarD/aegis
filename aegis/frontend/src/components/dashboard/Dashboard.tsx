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
  ToggleButton,
  ToggleButtonGroup,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  ChevronRight as ChevronRightIcon,
  ViewList as ListViewIcon,
  ViewModule as TileViewIcon,
  CreateNewFolder as CreateNewFolderIcon,
} from '@mui/icons-material';
import { useQuery, useMutation } from '@apollo/client';
import { GET_MY_STATS } from '../../apollo/files';
import { CREATE_FOLDER_MUTATION } from '../../apollo/folders';
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
  const [viewMode, setViewMode] = useState<'list' | 'tile'>('tile');
  const [createFolderDialogOpen, setCreateFolderDialogOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [folderCreationError, setFolderCreationError] = useState<string | null>(null);
  const [selectedCount, setSelectedCount] = useState(0);

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
        
        {/* Header */}
        <Box sx={{ mb: 3 }}>
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
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                {selectedCount > 0 && (
                  <Typography variant="body2" sx={{ color: '#3b82f6', fontWeight: 500 }}>
                    {selectedCount} item{selectedCount !== 1 ? 's' : ''} selected
                  </Typography>
                )}
                <ToggleButtonGroup
                  value={viewMode}
                  exclusive
                  onChange={(_, newMode) => newMode && setViewMode(newMode)}
                  size="small"
                >
                  <ToggleButton value="list">
                    <ListViewIcon fontSize="small" />
                  </ToggleButton>
                  <ToggleButton value="tile">
                    <TileViewIcon fontSize="small" />
                  </ToggleButton>
                </ToggleButtonGroup>
              </Box>
            </Box>

            {/* Navigation and Actions Row - Show for home view */}
            {selectedNav === 'home' && (
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                {/* Back Navigation and Breadcrumbs */}
                {selectedFolderId ? (
                  <>
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
                  </>
                ) : (
                  <Breadcrumbs sx={{ flexGrow: 1 }}>
                    <Typography
                      color="primary"
                      variant="body1"
                      sx={{
                        fontWeight: 500,
                      }}
                    >
                      Home
                    </Typography>
                  </Breadcrumbs>
                )}
                <Button
                  variant="contained"
                  startIcon={<CreateNewFolderIcon />}
                  onClick={handleCreateFolderClick}
                  size="small"
                  sx={{ ml: 2 }}
                >
                  New Folder
                </Button>
              </Box>
            )}


            <FileExplorer
              folderId={selectedFolderId}
              onFileDeleted={handleFileDeleted}
              onUploadComplete={handleUploadComplete}
              onFolderClick={(folderId, folderName) => handleFolderSelect(folderId, folderName)}
              externalSearchTerm={searchTerm}
              externalViewMode={viewMode}
              onSelectionChange={setSelectedCount}
              key={refreshTrigger}
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
