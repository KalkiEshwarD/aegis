import React, { memo, useRef, useState } from 'react';
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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
} from '@mui/material';
import {
  Add as AddIcon,
  CloudUpload as CloudUploadIcon,
  DriveFolderUpload as FolderUploadIcon,
  Storage as StorageIcon,
  Home as HomeIcon,
  Schedule as RecentIcon,
  Star as StarredIcon,
  Delete as TrashIcon,
  CreateNewFolder as NewFolderIcon,
} from '@mui/icons-material';
import { useMutation } from '@apollo/client';
import { CREATE_FOLDER_MUTATION } from '../../apollo/queries';
import { useFileUpload } from '../../hooks/useFileUpload';
import { formatFileSize } from '../../utils/fileUtils';

const drawerWidth = 240;

interface NavigationItem {
  id: string;
  label: string;
  icon: React.ReactElement;
}

interface SharedDashboardSidebarProps {
  selectedNav: string;
  onNavChange: (navId: string) => void;
  statsData?: any;
  statsLoading: boolean;
  onUploadComplete?: () => void;
}

const SharedDashboardSidebar: React.FC<SharedDashboardSidebarProps> = ({
  selectedNav,
  onNavChange,
  statsData,
  statsLoading,
  onUploadComplete,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const [newFolderDialogOpen, setNewFolderDialogOpen] = useState(false);
  const [folderName, setFolderName] = useState('');
  const [newActionDialogOpen, setNewActionDialogOpen] = useState(false);

  const { handleFiles, processFile } = useFileUpload(onUploadComplete);
  const [createFolderMutation] = useMutation(CREATE_FOLDER_MUTATION);

  const handleFileUpload = () => {
    onNavChange('home');
    fileInputRef.current?.click();
  };

  const handleFolderUploadClick = () => {
    onNavChange('home');
    folderInputRef.current?.click();
  };

  const handleOpenNewAction = () => {
    setNewActionDialogOpen(true);
  };

  const handleCloseNewAction = () => {
    setNewActionDialogOpen(false);
  };

  const handleUploadFiles = () => {
    setNewActionDialogOpen(false);
    handleFileUpload();
  };

  const handleUploadFolders = () => {
    setNewActionDialogOpen(false);
    handleFolderUploadClick();
  };

  const handleCreateNewFolder = () => {
    setNewActionDialogOpen(false);
    handleNewFolder();
  };

  const handleFileInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      handleFiles(Array.from(files));
    }
    // Reset the input so the same file can be selected again
    event.target.value = '';
  };

  const handleFolderInputChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      await handleFolderUpload(Array.from(files));
    }
    // Reset the input so the same file can be selected again
    event.target.value = '';
  };

  const handleFolderUpload = async (files: File[]) => {
    if (!files || files.length === 0) return;

    // Group files by their directory structure
    const folderStructure: { [path: string]: File[] } = {};
    const folderPaths = new Set<string>();

    for (const file of files) {
      const relativePath = (file as any).webkitRelativePath;
      if (!relativePath) continue; // Skip if no path

      const pathParts = relativePath.split('/');
      const fileName = pathParts.pop()!; // Remove filename
      const folderPath = pathParts.join('/');

      if (folderPath) {
        folderPaths.add(folderPath);
      }

      if (!folderStructure[folderPath]) {
        folderStructure[folderPath] = [];
      }
      folderStructure[folderPath].push(file);
    }

    // Create folders recursively
    const createdFolders: { [path: string]: string } = {}; // path -> folderId

    const createFolderRecursive = async (path: string): Promise<string> => {
      if (createdFolders[path]) return createdFolders[path];

      const parts = path.split('/');
      let currentPath = '';
      let parentId: string | undefined;

      for (const part of parts) {
        currentPath = currentPath ? `${currentPath}/${part}` : part;

        if (!createdFolders[currentPath]) {
          try {
            const result = await createFolderMutation({
              variables: {
                input: {
                  name: part,
                  parent_id: parentId,
                },
              },
            });
            const folderId = result.data?.createFolder?.id;
            if (folderId) {
              createdFolders[currentPath] = folderId;
              parentId = folderId;
            }
          } catch (error) {
            console.error('Error creating folder:', part, error);
            // Continue with next
          }
        } else {
          parentId = createdFolders[currentPath];
        }
      }

      return createdFolders[path] || '';
    };

    // Create all folders
    for (const path of Array.from(folderPaths).sort()) {
      await createFolderRecursive(path);
    }

    // Upload files to their folders
    for (const [folderPath, folderFiles] of Object.entries(folderStructure)) {
      const folderId = createdFolders[folderPath];
      for (const file of folderFiles) {
        // Upload file with folder_id
        await processFile(file, folderId);
      }
    }
  };

  const handleNewFolder = () => {
    setNewFolderDialogOpen(true);
  };

  const handleCreateFolder = async () => {
    if (!folderName.trim()) return;

    try {
      await createFolderMutation({
        variables: {
          input: {
            name: folderName.trim(),
          },
        },
      });
      setFolderName('');
      setNewFolderDialogOpen(false);
      if (onUploadComplete) {
        onUploadComplete();
      }
    } catch (error) {
      console.error('Error creating folder:', error);
    }
  };

  const handleCancelFolder = () => {
    setFolderName('');
    setNewFolderDialogOpen(false);
  };


  // Navigation items WITHOUT shared tab
  const navigationItems: NavigationItem[] = [
    { id: 'home', label: 'Home', icon: <HomeIcon /> },
    { id: 'recent', label: 'Recent', icon: <RecentIcon /> },
    { id: 'starred', label: 'Starred', icon: <StarredIcon /> },
    { id: 'trash', label: 'Trash', icon: <TrashIcon /> },
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
        {/* New Button */}
        <Button
          fullWidth
          variant="contained"
          onClick={handleOpenNewAction}
          sx={{
            mb: 2,
            backgroundColor: '#3b82f6',
            color: 'white',
            borderRadius: 2,
            textTransform: 'none',
            fontWeight: 600,
            py: 1.5,
            '&:hover': {
              backgroundColor: '#2563eb',
            }
          }}
        >
          <AddIcon sx={{ mr: 1 }} />
          New
        </Button>

        {/* New Action Dialog */}
        <Dialog open={newActionDialogOpen} onClose={handleCloseNewAction} maxWidth="sm" fullWidth>
          <DialogTitle>What would you like to do?</DialogTitle>
          <DialogContent>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
              <Button
                variant="outlined"
                startIcon={<CloudUploadIcon />}
                onClick={handleUploadFiles}
                sx={{
                  justifyContent: 'flex-start',
                  textTransform: 'none',
                  borderColor: '#d1d5db',
                  color: '#6b7280',
                  '&:hover': {
                    borderColor: '#3b82f6',
                    backgroundColor: '#eff6ff'
                  }
                }}
              >
                Upload files
              </Button>
              <Button
                variant="outlined"
                startIcon={<FolderUploadIcon />}
                onClick={handleUploadFolders}
                sx={{
                  justifyContent: 'flex-start',
                  textTransform: 'none',
                  borderColor: '#d1d5db',
                  color: '#6b7280',
                  '&:hover': {
                    borderColor: '#3b82f6',
                    backgroundColor: '#eff6ff'
                  }
                }}
              >
                Upload folders
              </Button>
              <Button
                variant="outlined"
                startIcon={<NewFolderIcon />}
                onClick={handleCreateNewFolder}
                sx={{
                  justifyContent: 'flex-start',
                  textTransform: 'none',
                  borderColor: '#d1d5db',
                  color: '#6b7280',
                  '&:hover': {
                    borderColor: '#3b82f6',
                    backgroundColor: '#eff6ff'
                  }
                }}
              >
                Create new folder
              </Button>
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseNewAction}>Cancel</Button>
          </DialogActions>
        </Dialog>

        {/* Navigation */}
        <List sx={{ py: 0 }}>
          {navigationItems.map((item) => (
            <ListItem key={item.id} disablePadding sx={{ mb: 0.5 }}>
              <ListItemButton
                selected={selectedNav === item.id}
                onClick={() => onNavChange(item.id)}
                sx={{
                  borderRadius: 2,
                  py: 1.5,
                  '&.Mui-selected': {
                    backgroundColor: '#eff6ff',
                    color: '#3b82f6',
                    '&:hover': {
                      backgroundColor: '#dbeafe',
                    },
                    '& .MuiListItemIcon-root': {
                      color: '#3b82f6',
                    }
                  },
                  '&:hover': {
                    backgroundColor: '#f3f4f6',
                  }
                }}
              >
                <ListItemIcon sx={{ minWidth: 36, color: '#6b7280' }}>
                  {item.icon}
                </ListItemIcon>
                <ListItemText 
                  primary={item.label}
                  primaryTypographyProps={{
                    variant: 'body2',
                    fontWeight: selectedNav === item.id ? 600 : 500
                  }}
                />
              </ListItemButton>
            </ListItem>
          ))}
        </List>

        {/* Hidden file inputs */}
        <input
          type="file"
          multiple
          ref={fileInputRef}
          onChange={handleFileInputChange}
          style={{ display: 'none' }}
        />
        <input
          type="file"
          multiple
          {...{ webkitdirectory: '' }}
          ref={folderInputRef}
          onChange={handleFolderInputChange}
          style={{ display: 'none' }}
        />
      </Box>

      {/* Storage Stats - Fixed at bottom */}
      <Box sx={{ 
        position: 'sticky', 
        bottom: 0, 
        p: 2, 
        backgroundColor: '#ffffff',
        borderTop: '1px solid #e5e7eb'
      }}>
        <Paper sx={{
          p: 2,
          backgroundColor: '#f9fafb',
          border: '1px solid #e5e7eb',
          borderRadius: 2,
          boxShadow: 'none'
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
            <StorageIcon sx={{ fontSize: 16, color: '#6b7280', mr: 1 }} />
            <Typography variant="caption" sx={{ color: '#6b7280', fontWeight: 600 }}>
              STORAGE USAGE
            </Typography>
          </Box>
          {statsLoading ? (
            <LinearProgress sx={{ mb: 1, height: 2 }} />
          ) : statsData ? (
            <>
              <Box sx={{ mb: 1 }}>
                <Typography variant="body2" sx={{ fontWeight: 600, color: '#1f2937' }}>
                  {formatFileSize(statsData.myStats.used_storage)} of {formatFileSize(statsData.myStats.storage_quota)}
                </Typography>
              </Box>
              <LinearProgress
                variant="determinate"
                value={(statsData.myStats.used_storage / statsData.myStats.storage_quota) * 100}
                sx={{
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: '#e5e7eb',
                  '& .MuiLinearProgress-bar': {
                    borderRadius: 3,
                    backgroundColor: statsData.myStats.used_storage / statsData.myStats.storage_quota > 0.8 ? '#ef4444' : '#3b82f6'
                  }
                }}
              />
              <Typography variant="caption" sx={{ color: '#6b7280', mt: 0.5, display: 'block' }}>
                {Math.round((statsData.myStats.used_storage / statsData.myStats.storage_quota) * 100)}% used
              </Typography>
            </>
          ) : null}
        </Paper>

        {/* New Folder Dialog */}
        <Dialog
          open={newFolderDialogOpen}
          onClose={handleCancelFolder}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>Create New Folder</DialogTitle>
          <DialogContent>
            <TextField
              autoFocus
              margin="dense"
              label="Folder Name"
              fullWidth
              variant="outlined"
              value={folderName}
              onChange={(e) => setFolderName(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handleCreateFolder();
                }
              }}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCancelFolder}>Cancel</Button>
            <Button onClick={handleCreateFolder} variant="contained">
              Create
            </Button>
          </DialogActions>
        </Dialog>

      </Box>
    </Drawer>
  );
};

export default memo(SharedDashboardSidebar);