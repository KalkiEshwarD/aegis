import React, { memo, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
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
  Home as HomeIcon,
  Schedule as RecentIcon,
  Share as SharedIcon,
  Star as StarredIcon,
  Delete as TrashIcon,
  CreateNewFolder as NewFolderIcon,
  Group as RoomsIcon,
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

interface DashboardSidebarProps {
  selectedNav: string;
  onNavChange: (navId: string) => void;
  statsData?: any;
  statsLoading: boolean;
  onUploadComplete?: () => void;
}

const DashboardSidebar: React.FC<DashboardSidebarProps> = ({
  selectedNav,
  onNavChange,
  statsData,
  statsLoading,
  onUploadComplete,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const [newFolderDialogOpen, setNewFolderDialogOpen] = useState(false);
  const [newDialogOpen, setNewDialogOpen] = useState(false);
  const [folderName, setFolderName] = useState('');

  const activeTab = location.pathname === '/shared' ? 'shared' : selectedNav;

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
  const navigationItems: NavigationItem[] = [
    { id: 'home', label: 'Home', icon: <HomeIcon /> },
    { id: 'recent', label: 'Recent', icon: <RecentIcon /> },
    { id: 'shared', label: 'Shared', icon: <SharedIcon /> },
    { id: 'rooms', label: 'Rooms', icon: <RoomsIcon /> },
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
          boxShadow: 'none',
          display: 'flex',
          flexDirection: 'column',
          pb: 2
        },
      }}
    >
      <Toolbar />
      <Box sx={{ flex: 1, overflow: 'auto', px: 2, pt: 2, pb: 1 }}>
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
        }} onClick={() => setNewDialogOpen(true)}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <AddIcon sx={{ mr: 1, fontSize: 20 }} />
            <Typography variant="body2" fontWeight={600}>
              New
            </Typography>
          </Box>
        </Paper>

        {/* Navigation */}
        <List sx={{ px: 0 }}>
          {navigationItems.map((item) => (
            <ListItem key={item.id} disablePadding sx={{ mb: 0.5 }}>
              <ListItemButton
                selected={activeTab === item.id}
                onClick={() => {
                  if (item.id === 'shared') {
                    navigate('/shared');
                  } else {
                    navigate('/dashboard', { state: { selectedNav: item.id } });
                  }
                }}
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
                    fontWeight: activeTab === item.id ? 600 : 400
                  }}
                />
              </ListItemButton>
            </ListItem>
          ))}
        </List>

        <Divider sx={{ my: 2 }} />

        {/* Hidden file inputs */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileInputChange}
          multiple
          style={{ display: 'none' }}
          accept="*/*"
        />
        <input
          type="file"
          ref={folderInputRef}
          onChange={handleFolderInputChange}
          multiple
          {...{ webkitdirectory: '' }}
          style={{ display: 'none' }}
        />

        {/* New Folder Dialog */}
        <Dialog open={newFolderDialogOpen} onClose={handleCancelFolder} maxWidth="sm" fullWidth>
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
            <Button onClick={handleCancelFolder} color="inherit">
              Cancel
            </Button>
            <Button onClick={handleCreateFolder} variant="contained" disabled={!folderName.trim()}>
              Create
            </Button>
          </DialogActions>
        </Dialog>

        {/* New Dialog */}
        <Dialog open={newDialogOpen} onClose={() => setNewDialogOpen(false)} maxWidth="sm" fullWidth>
          <DialogContent>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, p: 2 }}>
              <Button
                onClick={() => { setNewDialogOpen(false); handleFileUpload(); }}
                variant="text"
                fullWidth
                size="large"
                startIcon={<CloudUploadIcon />}
                sx={{
                  py: 1.5,
                  backgroundColor: 'white',
                  color: '#6b7280',
                  border: '1px solid #e5e7eb',
                  '&:hover': {
                    backgroundColor: '#f9fafb',
                    borderColor: '#d1d5db'
                  },
                  justifyContent: 'flex-start',
                  textTransform: 'none'
                }}
              >
                Upload files
              </Button>
              <Button
                onClick={() => { setNewDialogOpen(false); handleFolderUploadClick(); }}
                variant="text"
                fullWidth
                size="large"
                startIcon={<FolderUploadIcon />}
                sx={{
                  py: 1.5,
                  backgroundColor: 'white',
                  color: '#6b7280',
                  border: '1px solid #e5e7eb',
                  '&:hover': {
                    backgroundColor: '#f9fafb',
                    borderColor: '#d1d5db'
                  },
                  justifyContent: 'flex-start',
                  textTransform: 'none'
                }}
              >
                Upload folders
              </Button>
              <Button
                onClick={() => { setNewDialogOpen(false); handleNewFolder(); }}
                variant="text"
                fullWidth
                size="large"
                startIcon={<NewFolderIcon />}
                sx={{
                  py: 1.5,
                  backgroundColor: 'white',
                  color: '#6b7280',
                  border: '1px solid #e5e7eb',
                  '&:hover': {
                    backgroundColor: '#f9fafb',
                    borderColor: '#d1d5db'
                  },
                  justifyContent: 'flex-start',
                  textTransform: 'none'
                }}
              >
                New Folder
              </Button>
            </Box>
          </DialogContent>
        </Dialog>
      </Box>

      {/* Storage Info */}
      <Box sx={{ p: 2, backgroundColor: '#f8fafc', borderRadius: 3, border: '1px solid #e5e7eb', mx: 2, mb: 1 }}>
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
    </Drawer>
  );
};

export default memo(DashboardSidebar);