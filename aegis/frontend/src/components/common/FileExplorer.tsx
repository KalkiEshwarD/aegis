import React, { useState, useCallback, useRef, memo, useMemo, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Menu,
  MenuItem,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Snackbar,
} from '@mui/material';
import {
  Download as DownloadIcon,
  Delete as DeleteIcon,
  CloudUpload as CloudUploadIcon,
  Folder as FolderIcon,
  Edit as EditIcon,
} from '@mui/icons-material';
import { useQuery, useMutation } from '@apollo/client';
import { GET_MY_FILES, MOVE_FILE_MUTATION } from '../../apollo/files';
import { GET_MY_FOLDERS, CREATE_FOLDER_MUTATION, RENAME_FOLDER_MUTATION, MOVE_FOLDER_MUTATION, DELETE_FOLDER_MUTATION } from '../../apollo/folders';
import { UserFile, Folder, FileExplorerItem, isFolder, isFile } from '../../types';
import { useFileOperations } from '../../hooks/useFileOperations';
import { useFileUpload } from '../../hooks/useFileUpload';
import { useFileSorting } from '../../hooks/useFileSorting';
import FileGrid from './FileGrid';
import FileToolbar from './FileToolbar';
import UploadProgress from './UploadProgress';

interface FileExplorerProps {
  folderId?: string | null;
  onFileDeleted?: () => void;
  onUploadComplete?: () => void;
  onFolderClick?: (folderId: string) => void;
}

