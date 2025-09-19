import React, { useState, useCallback, memo } from 'react';
import {
  Box,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemButton,
  Collapse,
  IconButton,
  Menu,
  MenuItem,
  Typography,
  CircularProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
} from '@mui/material';
import {
  Folder as FolderIcon,
  FolderOpen as FolderOpenIcon,
  ChevronRight as ChevronRightIcon,
  ExpandMore as ExpandMoreIcon,
  CreateNewFolder as CreateNewFolderIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  ContentCut as MoveIcon,
  MoreVert as MoreVertIcon,
} from '@mui/icons-material';
import { useQuery, useMutation } from '@apollo/client';
import { GET_MY_FOLDERS, CREATE_FOLDER_MUTATION, RENAME_FOLDER_MUTATION, DELETE_FOLDER_MUTATION, MOVE_FOLDER_MUTATION } from '../../apollo/folders';
import { Folder } from '../../types';

interface FolderTreeProps {
  selectedFolderId?: string | null;
  onFolderSelect: (folderId: string | null) => void;
  onRefresh?: () => void;
}

interface FolderTreeItemProps {
  folder: Folder;
  level: number;
  expandedFolders: Set<string>;
  selectedFolderId?: string | null;
  onToggleExpand: (folderId: string) => void;
  onFolderSelect: (folderId: string | null) => void;
  onContextMenu: (event: React.MouseEvent, folder: Folder) => void;
}

const FolderTreeItem: React.FC<FolderTreeItemProps> = ({
  folder,
  level,
  expandedFolders,
  selectedFolderId,
  onToggleExpand,
  onFolderSelect,
  onContextMenu,
}) => {
  const isExpanded = expandedFolders.has(folder.id);
  const isSelected = selectedFolderId === folder.id;
  const hasChildren = folder.children && folder.children.length > 0;

  const handleClick = () => {
    if (hasChildren) {
      onToggleExpand(folder.id);
    }
    onFolderSelect(folder.id);
  };

  const handleRightClick = (event: React.MouseEvent) => {
    event.preventDefault();
    onContextMenu(event, folder);
  };

  return (
    <>
      <ListItem disablePadding sx={{ pl: level * 2 }}>
        <ListItemButton
          selected={isSelected}
          onClick={handleClick}
          onContextMenu={handleRightClick}
          sx={{
            borderRadius: 1,
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
          {hasChildren && (
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                onToggleExpand(folder.id);
              }}
              sx={{ mr: 0.5, p: 0.5 }}
            >
              {isExpanded ? <ExpandMoreIcon fontSize="small" /> : <ChevronRightIcon fontSize="small" />}
            </IconButton>
          )}
          {!hasChildren && <Box sx={{ width: 24, mr: 0.5 }} />}
          <ListItemIcon sx={{ minWidth: 32, color: '#6b7280' }}>
            {isExpanded ? <FolderOpenIcon fontSize="small" /> : <FolderIcon fontSize="small" />}
          </ListItemIcon>
          <ListItemText
            primary={folder.name}
            primaryTypographyProps={{
              fontSize: '0.875rem',
              fontWeight: isSelected ? 600 : 400,
              noWrap: true,
            }}
          />
          <IconButton
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              onContextMenu(e, folder);
            }}
            sx={{ opacity: 0.6, '&:hover': { opacity: 1 } }}
          >
            <MoreVertIcon fontSize="small" />
          </IconButton>
        </ListItemButton>
      </ListItem>

      {hasChildren && (
        <Collapse in={isExpanded} timeout="auto" unmountOnExit>
          <List component="div" disablePadding>
            {folder.children.map((child) => (
              <FolderTreeItem
                key={child.id}
                folder={child}
                level={level + 1}
                expandedFolders={expandedFolders}
                selectedFolderId={selectedFolderId}
                onToggleExpand={onToggleExpand}
                onFolderSelect={onFolderSelect}
                onContextMenu={onContextMenu}
              />
            ))}
          </List>
        </Collapse>
      )}
    </>
  );
};

