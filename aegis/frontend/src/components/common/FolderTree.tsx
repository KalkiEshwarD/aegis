import React, { useState, useCallback, memo, useEffect } from 'react';
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

interface FolderSelectionDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (destinationId: string | null) => void;
  folders: Folder[];
  folderToMove: Folder | null;
  currentParentId?: string | null;
  isMoving?: boolean;
  moveError?: string | null;
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

// Helper function to get all descendant folder IDs
const getDescendantIds = (folder: Folder): string[] => {
  const descendants: string[] = [];
  if (folder.children) {
    for (const child of folder.children) {
      descendants.push(child.id);
      descendants.push(...getDescendantIds(child));
    }
  }
  return descendants;
};

// Component for folder selection in move dialog
const FolderSelectionDialog: React.FC<FolderSelectionDialogProps> = ({
  open,
  onClose,
  onConfirm,
  folders,
  folderToMove,
  currentParentId,
  isMoving = false,
  moveError = null,
}) => {
  const [selectedDestinationId, setSelectedDestinationId] = useState<string | null>(null);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());

  // Reset selection when dialog opens
  useEffect(() => {
    if (open) {
      setSelectedDestinationId(null);
      setExpandedFolders(new Set());
    }
  }, [open]);

  if (!folderToMove) return null;

  // Get invalid destination IDs (folder itself, descendants, current parent)
  const invalidIds = new Set<string>();
  invalidIds.add(folderToMove.id); // Cannot move into itself
  getDescendantIds(folderToMove).forEach(id => invalidIds.add(id)); // Cannot move into descendants
  if (currentParentId) {
    invalidIds.add(currentParentId); // Cannot move to same location
  }

  const handleToggleExpand = (folderId: string) => {
    setExpandedFolders(prev => {
      const newSet = new Set(prev);
      if (newSet.has(folderId)) {
        newSet.delete(folderId);
      } else {
        newSet.add(folderId);
      }
      return newSet;
    });
  };

  const handleDestinationSelect = (folderId: string | null) => {
    if (folderId && invalidIds.has(folderId)) return;
    setSelectedDestinationId(folderId);
  };

  const handleConfirm = () => {
    onConfirm(selectedDestinationId);
  };

  const rootFolders = folders.filter(folder => !folder.parent_id);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Select Destination Folder</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Moving "{folderToMove.name}" to:
        </Typography>
        {moveError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {moveError}
          </Alert>
        )}
        <List sx={{ maxHeight: 300, overflow: 'auto' }}>
          {/* Root/Home folder */}
          <ListItem disablePadding>
            <ListItemButton
              selected={selectedDestinationId === null}
              disabled={invalidIds.has('root') || currentParentId === null}
              onClick={() => handleDestinationSelect(null)}
              sx={{
                borderRadius: 1,
                '&.Mui-selected': {
                  backgroundColor: '#eff6ff',
                  color: '#2563eb',
                },
                '&.Mui-disabled': {
                  opacity: 0.5,
                },
                '&:hover:not(.Mui-disabled)': {
                  backgroundColor: '#f8fafc',
                }
              }}
            >
              <ListItemIcon sx={{ minWidth: 32, color: '#6b7280' }}>
                <FolderIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText
                primary="Home (Root)"
                primaryTypographyProps={{
                  fontSize: '0.875rem',
                  fontWeight: selectedDestinationId === null ? 600 : 400,
                }}
              />
            </ListItemButton>
          </ListItem>

          {/* Folder tree */}
          {rootFolders.map((folder) => (
            <FolderSelectionTreeItem
              key={folder.id}
              folder={folder}
              level={1}
              expandedFolders={expandedFolders}
              selectedFolderId={selectedDestinationId}
              invalidIds={invalidIds}
              onToggleExpand={handleToggleExpand}
              onFolderSelect={handleDestinationSelect}
            />
          ))}

          {rootFolders.length === 0 && (
            <Typography variant="body2" color="text.secondary" sx={{ px: 2, py: 1 }}>
              No folders available
            </Typography>
          )}
        </List>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={isMoving}>
          Cancel
        </Button>
        <Button
          onClick={handleConfirm}
          color="primary"
          variant="contained"
          disabled={selectedDestinationId === currentParentId || isMoving}
          startIcon={isMoving ? <CircularProgress size={16} /> : null}
        >
          {isMoving ? 'Moving...' : 'Move Here'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// Tree item for folder selection (without context menu)
interface FolderSelectionTreeItemProps {
  folder: Folder;
  level: number;
  expandedFolders: Set<string>;
  selectedFolderId: string | null;
  invalidIds: Set<string>;
  onToggleExpand: (folderId: string) => void;
  onFolderSelect: (folderId: string | null) => void;
}

const FolderSelectionTreeItem: React.FC<FolderSelectionTreeItemProps> = ({
  folder,
  level,
  expandedFolders,
  selectedFolderId,
  invalidIds,
  onToggleExpand,
  onFolderSelect,
}) => {
  const isExpanded = expandedFolders.has(folder.id);
  const isSelected = selectedFolderId === folder.id;
  const isInvalid = invalidIds.has(folder.id);
  const hasChildren = folder.children && folder.children.length > 0;

  const handleClick = () => {
    if (isInvalid) return;
    if (hasChildren) {
      onToggleExpand(folder.id);
    }
    onFolderSelect(folder.id);
  };

  return (
    <>
      <ListItem disablePadding sx={{ pl: level * 2 }}>
        <ListItemButton
          selected={isSelected}
          disabled={isInvalid}
          onClick={handleClick}
          sx={{
            borderRadius: 1,
            '&.Mui-selected': {
              backgroundColor: '#eff6ff',
              color: '#2563eb',
            },
            '&.Mui-disabled': {
              opacity: 0.5,
            },
            '&:hover:not(.Mui-disabled)': {
              backgroundColor: '#f8fafc',
            }
          }}
        >
          {hasChildren && (
            <IconButton
              size="small"
              disabled={isInvalid}
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
        </ListItemButton>
      </ListItem>

      {hasChildren && (
        <Collapse in={isExpanded} timeout="auto" unmountOnExit>
          <List component="div" disablePadding>
            {folder.children.map((child) => (
              <FolderSelectionTreeItem
                key={child.id}
                folder={child}
                level={level + 1}
                expandedFolders={expandedFolders}
                selectedFolderId={selectedFolderId}
                invalidIds={invalidIds}
                onToggleExpand={onToggleExpand}
                onFolderSelect={onFolderSelect}
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
  const [folderSelectionDialogOpen, setFolderSelectionDialogOpen] = useState(false);
  const [folderToDelete, setFolderToDelete] = useState<Folder | null>(null);
  const [folderToMove, setFolderToMove] = useState<Folder | null>(null);
  const [moveError, setMoveError] = useState<string | null>(null);
  const [isMoving, setIsMoving] = useState(false);

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
    setFolderSelectionDialogOpen(true);
    handleCloseContextMenu();
  };

  const handleMoveConfirm = async (destinationId: string | null) => {
    if (!folderToMove) return;

    setIsMoving(true);
    setMoveError(null);

    try {
      await moveFolder({
        variables: {
          input: {
            id: folderToMove.id,
            parent_id: destinationId,
          },
        },
      });
      refetch();
      onRefresh?.();
      setFolderSelectionDialogOpen(false);
      setFolderToMove(null);
    } catch (error: any) {
      console.error('Error moving folder:', error);
      const errorMessage = error?.graphQLErrors?.[0]?.message ||
                          error?.networkError?.message ||
                          'Failed to move folder. Please try again.';
      setMoveError(errorMessage);
    } finally {
      setIsMoving(false);
    }
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
            Files can be restored from trash.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleDeleteConfirm} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Folder Selection Dialog for Move */}
      <FolderSelectionDialog
        open={folderSelectionDialogOpen}
        onClose={() => {
          setFolderSelectionDialogOpen(false);
          setMoveError(null);
        }}
        onConfirm={handleMoveConfirm}
        folders={data?.myFolders || []}
        folderToMove={folderToMove}
        currentParentId={folderToMove?.parent_id || null}
        isMoving={isMoving}
        moveError={moveError}
      />
    </>
  );
};

export default memo(FolderTree);