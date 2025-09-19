import React, { useState, useCallback, useRef, memo } from 'react';
import {
  Box,
  Typography,
  Paper,
  IconButton,
  Menu,
  MenuItem,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
} from '@mui/material';
import {
  Download as DownloadIcon,
  Delete as DeleteIcon,
  MoreVert as MoreVertIcon,
  CloudUpload as CloudUploadIcon,
} from '@mui/icons-material';
import { useQuery } from '@apollo/client';
import { GET_MY_FILES } from '../../apollo/files';
import { UserFile } from '../../types';
import { useFileOperations } from '../../hooks/useFileOperations';
import { useFileUpload } from '../../hooks/useFileUpload';
import { useFileSorting } from '../../hooks/useFileSorting';
import FileGrid from './FileGrid';
import FileToolbar from './FileToolbar';
import UploadProgress from './UploadProgress';
import { getFileIcon, formatFileSize } from '../../utils/fileUtils';

interface FileExplorerProps {
  folderId?: string | null;
  onFileDeleted?: () => void;
  onUploadComplete?: () => void;
}

const FileExplorer: React.FC<FileExplorerProps> = ({
  folderId,
  onFileDeleted,
  onUploadComplete
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
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data, error: queryError, refetch } = useQuery(GET_MY_FILES, {
    variables: {
      filter: {
        folder_id: folderId || undefined
      }
    },
    fetchPolicy: 'cache-and-network',
  });

  // Use custom hooks
  const { downloadingFile, error, downloadFile, deleteFile, clearError } = useFileOperations();
  const { uploads, handleFiles, removeUpload, clearCompleted } = useFileUpload(onUploadComplete);
  const {
    filter,
    sortBy,
    sortDirection,
    sortedFiles,
    handleFilterChange,
    handleSortChange,
    toggleSortDirection
  } = useFileSorting(data?.myFiles);

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
      if (onFileDeleted) {
        onFileDeleted();
      }
    }
  }, [fileToDelete, deleteFile, refetch, onFileDeleted]);

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

  const handleClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileInputChange = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length > 0) {
      await handleFiles(files);
    }
    // Reset input value to allow selecting the same file again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [handleFiles]);




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
      />

      {/* File Explorer Area */}
      <Paper
        sx={{
          flex: 1,
          p: 2,
          border: '2px dashed',
          borderColor: isDragOver ? 'primary.main' : 'transparent',
          backgroundColor: isDragOver ? 'action.hover' : 'background.paper',
          cursor: 'pointer',
          transition: 'all 0.2s ease-in-out',
          minHeight: 400,
          position: 'relative',
        }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClick}
      >
        {files.length === 0 && uploads.length === 0 ? (
          <Box
            display="flex"
            flexDirection="column"
            alignItems="center"
            justifyContent="center"
            sx={{ height: '100%', minHeight: 300 }}
          >
            <CloudUploadIcon sx={{ fontSize: 64, color: 'primary.main', mb: 2 }} />
            <Typography variant="h6" gutterBottom>
              Drop files here or click to upload
            </Typography>
            <Typography variant="body2" color="textSecondary">
              Your files will appear here once uploaded
            </Typography>
          </Box>
        ) : (
          <FileGrid
            files={files}
            selectedFiles={selectedFiles}
            downloadingFile={downloadingFile}
            onFileClick={handleFileClick}
            onContextMenu={handleContextMenu}
            onDownload={handleDownload}
            onDelete={handleDeleteClick}
          />
        )}

        <input
          ref={fileInputRef}
          type="file"
          multiple
          style={{ display: 'none' }}
          onChange={handleFileInputChange}
        />
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
        <MenuItem onClick={() => {
          const file = files.find(f => f.id === contextMenu?.fileId);
          if (file) handleDownload(file);
          handleContextMenuClose();
        }}>
          <DownloadIcon sx={{ mr: 1 }} />
          Download
        </MenuItem>
        <MenuItem onClick={() => {
          const file = files.find(f => f.id === contextMenu?.fileId);
          if (file) handleDeleteClick(file);
        }}>
          <DeleteIcon sx={{ mr: 1 }} />
          Delete
        </MenuItem>
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