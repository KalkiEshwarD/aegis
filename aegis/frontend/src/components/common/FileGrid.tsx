import React, { memo, useState, useRef, useEffect } from 'react';
import { FixedSizeGrid as Grid } from 'react-window';
import {
  Box,
  Paper,
  Typography,
  IconButton,
} from '@mui/material';
import {
  InsertDriveFile as FileIcon,
  Image as ImageIcon,
  VideoFile as VideoIcon,
  AudioFile as AudioIcon,
  PictureAsPdf as PdfIcon,
  Description as DocumentIcon,
  Archive as ArchiveIcon,
  Code as CodeIcon,
  MoreVert as MoreVertIcon,
  Folder as FolderIcon,
  Restore as RestoreIcon,
  Star as StarIcon,
} from '@mui/icons-material';
import { UserFile, FileExplorerItem, isFolder, isFile } from '../../types';
import { formatFileSize } from '../../utils/fileUtils';

interface FileGridProps {
  files: FileExplorerItem[];
  selectedFiles: Set<string>;
  downloadingFile: string | null;
  focusedIndex?: number;
  onFileClick: (fileId: string, event: React.MouseEvent) => void;
  onContextMenu: (event: React.MouseEvent, fileId: string) => void;
  onDownload: (file: UserFile) => void;
  onDelete: (file: UserFile) => void;
  onRestore?: (item: FileExplorerItem) => void;
  onFolderClick?: (folderId: string, folderName: string) => void;
  onFileMove?: (fileIds: string[], targetFolderId: string | null) => Promise<void>;
  onItemSelect?: (itemId: string, event: React.MouseEvent, modifiers?: { ctrlKey: boolean; metaKey: boolean; shiftKey: boolean }) => void;
}

interface FileItemProps {
  item: FileExplorerItem;
  style: React.CSSProperties;
  selectedFiles: Set<string>;
  isFocused: boolean;
  onFileClick: (fileId: string, event: React.MouseEvent) => void;
  onContextMenu: (event: React.MouseEvent, fileId: string) => void;
  onRestore?: (item: FileExplorerItem) => void;
  onFolderClick?: (folderId: string, folderName: string) => void;
  onFileMove?: (fileIds: string[], targetFolderId: string | null) => Promise<void>;
  onItemSelect?: (itemId: string, event: React.MouseEvent, modifiers?: { ctrlKey: boolean; metaKey: boolean; shiftKey: boolean }) => void;
  clickState: { count: number; lastTime: number; timeout: NodeJS.Timeout | null };
  onClickStateUpdate: (itemId: string, state: { count: number; lastTime: number; timeout: NodeJS.Timeout | null }) => void;
}