const FileExplorer: React.FC<FileExplorerProps> = ({
  folderId,
  onFileDeleted,
  onUploadComplete,
  onFolderClick,
}) => {
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [contextMenu, setContextMenu] = useState<{
    mouseX: number;
    mouseY: number;
    fileId: string;
  } | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [fileToDelete, setFileToDelete] = useState<UserFile | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [createFolderDialogOpen, setCreateFolderDialogOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [folderCreationError, setFolderCreationError] = useState<string | null>(null);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [renameItem, setRenameItem] = useState<FileExplorerItem | null>(null);
  const [newItemName, setNewItemName] = useState('');
  const [renameError, setRenameError] = useState<string | null>(null);
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);
  const [cutItems, setCutItems] = useState<Set<string>>(new Set());
  const [snackbarMessage, setSnackbarMessage] = useState<string>('');
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const { data, error: queryError, refetch } = useQuery(GET_MY_FILES, {
    variables: {
      filter: {
        // Temporarily disable folder_id filtering due to GraphQL schema issues
        // folder_id: folderId || undefined
      }
    },
    fetchPolicy: 'cache-and-network',
  });

  const { data: foldersData, refetch: refetchFolders } = useQuery(GET_MY_FOLDERS, {
    fetchPolicy: 'cache-and-network',
  });

  const [moveFileMutation] = useMutation(MOVE_FILE_MUTATION);
  const [createFolderMutation] = useMutation(CREATE_FOLDER_MUTATION);
  const [renameFolderMutation] = useMutation(RENAME_FOLDER_MUTATION);
  const [moveFolderMutation] = useMutation(MOVE_FOLDER_MUTATION);
  const [deleteFolderMutation] = useMutation(DELETE_FOLDER_MUTATION);

  // Filter folders based on current folderId
  const currentFolders = useMemo(() => {
    return foldersData?.myFolders?.filter((folder: Folder) => {
      // First filter out null/undefined items
      if (!folder) return false;

      if (folderId) {
        // In a specific folder, show its children
        return folder.parent_id === folderId;
      } else {
        // In root, show folders with no parent
        return !folder.parent_id;
      }
    }) || [];
  }, [foldersData?.myFolders, folderId]);

  // Client-side filter files by folder_id (temporary workaround for GraphQL issue)
  const filteredFiles = useMemo(() => {
    if (!data?.myFiles) return [];
    
    return data.myFiles.filter((file: UserFile) => {
      // Filter out null/undefined items for data integrity
      if (!file || !file.id) return false;
      
      if (folderId) {
        // Show files that belong to the current folder
        return file.folder_id === folderId;
      } else {
        // Show files that are in root (no folder_id or null)
        return !file.folder_id;
      }
    });
  }, [data?.myFiles, folderId]);

  // Use custom hooks
  const { downloadingFile, error, downloadFile, deleteFile } = useFileOperations();
  const { uploads, handleFiles, removeUpload, clearCompleted } = useFileUpload(onUploadComplete);
  const {
    filter,
    sortBy,
    sortDirection,
    sortedFiles,
    handleFilterChange,
    handleSortChange,
    toggleSortDirection
  } = useFileSorting(filteredFiles);

  // Combine folders and files for display
  const allItems: FileExplorerItem[] = [...currentFolders, ...sortedFiles];

  // File operations handlers
  const handleDownload = useCallback(async (file: UserFile) => {
    await downloadFile(file);
  }, [downloadFile]);

  const handleDeleteClick = useCallback((file: UserFile) => {
    setFileToDelete(file);
    setDeleteDialogOpen(true);
    setContextMenu(null);
  }, []);

  // Handle file selection
  const handleFileClick = (fileId: string, event: React.MouseEvent) => {
    if (event.ctrlKey || event.metaKey) {
      setSelectedFiles(prev => {
        const newSet = new Set(prev);
        if (newSet.has(fileId)) {
          newSet.delete(fileId);
        } else {
          newSet.add(fileId);
        }
        return newSet;
      });
    } else {
      setSelectedFiles(new Set([fileId]));
    }
  };

  // Context menu handlers
  const handleContextMenu = (event: React.MouseEvent, fileId: string) => {
    event.preventDefault();
    setContextMenu({
      mouseX: event.clientX - 2,
      mouseY: event.clientY - 4,
      fileId,
    });
  };

  const handleContextMenuClose = () => {
    setContextMenu(null);
  };

  const handleDeleteConfirm = useCallback(async () => {
    if (!fileToDelete) return;

    const success = await deleteFile(fileToDelete);
    if (success) {
      setDeleteDialogOpen(false);
      setFileToDelete(null);
      setSelectedFiles(prev => {
        const newSet = new Set(prev);
        newSet.delete(fileToDelete.id);
        return newSet;
      });

      refetch();
      refetchFolders();
      if (onFileDeleted) {
        onFileDeleted();
      }
    }
  }, [fileToDelete, deleteFile, refetch, refetchFolders, onFileDeleted]);

  // Drag and drop handlers
  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(async (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragOver(false);

    const files = Array.from(event.dataTransfer.files);
    if (files.length > 0) {
      await handleFiles(files);
    }
  }, [handleFiles]);

  // Handle file move via drag and drop
  const handleFileMove = useCallback(async (fileIds: string[], targetFolderId: string | null) => {
    try {
      // Check if any file is already in the target folder
      const currentFiles = data?.myFiles || [];
      const filesToMove = currentFiles.filter((file: UserFile) => fileIds.includes(file.id));

      // Filter out files that are already in the target folder
      const filesToActuallyMove = filesToMove.filter((file: UserFile) => file.folder_id !== targetFolderId);

      if (filesToActuallyMove.length === 0) {
        console.log('Files are already in the target folder');
        return;
      }

      // Move each file
      for (const file of filesToActuallyMove) {
        await moveFileMutation({
          variables: {
            input: {
              id: file.id,
              folder_id: targetFolderId,
            },
          },
        });
      }

      // Refetch data to update UI
      refetch();
      refetchFolders();

      if (onUploadComplete) {
        onUploadComplete();
      }
    } catch (error: any) {
      console.error('Error moving files:', error);
      // Note: The error state is managed by useFileOperations hook, but we could add a separate error state here
      // For now, we'll rely on the existing error display mechanism
    }
  }, [moveFileMutation, data?.myFiles, refetch, refetchFolders, onUploadComplete]);

  // Folder creation handlers
  const handleCreateFolderClick = useCallback(() => {
    setNewFolderName('');
    setFolderCreationError(null);
    setCreateFolderDialogOpen(true);
  }, []);

  const handleCreateFolderConfirm = useCallback(async () => {
    if (!newFolderName.trim()) {
      setFolderCreationError('Folder name cannot be empty');
      return;
    }

    // Check for duplicate folder names in current folder
    const isDuplicate = currentFolders.some((folder: Folder) =>
      folder.name.toLowerCase() === newFolderName.trim().toLowerCase()
    );

    if (isDuplicate) {
      setFolderCreationError('A folder with this name already exists');
      return;
    }

    try {
      await createFolderMutation({
        variables: {
          input: {
            name: newFolderName.trim(),
            parent_id: folderId || undefined,
          },
        },
      });

      // Close dialog and reset state
      setCreateFolderDialogOpen(false);
      setNewFolderName('');
      setFolderCreationError(null);

      // Refetch data to update UI
      refetch();
      refetchFolders();

      if (onUploadComplete) {
        onUploadComplete();
      }
    } catch (error: any) {
      console.error('Error creating folder:', error);
      setFolderCreationError(error.message || 'Failed to create folder');
    }
  }, [newFolderName, currentFolders, folderId, createFolderMutation, refetch, refetchFolders, onUploadComplete]);

  const handleCreateFolderCancel = useCallback(() => {
     setCreateFolderDialogOpen(false);
     setNewFolderName('');
     setFolderCreationError(null);
   }, []);

  // Keyboard navigation and shortcuts
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    const { key, ctrlKey, metaKey, shiftKey } = event;
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const cmdOrCtrl = isMac ? metaKey : ctrlKey;

    // Prevent default browser shortcuts
    if (cmdOrCtrl && (key === 'n' || key === 'x' || key === 'v')) {
      event.preventDefault();
    }

    switch (key) {
      case 'ArrowUp':
      case 'ArrowDown':
      case 'ArrowLeft':
      case 'ArrowRight':
        event.preventDefault();
        handleArrowNavigation(key, shiftKey);
        break;
      case 'Enter':
        event.preventDefault();
        handleEnterKey();
        break;
      case 'F2':
        event.preventDefault();
        handleRenameKey();
        break;
      case 'Delete':
      case 'Backspace':
        event.preventDefault();
        handleDeleteKey();
        break;
      case 'n':
      case 'N':
        if (cmdOrCtrl) {
          event.preventDefault();
          handleCreateFolderClick();
          setSnackbarMessage('Create folder shortcut used');
          setSnackbarOpen(true);
        }
        break;
      case 'x':
      case 'X':
        if (cmdOrCtrl) {
          event.preventDefault();
          handleCutKey();
        }
        break;
      case 'v':
      case 'V':
        if (cmdOrCtrl) {
          event.preventDefault();
          handlePasteKey();
        }
        break;
    }
  }, [focusedIndex, selectedFiles, cutItems]);

  const handleArrowNavigation = useCallback((direction: string, shiftKey: boolean) => {
    if (allItems.length === 0) return;

    let newIndex = focusedIndex;

    // Calculate grid dimensions (assuming responsive grid)
    const itemsPerRow = Math.floor(800 / 140) || 1; // Approximate based on FileGrid

    switch (direction) {
      case 'ArrowUp':
        newIndex = Math.max(0, focusedIndex - itemsPerRow);
        break;
      case 'ArrowDown':
        newIndex = Math.min(allItems.length - 1, focusedIndex + itemsPerRow);
        break;
      case 'ArrowLeft':
        newIndex = Math.max(0, focusedIndex - 1);
        break;
      case 'ArrowRight':
        newIndex = Math.min(allItems.length - 1, focusedIndex + 1);
        break;
    }

    setFocusedIndex(newIndex);
    // Update selection if shift is not pressed
    if (!shiftKey) {
      setSelectedFiles(new Set([allItems[newIndex].id]));
    }
  }, [allItems, focusedIndex]);

  const handleEnterKey = useCallback(() => {
    if (focusedIndex >= 0 && focusedIndex < allItems.length) {
      const item = allItems[focusedIndex];
      if (isFolder(item) && onFolderClick) {
        onFolderClick(item.id);
      } else if (isFile(item)) {
        // For files, just select it (could be extended to open/download)
        setSelectedFiles(new Set([item.id]));
      }
    }
  }, [allItems, focusedIndex, onFolderClick]);

  const handleRenameKey = useCallback(() => {
    const selectedItemIds = Array.from(selectedFiles);
    if (selectedItemIds.length === 1) {
      const item = allItems.find(i => i.id === selectedItemIds[0]);
      if (item) {
        setRenameItem(item);
        setNewItemName(isFolder(item) ? item.name : (item as UserFile).filename);
        setRenameError(null);
        setRenameDialogOpen(true);
      }
    }
  }, [selectedFiles, allItems]);

  const handleDeleteKey = useCallback(() => {
    const selectedItemIds = Array.from(selectedFiles);
    if (selectedItemIds.length === 1) {
      const item = allItems.find(i => i.id === selectedItemIds[0]);
      if (item) {
        if (isFile(item)) {
          handleDeleteClick(item as UserFile);
        } else if (isFolder(item)) {
          // Handle folder deletion
          handleDeleteFolder(item as Folder);
        }
      }
    }
  }, [selectedFiles, allItems]);

  const handleCutKey = useCallback(() => {
    const selectedItemIds = Array.from(selectedFiles);
    if (selectedItemIds.length > 0) {
      setCutItems(new Set(selectedItemIds));
      setSnackbarMessage(`${selectedItemIds.length} item(s) cut`);
      setSnackbarOpen(true);
    }
  }, [selectedFiles]);

  const handlePasteKey = useCallback(async () => {
    if (cutItems.size === 0) return;

    try {
      const cutItemIds = Array.from(cutItems);
      for (const itemId of cutItemIds) {
        const item = allItems.find(i => i.id === itemId);
        if (!item) continue;

        if (isFile(item)) {
          await moveFileMutation({
            variables: {
              input: {
                id: item.id,
                folder_id: folderId,
              },
            },
          });
        } else if (isFolder(item)) {
          await moveFolderMutation({
            variables: {
              input: {
                id: item.id,
                parent_id: folderId,
              },
            },
          });
        }
      }

      setCutItems(new Set());
      refetch();
      refetchFolders();
      setSnackbarMessage(`${cutItemIds.length} item(s) moved`);
      setSnackbarOpen(true);

      if (onUploadComplete) {
        onUploadComplete();
      }
    } catch (error: any) {
      console.error('Error moving items:', error);
      setSnackbarMessage('Error moving items');
      setSnackbarOpen(true);
    }
  }, [cutItems, allItems, folderId, moveFileMutation, moveFolderMutation, refetch, refetchFolders, onUploadComplete]);

  const handleDeleteFolder = useCallback(async (folder: Folder) => {
    try {
      await deleteFolderMutation({
        variables: { id: folder.id },
      });
      refetch();
      refetchFolders();
      setSelectedFiles(prev => {
        const newSet = new Set(prev);
        newSet.delete(folder.id);
        return newSet;
      });
      if (onFileDeleted) {
        onFileDeleted();
      }
    } catch (error: any) {
      console.error('Error deleting folder:', error);
      setSnackbarMessage('Error deleting folder');
      setSnackbarOpen(true);
    }
  }, [deleteFolderMutation, refetch, refetchFolders, onFileDeleted]);

  // Rename handlers
  const handleRenameConfirm = useCallback(async () => {
    if (!renameItem || !newItemName.trim()) {
      setRenameError('Name cannot be empty');
      return;
    }

    try {
      if (isFolder(renameItem)) {
        await renameFolderMutation({
          variables: {
            input: {
              id: renameItem.id,
              name: newItemName.trim(),
            },
          },
        });
      } else if (isFile(renameItem)) {
        // Note: File rename might need a separate mutation, using move for now
        // This is a placeholder - you might need to add a rename file mutation
        console.log('File rename not implemented yet');
        setRenameError('File rename not implemented');
        return;
      }

      setRenameDialogOpen(false);
      setRenameItem(null);
      setNewItemName('');
      setRenameError(null);
      refetch();
      refetchFolders();
      setSnackbarMessage('Item renamed successfully');
      setSnackbarOpen(true);
    } catch (error: any) {
      console.error('Error renaming item:', error);
      setRenameError(error.message || 'Failed to rename item');
    }
  }, [renameItem, newItemName, renameFolderMutation, refetch, refetchFolders]);

  const handleRenameCancel = useCallback(() => {
    setRenameDialogOpen(false);
    setRenameItem(null);
    setNewItemName('');
    setRenameError(null);
  }, []);

  // Add keyboard event listeners
  useEffect(() => {
    const container = containerRef.current;
    if (container) {
      container.addEventListener('keydown', handleKeyDown);
      return () => container.removeEventListener('keydown', handleKeyDown);
    }
  }, [handleKeyDown]);

  // Focus container when component mounts
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.focus();
    }
  }, []);




  if (queryError) {
    return (
      <Alert severity="error">
        Failed to load files: {queryError.message}
      </Alert>
    );
  }

  const files = sortedFiles;

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Toolbar */}
      <FileToolbar
        filter={filter}
        sortBy={sortBy}
        sortDirection={sortDirection}
        onFilterChange={handleFilterChange}
        onSortChange={handleSortChange}
        onToggleSortDirection={toggleSortDirection}
        onCreateFolder={handleCreateFolderClick}
      />

      {/* File Explorer Area */}
      <Paper
        ref={containerRef}
        tabIndex={0}
        sx={{
          flex: 1,
          p: 2,
          border: '2px dashed',
          borderColor: isDragOver ? 'primary.main' : 'transparent',
          backgroundColor: isDragOver ? 'action.hover' : 'background.paper',
          cursor: 'default',
          transition: 'all 0.2s ease-in-out',
          minHeight: 400,
          position: 'relative',
          '&:focus': {
            outline: '2px solid #3b82f6',
            outlineOffset: 2,
          },
        }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {allItems.length === 0 && uploads.length === 0 ? (
          <Box
            display="flex"
            flexDirection="column"
            alignItems="center"
            justifyContent="center"
            sx={{ height: '100%', minHeight: 300 }}
          >
            <CloudUploadIcon sx={{ fontSize: 64, color: 'primary.main', mb: 2 }} />
            <Typography variant="h6" gutterBottom>
              Drop files here to upload
            </Typography>
            <Typography variant="body2" color="textSecondary">
              Your files will appear here once uploaded
            </Typography>
          </Box>
        ) : (
          <FileGrid
            files={allItems}
            selectedFiles={selectedFiles}
            downloadingFile={downloadingFile}
            focusedIndex={focusedIndex}
            onFileClick={handleFileClick}
            onContextMenu={handleContextMenu}
            onDownload={handleDownload}
            onDelete={handleDeleteClick}
            onFolderClick={onFolderClick}
            onFileMove={handleFileMove}
          />
        )}
      </Paper>

      {/* Upload Progress Summary */}
      <UploadProgress
        uploads={uploads}
        onRemoveUpload={removeUpload}
        onClearCompleted={clearCompleted}
      />

      {/* Context Menu */}
      <Menu
        open={contextMenu !== null}
        onClose={handleContextMenuClose}
        anchorReference="anchorPosition"
        anchorPosition={
          contextMenu !== null
            ? { top: contextMenu.mouseY, left: contextMenu.mouseX }
            : undefined
        }
      >
        {(() => {
          const item = allItems.find(item => item.id === contextMenu?.fileId);
          if (!item) return null;

          const isItemFolder = isFolder(item);
          const isItemFile = isFile(item);

          return (
            <>
              {/* File-specific options */}
              {isItemFile && (
                <>
                  <MenuItem onClick={() => {
                    handleDownload(item);
                    handleContextMenuClose();
                  }}>
                    <DownloadIcon sx={{ mr: 1 }} />
                    Download
                  </MenuItem>
                  <MenuItem onClick={() => {
                    setSelectedFiles(new Set([item.id]));
                    setCutItems(new Set([item.id]));
                    handleContextMenuClose();
                  }}>
                    <DeleteIcon sx={{ mr: 1 }} />
                    Cut
                  </MenuItem>
                </>
              )}

              {/* Folder-specific options */}
              {isItemFolder && (
                <>
                  <MenuItem onClick={() => {
                    if (onFolderClick) onFolderClick(item.id);
                    handleContextMenuClose();
                  }}>
                    <FolderIcon sx={{ mr: 1 }} />
                    Open Folder
                  </MenuItem>
                  <MenuItem onClick={() => {
                    setRenameItem(item);
                    setNewItemName(item.name);
                    setRenameDialogOpen(true);
                    handleContextMenuClose();
                  }}>
                    <EditIcon sx={{ mr: 1 }} />
                    Rename
                  </MenuItem>
                  <MenuItem onClick={() => {
                    setSelectedFiles(new Set([item.id]));
                    setCutItems(new Set([item.id]));
                    handleContextMenuClose();
                  }}>
                    <DeleteIcon sx={{ mr: 1 }} />
                    Cut
                  </MenuItem>
                </>
              )}

              {/* Common options for both files and folders */}
              <MenuItem onClick={() => {
                setRenameItem(item);
                setNewItemName(isItemFolder ? item.name : item.filename);
                setRenameDialogOpen(true);
                handleContextMenuClose();
              }}>
                <EditIcon sx={{ mr: 1 }} />
                Rename
              </MenuItem>
              
              <MenuItem onClick={() => {
                if (isItemFile) {
                  handleDeleteClick(item);
                } else if (isItemFolder) {
                  handleDeleteFolder(item);
                }
                handleContextMenuClose();
              }}>
                <DeleteIcon sx={{ mr: 1 }} />
                Delete
              </MenuItem>
            </>
          );
        })()}
      </Menu>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Delete File</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete "{fileToDelete?.filename}"?
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

      {/* Rename Dialog */}
      <Dialog open={renameDialogOpen} onClose={handleRenameCancel}>
        <DialogTitle>Rename {renameItem && isFolder(renameItem) ? 'Folder' : 'File'}</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="New Name"
            fullWidth
            variant="outlined"
            value={newItemName}
            onChange={(e) => setNewItemName(e.target.value)}
            error={!!renameError}
            helperText={renameError}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleRenameConfirm();
              }
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleRenameCancel}>Cancel</Button>
          <Button
            onClick={handleRenameConfirm}
            variant="contained"
            disabled={!newItemName.trim()}
          >
            Rename
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar for feedback */}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={3000}
        onClose={() => setSnackbarOpen(false)}
        message={snackbarMessage}
      />

      {/* Error Display */}
      {error && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {error}
        </Alert>
      )}
    </Box>
  );
};

export default memo(FileExplorer);