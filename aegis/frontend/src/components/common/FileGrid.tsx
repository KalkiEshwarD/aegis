import React, { memo } from 'react';
import { FixedSizeGrid as Grid, GridChildComponentProps } from 'react-window';
import {
  Box,
  Paper,
  Typography,
  IconButton,
  Chip,
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
  Download as DownloadIcon,
  Delete as DeleteIcon,
  MoreVert as MoreVertIcon,
} from '@mui/icons-material';
import { UserFile } from '../../types';
import { formatFileSize } from '../../utils/crypto';

interface FileGridProps {
  files: UserFile[];
  selectedFiles: Set<string>;
  downloadingFile: string | null;
  onFileClick: (fileId: string, event: React.MouseEvent) => void;
  onContextMenu: (event: React.MouseEvent, fileId: string) => void;
  onDownload: (file: UserFile) => void;
  onDelete: (file: UserFile) => void;
}

interface FileItemProps {
  file: UserFile;
  style: React.CSSProperties;
  selectedFiles: Set<string>;
  onFileClick: (fileId: string, event: React.MouseEvent) => void;
  onContextMenu: (event: React.MouseEvent, fileId: string) => void;
}

interface GridItemData {
  files: UserFile[];
  selectedFiles: Set<string>;
  onFileClick: (fileId: string, event: React.MouseEvent) => void;
  onContextMenu: (event: React.MouseEvent, fileId: string) => void;
}

const FileGrid: React.FC<FileGridProps> = ({
  files,
  selectedFiles,
  downloadingFile,
  onFileClick,
  onContextMenu,
  onDownload,
  onDelete,
}) => {
  // File type icons
  const getFileIcon = (mimeType: string, filename: string) => {
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
    file,
    style,
    selectedFiles,
    onFileClick,
    onContextMenu,
  }) => (
    <div style={style}>
      <Paper
        sx={{
          p: 2,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          cursor: 'pointer',
          border: selectedFiles.has(file.id) ? '2px solid #3b82f6' : '1px solid #e5e7eb',
          backgroundColor: selectedFiles.has(file.id) ? '#eff6ff' : 'background.paper',
          '&:hover': {
            backgroundColor: selectedFiles.has(file.id) ? '#dbeafe' : '#f9fafb',
          },
          position: 'relative',
          height: '100%',
        }}
        onClick={(e) => onFileClick(file.id, e)}
        onContextMenu={(e) => onContextMenu(e, file.id)}
      >
        {getFileIcon(file.mime_type, file.filename)}
        <Typography
          variant="body2"
          sx={{
            mt: 1,
            textAlign: 'center',
            wordBreak: 'break-word',
            maxWidth: '100%',
            fontWeight: selectedFiles.has(file.id) ? 600 : 400,
          }}
          noWrap
        >
          {file.filename}
        </Typography>
        <Typography variant="caption" color="textSecondary">
          {file.file ? formatFileSize(file.file.size_bytes) : 'Unknown'}
        </Typography>

        {/* Context menu button */}
        <IconButton
          size="small"
          sx={{ position: 'absolute', top: 4, right: 4 }}
          onClick={(e) => {
            e.stopPropagation();
            onContextMenu(e, file.id);
          }}
        >
          <MoreVertIcon fontSize="small" />
        </IconButton>
      </Paper>
    </div>
  ));

  // Use virtualization for large file lists (>50 files)
  const useVirtualization = files.length > 50;

  if (useVirtualization) {
    const itemWidth = 140; // Width of each item
    const itemHeight = 140; // Height of each item
    const columnCount = Math.floor(800 / itemWidth) || 1; // Responsive column count
    const rowCount = Math.ceil(files.length / columnCount);

    return (
      <Box sx={{ height: '100%', width: '100%' }}>
        <Grid
          columnCount={columnCount}
          columnWidth={itemWidth}
          height={400}
          rowCount={rowCount}
          rowHeight={itemHeight}
          width={800}
          itemData={{
            files,
            selectedFiles,
            onFileClick,
            onContextMenu,
          }}
        >
          {({ columnIndex, rowIndex, style, data }: GridChildComponentProps<GridItemData>) => {
            const index = rowIndex * columnCount + columnIndex;
            const file = data.files[index];

            if (!file) return null;

            return (
              <FileItem
                key={file.id}
                file={file}
                style={style}
                selectedFiles={data.selectedFiles}
                onFileClick={data.onFileClick}
                onContextMenu={data.onContextMenu}
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
      gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
      gap: 2,
      height: '100%'
    }}>
      {files.map((file: UserFile) => (
        <Paper
          key={file.id}
          sx={{
            p: 2,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            cursor: 'pointer',
            border: selectedFiles.has(file.id) ? '2px solid #3b82f6' : '1px solid #e5e7eb',
            backgroundColor: selectedFiles.has(file.id) ? '#eff6ff' : 'background.paper',
            '&:hover': {
              backgroundColor: selectedFiles.has(file.id) ? '#dbeafe' : '#f9fafb',
            },
            position: 'relative',
          }}
          onClick={(e) => onFileClick(file.id, e)}
          onContextMenu={(e) => onContextMenu(e, file.id)}
        >
          {getFileIcon(file.mime_type, file.filename)}
          <Typography
            variant="body2"
            sx={{
              mt: 1,
              textAlign: 'center',
              wordBreak: 'break-word',
              maxWidth: '100%',
              fontWeight: selectedFiles.has(file.id) ? 600 : 400,
            }}
            noWrap
          >
            {file.filename}
          </Typography>
          <Typography variant="caption" color="textSecondary">
            {file.file ? formatFileSize(file.file.size_bytes) : 'Unknown'}
          </Typography>

          {/* Context menu button */}
          <IconButton
            size="small"
            sx={{ position: 'absolute', top: 4, right: 4 }}
            onClick={(e) => {
              e.stopPropagation();
              onContextMenu(e, file.id);
            }}
          >
            <MoreVertIcon fontSize="small" />
          </IconButton>
        </Paper>
      ))}
    </Box>
  );
};

export default memo(FileGrid);