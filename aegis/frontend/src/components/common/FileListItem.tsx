import React, { useState } from 'react';
import { UserFile, Folder, FileExplorerItem, isFolder, isFile } from '../../types/index';
import {
  Box,
  Typography,
  IconButton,
  ListItem,
  ListItemIcon,
  ListItemText,
  Chip,
} from '@mui/material';
import {
  Folder as FolderIcon,
  InsertDriveFile as FileIcon,
  Star as StarIcon,
  Download as DownloadIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';

interface FileListItemProps {
  item: FileExplorerItem;
  isSelected: boolean;
  isDownloading: boolean;
  selectedFileIds: string[];
  onClick: (event: React.MouseEvent) => void;
  onContextMenu: (event: React.MouseEvent) => void;
  onDownload?: () => void;
  onDelete?: () => void;
  onFolderClick?: () => void;
  onStarToggle?: () => void;
  onFileMove?: (fileIds: string[], targetFolderId: string | null) => Promise<void>;
  onItemSelect?: (itemId: string, event: React.MouseEvent, modifiers?: { ctrlKey: boolean; metaKey: boolean; shiftKey: boolean }) => void;
}

export const FileListItem: React.FC<FileListItemProps> = ({
  item,
  isSelected,
  isDownloading,
  selectedFileIds,
  onClick,
  onContextMenu,
  onDownload,
  onDelete,
  onFolderClick,
  onStarToggle,
  onFileMove,
  onItemSelect,
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const getFileIcon = (filename: string) => {
    const extension = filename.split('.').pop()?.toLowerCase();
    switch (extension) {
      case 'pdf': return '📃';
      case 'doc':
      case 'docx': return '📄';
      case 'jpg':
      case 'jpeg':
      case 'png':
      case 'gif': return '🖼️';
      case 'mp4':
      case 'avi':
      case 'mov': return '🎥';
      case 'mp3':
      case 'wav': return '🎵';
      case 'zip':
      case 'rar': return '📦';
      default: return '📄';
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const countFolderItems = (folder: Folder): number => {
    let totalItems = folder.files?.length || 0;
    if (folder.children) {
      totalItems += folder.children.length;
      // Recursively count items in subfolders
      folder.children.forEach(childFolder => {
        totalItems += countFolderItems(childFolder);
      });
    }
    return totalItems;
  };

  const handleClick = (event: React.MouseEvent) => {
    // Use onItemSelect if available (for proper selection handling)
    if (onItemSelect) {
      const modifiers = {
        ctrlKey: event.ctrlKey,
        metaKey: event.metaKey,
        shiftKey: event.shiftKey
      };
      onItemSelect(item.id, event, modifiers);
      return;
    }

    // Fallback to original behavior
    if (isFolder(item) && onFolderClick) {
      onFolderClick();
    } else {
      onClick(event);
    }
  };

  const handleDoubleClick = (event: React.MouseEvent) => {
    if (isFolder(item) && onFolderClick) {
      onFolderClick();
    }
  };

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent) => {
    setIsDragging(true);
    // Set drag data with all selected item IDs (files and folders), or just this item if none selected
    const draggedItemIds = selectedFileIds.length > 0 ? selectedFileIds : [item.id];

    e.dataTransfer.setData('application/json', JSON.stringify({
      type: 'items',
      itemIds: draggedItemIds
    }));
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragEnd = () => {
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (!isFolder(item)) return;

    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    if (!isFolder(item) || !onFileMove) return;

    try {
      const dragData = JSON.parse(e.dataTransfer.getData('application/json'));
      if (dragData.type === 'items' && dragData.itemIds) {
        await onFileMove(dragData.itemIds, item.id);
      } else if (dragData.type === 'files' && dragData.fileIds) {
        // Backward compatibility with old format
        await onFileMove(dragData.fileIds, item.id);
      }
    } catch (error) {
      console.error('Error handling item drop:', error);
    }
  };

  return (
    <ListItem
      button
      selected={isSelected}
      data-file-item={item.id}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onContextMenu={onContextMenu}
      draggable={true}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragOver={isFolder(item) ? handleDragOver : undefined}
      onDragLeave={isFolder(item) ? handleDragLeave : undefined}
      onDrop={isFolder(item) ? handleDrop : undefined}
      sx={{
        borderRadius: 1,
        mb: 0.5,
        cursor: isFile(item) ? 'grab' : 'pointer',
        border: isDragOver ? '2px solid #10b981' : 'none',
        backgroundColor: isDragOver ? '#d1fae5' :
                        isDragging ? '#fef3c7' :
                        isSelected ? 'primary.light' : 'background.paper',
        opacity: isDragging ? 0.5 : 1,
        '&.Mui-selected': {
          backgroundColor: isDragOver ? '#d1fae5' : 'primary.light',
          '&:hover': {
            backgroundColor: isDragOver ? '#a7f3d0' : 'primary.main',
          },
        },
        '&:hover': {
          backgroundColor: isDragOver ? '#a7f3d0' :
                          isSelected ? 'primary.main' : '#f9fafb',
        },
        transition: 'all 0.2s ease-in-out',
      }}
    >
      <ListItemIcon>
        {isFolder(item) ? (
          <FolderIcon color="primary" />
        ) : (
          <Typography
            variant="h6"
            sx={{
              color: (() => {
                const extension = item.filename.split('.').pop()?.toLowerCase();
                if (extension === 'mp3' || extension === 'wav') {
                  return '#ff6b6b'; // Red/pink color for music files
                }
                return 'inherit';
              })()
            }}
          >
            {getFileIcon(item.filename)}
          </Typography>
        )}
      </ListItemIcon>
      
      <ListItemText
        primary={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="body1" sx={{ flex: 1 }}>
              {isFolder(item) ? item.name : item.filename}
            </Typography>
            {isFile(item) && item.is_starred && (
              <StarIcon sx={{ color: 'warning.main', fontSize: 16 }} />
            )}
          </Box>
        }
        secondary={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
            {isFile(item) ? (
              <>
                <Typography variant="caption" color="text.secondary">
                  {formatFileSize(item.file?.size_bytes || 0)}
                </Typography>
                <Typography variant="caption" color="text.secondary">•</Typography>
                <Typography variant="caption" color="text.secondary">
                  {formatDate(item.created_at)}
                </Typography>
                <Typography variant="caption" color="text.secondary">•</Typography>
                <Chip 
                  label={item.mime_type?.split('/')[1]?.toUpperCase() || 'FILE'} 
                  size="small" 
                  variant="outlined"
                />
              </>
            ) : (
              <Typography variant="caption" color="text.secondary">
                {countFolderItems(item)} item{countFolderItems(item) !== 1 ? 's' : ''} • {formatDate(item.created_at)}
              </Typography>
            )}
          </Box>
        }
      />

      <Box sx={{ display: 'flex', gap: 0.5 }}>
        {isFile(item) && onDownload && (
          <IconButton 
            size="small" 
            onClick={(e) => {
              e.stopPropagation();
              onDownload();
            }}
            disabled={isDownloading}
          >
            <DownloadIcon fontSize="small" />
          </IconButton>
        )}
        
        {isFile(item) && onStarToggle && (
          <IconButton 
            size="small" 
            onClick={(e) => {
              e.stopPropagation();
              onStarToggle();
            }}
          >
            {item.is_starred ? (
              <StarIcon sx={{ color: 'warning.main' }} fontSize="small" />
            ) : (
              <StarIcon fontSize="small" />
            )}
          </IconButton>
        )}
        
        {onDelete && (
          <IconButton 
            size="small" 
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
          >
            <DeleteIcon fontSize="small" />
          </IconButton>
        )}
      </Box>
    </ListItem>
  );
};