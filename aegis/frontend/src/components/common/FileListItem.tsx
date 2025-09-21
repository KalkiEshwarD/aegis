import React from 'react';
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
  onClick: (event: React.MouseEvent) => void;
  onContextMenu: (event: React.MouseEvent) => void;
  onDownload?: () => void;
  onDelete?: () => void;
  onFolderClick?: () => void;
  onStarToggle?: () => void;
}

export const FileListItem: React.FC<FileListItemProps> = ({
  item,
  isSelected,
  isDownloading,
  onClick,
  onContextMenu,
  onDownload,
  onDelete,
  onFolderClick,
  onStarToggle,
}) => {
  const getFileIcon = (filename: string) => {
    const extension = filename.split('.').pop()?.toLowerCase();
    switch (extension) {
      case 'pdf': return '📄';
      case 'doc':
      case 'docx': return '📝';
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

  const handleClick = (event: React.MouseEvent) => {
    if (isFolder(item) && onFolderClick) {
      onFolderClick();
    } else {
      onClick(event);
    }
  };

  return (
    <ListItem
      button
      selected={isSelected}
      onClick={handleClick}
      onContextMenu={onContextMenu}
      sx={{
        borderRadius: 1,
        mb: 0.5,
        '&.Mui-selected': {
          backgroundColor: 'primary.light',
          '&:hover': {
            backgroundColor: 'primary.main',
          },
        },
      }}
    >
      <ListItemIcon>
        {isFolder(item) ? (
          <FolderIcon color="primary" />
        ) : (
          <FileIcon />
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
                Folder • {formatDate(item.created_at)}
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