const FileGrid: React.FC<FileGridProps> = ({
  files,
  selectedFiles,
  downloadingFile,
  focusedIndex = -1,
  onFileClick,
  onContextMenu,
  onDownload,
  onDelete,
  onRestore,
  onFolderClick,
  onFileMove,
  onItemSelect,
}) => {
  // Store click state at grid level to persist across component re-mounts
  const [clickStates, setClickStates] = useState(new Map<string, { count: number; lastTime: number; timeout: NodeJS.Timeout | null }>());
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(1200);
  const [containerHeight, setContainerHeight] = useState(600);

  // Update container dimensions on mount and resize
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.offsetWidth);
        setContainerHeight(containerRef.current.offsetHeight || 600);
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    
    // Also update after a short delay to ensure proper layout
    const timeout = setTimeout(updateDimensions, 100);

    return () => {
      window.removeEventListener('resize', updateDimensions);
      clearTimeout(timeout);
    };
  }, []);

  // Helper functions for click state management
  const getClickState = (itemId: string) => {
    return clickStates.get(itemId) || { count: 0, lastTime: 0, timeout: null };
  };

  const updateClickState = (itemId: string, state: { count: number; lastTime: number; timeout: NodeJS.Timeout | null }) => {
    setClickStates(prev => {
      const newMap = new Map(prev);
      newMap.set(itemId, state);
      return newMap;
    });
  };

  // File type icons
  const getItemIcon = (item: FileExplorerItem) => {
    if (isFolder(item)) {
      return <FolderIcon sx={{ fontSize: 48, color: '#f59e0b' }} />;
    }
    
    // For files
    const mimeType = item.mime_type || '';
    const filename = item.filename || '';
    if (mimeType.startsWith('image/')) return <ImageIcon sx={{ fontSize: 48, color: '#10b981' }} />;
    if (mimeType.startsWith('video/')) return <VideoIcon sx={{ fontSize: 48, color: '#f59e0b' }} />;
    if (mimeType.startsWith('audio/')) return <AudioIcon sx={{ fontSize: 48, color: '#8b5cf6' }} />;
    if (mimeType.includes('pdf')) return <PdfIcon sx={{ fontSize: 48, color: '#ef4444' }} />;
    if (mimeType.includes('zip') || mimeType.includes('rar') || mimeType.includes('7z')) {
      return <ArchiveIcon sx={{ fontSize: 48, color: '#6b7280' }} />;
    }
    if (mimeType.includes('javascript') || mimeType.includes('typescript') ||
        mimeType.includes('json') || filename.endsWith('.js') || filename.endsWith('.ts') ||
        filename.endsWith('.jsx') || filename.endsWith('.tsx')) {
      return <CodeIcon sx={{ fontSize: 48, color: '#3b82f6' }} />;
    }
    if (mimeType.includes('text') || mimeType.includes('document')) {
      return <DocumentIcon sx={{ fontSize: 48, color: '#6b7280' }} />;
    }
    return <FileIcon sx={{ fontSize: 48, color: '#6b7280' }} />;
  };

  // FileItem component for virtualized grid
  const FileItem = memo<FileItemProps>(({
    item,
    style,
    selectedFiles,
    isFocused = false,
    onFileClick,
    onContextMenu,
    onRestore,
    onFolderClick,
    onFileMove,
    onItemSelect,
    clickState,
    onClickStateUpdate,
  }) => {
    const [isDragOver, setIsDragOver] = useState(false);
    const [isDragging, setIsDragging] = useState(false);

    const isItemSelected = selectedFiles.has(item.id);
    const isItemFolder = isFolder(item);
    
    const handleClick = (e: React.MouseEvent) => {
      // Capture modifier keys at click time
      const modifiers = {
        ctrlKey: e.ctrlKey,
        metaKey: e.metaKey,
        shiftKey: e.shiftKey
      };

      // For files, just handle single-click selection immediately
      if (isFile(item)) {
        if (onItemSelect) {
          onItemSelect(item.id, e, modifiers);
        } else {
          onFileClick(item.id, e);
        }
        return;
      }

      // For folders, implement double-click detection
      const currentTime = Date.now();
      const timeSinceLastClick = clickState.lastTime > 0 ? currentTime - clickState.lastTime : Infinity;
      const DOUBLE_CLICK_THRESHOLD = 300; // ms

      // Clear any existing timeout
      if (clickState.timeout) {
        clearTimeout(clickState.timeout);
        onClickStateUpdate(item.id, { ...clickState, timeout: null });
      }

      // Check if this is a double-click
      if (timeSinceLastClick < DOUBLE_CLICK_THRESHOLD && clickState.count === 1) {
        e.preventDefault();
        e.stopPropagation();

        // Handle double-click for folders
        if (isItemFolder && onFolderClick) {
          onFolderClick(item.id, getItemName());
        }

        // Reset click count
        onClickStateUpdate(item.id, { count: 0, lastTime: 0, timeout: null });
        return;
      }

      // This is a single click - increment count and set timeout
      const newState = { count: 1, lastTime: currentTime, timeout: null as NodeJS.Timeout | null };

      // Set timeout for single-click action
      newState.timeout = setTimeout(() => {
        if (onItemSelect) {
          onItemSelect(item.id, e, modifiers);
        }
        // Reset click count after timeout
        onClickStateUpdate(item.id, { count: 0, lastTime: 0, timeout: null });
      }, DOUBLE_CLICK_THRESHOLD);

      onClickStateUpdate(item.id, newState);
    };

    const handleContextMenu = (e: React.MouseEvent) => {
      onContextMenu(e, item.id);
    };

    // Drag and drop handlers
    const handleDragStart = (e: React.DragEvent) => {
      setIsDragging(true);
      // Set drag data with item IDs (selected items or just this item)
      const draggedItemIds = isItemSelected && selectedFiles.size > 1
        ? Array.from(selectedFiles)
        : [item.id];

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
      if (!isItemFolder) return;

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

      console.log('FileGrid handleDrop called on item:', item.id, isItemFolder ? (item as any).name : (item as any).filename);
      if (!isItemFolder || !onFileMove) {
        console.log('Not a folder or no onFileMove:', isItemFolder, !!onFileMove);
        return;
      }

      try {
        const dragData = JSON.parse(e.dataTransfer.getData('application/json'));
        console.log('Drag data:', dragData);
        if (dragData.type === 'items' && dragData.itemIds) {
          console.log('Moving items:', dragData.itemIds, 'to folder:', item.id);
          await onFileMove(dragData.itemIds, item.id);
        } else if (dragData.type === 'files' && dragData.fileIds) {
          // Backward compatibility with old format
          console.log('Moving files (old format):', dragData.fileIds, 'to folder:', item.id);
          await onFileMove(dragData.fileIds, item.id);
        }
      } catch (error) {
        console.error('Error handling item drop:', error);
      }
    };

    const getItemName = () => {
      return isItemFolder ? (item.name || 'Unnamed Folder') : (item.filename || 'Unnamed File');
    };

    const getItemSize = () => {
      if (isItemFolder) {
        const childCount = item.children?.length || 0;
        const fileCount = item.files?.length || 0;
        const totalCount = childCount + fileCount;
        return `${totalCount} items`;
      }
      return item.file ? formatFileSize(item.file.size_bytes) : 'Unknown';
    };

    return (
      <div style={style}>
        <Paper
          data-file-item={item.id}
          sx={{
            p: 2,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            cursor: 'grab',
            border: isFocused ? '2px solid #f59e0b' :
                    isItemSelected ? '2px solid #e5e7eb' :
                    isDragOver ? '2px solid #10b981' : '1px solid #e5e7eb',
            backgroundColor: isFocused ? '#fef3c7' :
                            isItemSelected ? '#eff6ff' :
                            isDragOver ? '#d1fae5' :
                            isDragging ? '#fef3c7' : 'background.paper',
            opacity: isDragging ? 0.5 : 1,
            '&:hover': {
              backgroundColor: isFocused ? '#fde68a' :
                              isItemSelected ? '#dbeafe' :
                              isDragOver ? '#a7f3d0' : '#f9fafb',
            },
            position: 'relative',
            height: '100%',
            transition: 'all 0.2s ease-in-out',
          }}
          draggable={true}
          onClick={handleClick}
          onContextMenu={handleContextMenu}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragOver={isItemFolder ? handleDragOver : undefined}
          onDragLeave={isItemFolder ? handleDragLeave : undefined}
          onDrop={isItemFolder ? handleDrop : undefined}
        >
          {getItemIcon(item)}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mt: 1 }}>
            <Typography
              variant="body2"
              sx={{
                textAlign: 'center',
                wordBreak: 'break-word',
                maxWidth: '100%',
                fontWeight: isItemSelected ? 600 : 400,
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                lineHeight: 1.2,
                minHeight: '2.4em', // 2 lines * 1.2 lineHeight
              }}
            >
              {getItemName()}
            </Typography>
            {item.is_starred && (
              <StarIcon sx={{ ml: 0.5, color: '#fbbf24', fontSize: 16 }} />
            )}
          </Box>
          <Typography variant="caption" color="textSecondary">
            {getItemSize()}
          </Typography>

          {/* Action buttons */}
          <Box sx={{ position: 'absolute', top: 4, right: 4, display: 'flex', gap: 0.5 }}>
            {onRestore && (
              <IconButton
                size="small"
                sx={{ backgroundColor: 'rgba(255, 255, 255, 0.8)', '&:hover': { backgroundColor: 'rgba(255, 255, 255, 0.9)' } }}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onRestore(item);
                }}
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onMouseUp={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
              >
                <RestoreIcon fontSize="small" />
              </IconButton>
            )}
            {/* Context menu button */}
            <IconButton
              size="small"
              sx={{ backgroundColor: 'rgba(255, 255, 255, 0.8)', '&:hover': { backgroundColor: 'rgba(255, 255, 255, 0.9)' } }}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleContextMenu(e);
              }}
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onMouseUp={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
            >
              <MoreVertIcon fontSize="small" />
            </IconButton>
          </Box>
        </Paper>
      </div>
    );
  });

  // Use virtualization for large file lists (>50 files)
  const useVirtualization = files.length > 50;

  if (useVirtualization) {
    const itemWidth = 130; // Base item width
    const itemHeight = 150; // Item height
    const gap = 16; // Gap between items
    const effectiveItemWidth = itemWidth + gap; // Total width per item including gap
    const columnCount = Math.max(1, Math.floor((containerWidth + gap) / effectiveItemWidth)); // Responsive column count
    const rowCount = Math.ceil(files.length / columnCount);

    return (
      <Box ref={containerRef} sx={{ height: '100%', width: '100%', overflow: 'hidden' }}>
        <Grid
          columnCount={columnCount}
          columnWidth={itemWidth + gap} // Column width includes gap
          height={containerHeight}
          rowCount={rowCount}
          rowHeight={itemHeight + gap} // Row height includes gap
          width={containerWidth}
          itemData={{
            files,
            selectedFiles,
            focusedIndex,
            onFileClick,
            onContextMenu,
            onRestore,
            onFolderClick,
            onFileMove,
            onItemSelect,
            gap,
          }}
        >
          {({ columnIndex, rowIndex, style, data }) => {
            const index = rowIndex * columnCount + columnIndex;
            const item = data.files[index];

            if (!item) return null;

            // Position items with gap spacing
            const itemStyle = {
              ...style,
              left: `${parseFloat(style.left as string)}px`,
              top: `${parseFloat(style.top as string)}px`,
              width: `${itemWidth}px`,
              height: `${itemHeight}px`,
            };

            return (
              <FileItem
                key={`${isFile(item) ? 'file' : 'folder'}-${item.id}`}
                item={item}
                style={itemStyle}
                selectedFiles={data.selectedFiles}
                isFocused={data.focusedIndex === index}
                onFileClick={data.onFileClick}
                onContextMenu={data.onContextMenu}
                onRestore={data.onRestore}
                onFolderClick={data.onFolderClick}
                onFileMove={data.onFileMove}
                onItemSelect={data.onItemSelect}
                clickState={getClickState(item.id)}
                onClickStateUpdate={updateClickState}
              />
            );
          }}
        </Grid>
      </Box>
    );
  }

  // Regular grid for smaller file lists
  return (
    <Box sx={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
      gap: 2,
      width: '100%',
      height: '100%'
    }}>
      {files.map((item, index) => (
        <FileItem
          key={`${isFile(item) ? 'file' : 'folder'}-${item.id}`}
          item={item}
          style={{}}
          selectedFiles={selectedFiles}
          isFocused={focusedIndex === index}
          onFileClick={onFileClick}
          onContextMenu={onContextMenu}
          onRestore={onRestore}
          onFolderClick={onFolderClick}
          onFileMove={onFileMove}
          onItemSelect={onItemSelect}
          clickState={getClickState(item.id)}
          onClickStateUpdate={updateClickState}
        />
      ))}
    </Box>
  );
};

export default memo(FileGrid);