const FolderTree: React.FC<FolderTreeProps> = ({
  selectedFolderId,
  onFolderSelect,
  onRefresh,
}) => {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [contextMenu, setContextMenu] = useState<{
    mouseX: number;
    mouseY: number;
    folder: Folder | null;
  } | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [moveDialogOpen, setMoveDialogOpen] = useState(false);
  const [folderToDelete, setFolderToDelete] = useState<Folder | null>(null);
  const [folderToMove, setFolderToMove] = useState<Folder | null>(null);

  const { data, loading, error, refetch } = useQuery(GET_MY_FOLDERS, {
    fetchPolicy: 'cache-and-network',
  });

  const [createFolder] = useMutation(CREATE_FOLDER_MUTATION);
  const [renameFolder] = useMutation(RENAME_FOLDER_MUTATION);
  const [deleteFolder] = useMutation(DELETE_FOLDER_MUTATION);
  const [moveFolder] = useMutation(MOVE_FOLDER_MUTATION);

  const handleToggleExpand = useCallback((folderId: string) => {
    setExpandedFolders(prev => {
      const newSet = new Set(prev);
      if (newSet.has(folderId)) {
        newSet.delete(folderId);
      } else {
        newSet.add(folderId);
      }
      return newSet;
    });
  }, []);

  const handleContextMenu = (event: React.MouseEvent, folder: Folder) => {
    event.preventDefault();
    setContextMenu({
      mouseX: event.clientX - 2,
      mouseY: event.clientY - 4,
      folder,
    });
  };

  const handleCloseContextMenu = () => {
    setContextMenu(null);
  };

  const handleCreateFolder = async () => {
    if (!contextMenu?.folder) return;

    const folderName = prompt('Enter folder name:');
    if (!folderName?.trim()) return;

    try {
      await createFolder({
        variables: {
          input: {
            name: folderName.trim(),
            parent_id: contextMenu.folder.id,
          },
        },
      });
      refetch();
      onRefresh?.();
    } catch (error) {
      console.error('Error creating folder:', error);
      alert('Failed to create folder');
    }
    handleCloseContextMenu();
  };

  const handleRenameFolder = async () => {
    if (!contextMenu?.folder) return;

    const newName = prompt('Enter new folder name:', contextMenu.folder.name);
    if (!newName?.trim() || newName === contextMenu.folder.name) return;

    try {
      await renameFolder({
        variables: {
          input: {
            id: contextMenu.folder.id,
            name: newName.trim(),
          },
        },
      });
      refetch();
      onRefresh?.();
    } catch (error) {
      console.error('Error renaming folder:', error);
      alert('Failed to rename folder');
    }
    handleCloseContextMenu();
  };

  const handleDeleteFolder = () => {
    if (!contextMenu?.folder) return;
    setFolderToDelete(contextMenu.folder);
    setDeleteDialogOpen(true);
    handleCloseContextMenu();
  };

  const handleDeleteConfirm = async () => {
    if (!folderToDelete) return;

    try {
      await deleteFolder({
        variables: { id: folderToDelete.id },
      });
      refetch();
      onRefresh?.();
      if (selectedFolderId === folderToDelete.id) {
        onFolderSelect(null);
      }
    } catch (error) {
      console.error('Error deleting folder:', error);
      alert('Failed to delete folder');
    }
    setDeleteDialogOpen(false);
    setFolderToDelete(null);
  };

  const handleMoveFolder = () => {
    if (!contextMenu?.folder) return;
    setFolderToMove(contextMenu.folder);
    setMoveDialogOpen(true);
    handleCloseContextMenu();
  };

  const handleMoveConfirm = async () => {
    if (!folderToMove) return;

    try {
      await moveFolder({
        variables: {
          input: {
            id: folderToMove.id,
            parent_id: null,
          },
        },
      });
      refetch();
      onRefresh?.();
    } catch (error) {
      console.error('Error moving folder:', error);
      alert('Failed to move folder');
    }
    setMoveDialogOpen(false);
    setFolderToMove(null);
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
        <CircularProgress size={24} />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ m: 2 }}>
        Failed to load folders
      </Alert>
    );
  }

  const rootFolders = data?.myFolders?.filter((folder: Folder) => !folder.parent_id) || [];

  return (
    <>
      <List sx={{ px: 0 }}>
        {/* Root/Home folder */}
        <ListItem disablePadding>
          <ListItemButton
            selected={!selectedFolderId}
            onClick={() => onFolderSelect(null)}
            sx={{
              borderRadius: 1,
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
            <ListItemIcon sx={{ minWidth: 32, color: '#6b7280' }}>
              <FolderIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText
              primary="Home"
              primaryTypographyProps={{
                fontSize: '0.875rem',
                fontWeight: !selectedFolderId ? 600 : 400,
              }}
            />
          </ListItemButton>
        </ListItem>

        {/* Folder tree */}
        {rootFolders.map((folder: Folder) => (
          <FolderTreeItem
            key={folder.id}
            folder={folder}
            level={1}
            expandedFolders={expandedFolders}
            selectedFolderId={selectedFolderId}
            onToggleExpand={handleToggleExpand}
            onFolderSelect={onFolderSelect}
            onContextMenu={handleContextMenu}
          />
        ))}

        {rootFolders.length === 0 && (
          <Typography variant="body2" color="text.secondary" sx={{ px: 2, py: 1 }}>
            No folders yet
          </Typography>
        )}
      </List>

      {/* Context Menu */}
      <Menu
        open={contextMenu !== null}
        onClose={handleCloseContextMenu}
        anchorReference="anchorPosition"
        anchorPosition={
          contextMenu !== null
            ? { top: contextMenu.mouseY, left: contextMenu.mouseX }
            : undefined
        }
      >
        <MenuItem onClick={handleCreateFolder}>
          <CreateNewFolderIcon sx={{ mr: 1, fontSize: 18 }} />
          New Folder
        </MenuItem>
        <MenuItem onClick={handleRenameFolder}>
          <EditIcon sx={{ mr: 1, fontSize: 18 }} />
          Rename
        </MenuItem>
        <MenuItem onClick={handleMoveFolder}>
          <MoveIcon sx={{ mr: 1, fontSize: 18 }} />
          Move
        </MenuItem>
        <MenuItem onClick={handleDeleteFolder} sx={{ color: 'error.main' }}>
          <DeleteIcon sx={{ mr: 1, fontSize: 18 }} />
          Delete
        </MenuItem>
      </Menu>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Delete Folder</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete "{folderToDelete?.name}" and all its contents?
            This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleDeleteConfirm} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Move Confirmation Dialog */}
      <Dialog open={moveDialogOpen} onClose={() => setMoveDialogOpen(false)}>
        <DialogTitle>Move Folder</DialogTitle>
        <DialogContent>
          <Typography>
            Move "{folderToMove?.name}" to root folder?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMoveDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleMoveConfirm} color="primary" variant="contained">
            Move
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default memo(FolderTree);