import React, { useState, useMemo } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  InputAdornment,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Collapse,
  Divider,
  CircularProgress,
  Alert,
  Chip,
} from '@mui/material';
import {
  Star as StarIcon,
  Folder as FolderIcon,
  InsertDriveFile as FileIcon,
  Image as ImageIcon,
  VideoFile as VideoIcon,
  AudioFile as AudioIcon,
  Description as DocumentIcon,
  Archive as ArchiveIcon,
  Code as CodeIcon,
  Search as SearchIcon,
  ExpandLess as ExpandLessIcon,
  ExpandMore as ExpandMoreIcon,
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
} from '@mui/icons-material';
import { useQuery } from '@apollo/client';
import { GET_STARRED_FILES_QUERY, GET_STARRED_FOLDERS_QUERY } from '../../apollo/queries';
import { UserFile, Folder, FileExplorerItem, isFolder, isFile } from '../../types';
import { getFileIconName, getCategoryDisplayName } from '../../shared/utils/fileTypes';

interface StarredSidebarProps {
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  onItemClick?: (item: FileExplorerItem) => void;
  onFolderClick?: (folderId: string, folderName: string) => void;
}

interface StarredFilesData {
  myStarredFiles: UserFile[];
}

interface StarredFoldersData {
  myStarredFolders: Folder[];
}

const StarredSidebar: React.FC<StarredSidebarProps> = ({
  isCollapsed = false,
  onToggleCollapse,
  onItemClick,
  onFolderClick,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [showFolders, setShowFolders] = useState(true);
  const [showFiles, setShowFiles] = useState(true);

  const { data: filesData, loading: filesLoading, error: filesError } = useQuery<StarredFilesData>(
    GET_STARRED_FILES_QUERY,
    {
      fetchPolicy: 'cache-and-network',
    }
  );

  const { data: foldersData, loading: foldersLoading, error: foldersError } = useQuery<StarredFoldersData>(
    GET_STARRED_FOLDERS_QUERY,
    {
      fetchPolicy: 'cache-and-network',
    }
  );

  const starredItems = useMemo(() => {
    const files = filesData?.myStarredFiles || [];
    const folders = foldersData?.myStarredFolders || [];
    return [...folders, ...files];
  }, [filesData, foldersData]);

  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) {
      return starredItems;
    }

    const query = searchQuery.toLowerCase();
    return starredItems.filter((item) => {
      const name = isFolder(item) ? item.name : item.filename;
      return name.toLowerCase().includes(query);
    });
  }, [starredItems, searchQuery]);

  const folders = filteredItems.filter(isFolder);
  const files = filteredItems.filter(isFile);

  const getFileIcon = (file: UserFile) => {
    const iconName = getFileIconName(file.filename);

    switch (iconName) {
      case 'image':
        return <ImageIcon sx={{ color: '#10b981' }} />;
      case 'video':
        return <VideoIcon sx={{ color: '#f59e0b' }} />;
      case 'audio':
        return <AudioIcon sx={{ color: '#8b5cf6' }} />;
      case 'document':
        return <DocumentIcon sx={{ color: '#3b82f6' }} />;
      case 'archive':
        return <ArchiveIcon sx={{ color: '#6b7280' }} />;
      case 'code':
        return <CodeIcon sx={{ color: '#059669' }} />;
      default:
        return <FileIcon sx={{ color: '#6b7280' }} />;
    }
  };

  const handleItemClick = (item: FileExplorerItem) => {
    if (isFolder(item) && onFolderClick) {
      onFolderClick(item.id, item.name);
    } else if (onItemClick) {
      onItemClick(item);
    }
  };

  const loading = filesLoading || foldersLoading;
  const error = filesError || foldersError;

  if (isCollapsed) {
    return (
      <Paper
        sx={{
          width: 48,
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          py: 2,
          borderRadius: 0,
          borderRight: '1px solid #e5e7eb',
        }}
      >
        <IconButton
          onClick={onToggleCollapse}
          size="small"
          sx={{ mb: 2 }}
        >
          <ChevronRightIcon />
        </IconButton>
        <StarIcon sx={{ color: '#fbbf24', mb: 1 }} />
        <Typography
          variant="caption"
          sx={{
            writingMode: 'vertical-rl',
            textOrientation: 'mixed',
            fontSize: '0.7rem',
            color: '#6b7280',
          }}
        >
          Starred
        </Typography>
      </Paper>
    );
  }

  return (
    <Paper
      sx={{
        width: 280,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        borderRadius: 0,
        borderRight: '1px solid #e5e7eb',
      }}
    >
      {/* Header */}
      <Box sx={{ p: 2, borderBottom: '1px solid #e5e7eb' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <StarIcon sx={{ color: '#fbbf24', mr: 1 }} />
            <Typography variant="h6" sx={{ fontWeight: 600, color: '#1f2937' }}>
              Starred
            </Typography>
          </Box>
          <IconButton onClick={onToggleCollapse} size="small">
            <ChevronLeftIcon />
          </IconButton>
        </Box>

        {/* Search */}
        <TextField
          fullWidth
          size="small"
          placeholder="Search starred items..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ color: '#6b7280', fontSize: 18 }} />
              </InputAdornment>
            ),
          }}
          sx={{
            '& .MuiOutlinedInput-root': {
              backgroundColor: '#f9fafb',
              '& fieldset': {
                borderColor: '#e5e7eb',
              },
              '&:hover fieldset': {
                borderColor: '#d1d5db',
              },
              '&.Mui-focused fieldset': {
                borderColor: '#3b82f6',
              },
            },
          }}
        />
      </Box>

      {/* Content */}
      <Box sx={{ flex: 1, overflow: 'auto' }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress size={24} />
          </Box>
        ) : error ? (
          <Alert severity="error" sx={{ m: 2 }}>
            Failed to load starred items
          </Alert>
        ) : filteredItems.length === 0 ? (
          <Box sx={{ p: 3, textAlign: 'center', color: '#6b7280' }}>
            {searchQuery ? (
              <>
                <SearchIcon sx={{ fontSize: 48, color: '#d1d5db', mb: 2 }} />
                <Typography variant="body2">
                  No starred items match your search
                </Typography>
              </>
            ) : (
              <>
                <StarIcon sx={{ fontSize: 48, color: '#d1d5db', mb: 2 }} />
                <Typography variant="body2" sx={{ mb: 1 }}>
                  No starred items
                </Typography>
                <Typography variant="caption" color="#9ca3af">
                  Star files and folders to access them quickly here
                </Typography>
              </>
            )}
          </Box>
        ) : (
          <List sx={{ py: 0 }}>
            {/* Folders Section */}
            {folders.length > 0 && (
              <>
                <ListItem
                  sx={{
                    px: 2,
                    py: 1,
                    cursor: 'pointer',
                    '&:hover': { backgroundColor: '#f9fafb' },
                  }}
                  onClick={() => setShowFolders(!showFolders)}
                >
                  <ListItemIcon sx={{ minWidth: 32 }}>
                    <FolderIcon sx={{ color: '#f59e0b' }} />
                  </ListItemIcon>
                  <ListItemText
                    primary={
                      <Typography variant="body2" sx={{ fontWeight: 600, color: '#374151' }}>
                        Folders ({folders.length})
                      </Typography>
                    }
                  />
                  {showFolders ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                </ListItem>

                <Collapse in={showFolders} timeout="auto" unmountOnExit>
                  {folders.map((folder) => (
                    <ListItem key={folder.id} disablePadding>
                      <ListItemButton
                        onClick={() => handleItemClick(folder)}
                        sx={{
                          px: 4,
                          py: 1,
                          '&:hover': { backgroundColor: '#f9fafb' },
                        }}
                      >
                        <ListItemIcon sx={{ minWidth: 32 }}>
                          <FolderIcon sx={{ color: '#f59e0b', fontSize: 20 }} />
                        </ListItemIcon>
                        <ListItemText
                          primary={
                            <Typography
                              variant="body2"
                              sx={{
                                fontWeight: 500,
                                color: '#374151',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {folder.name}
                            </Typography>
                          }
                          secondary={
                            folder.files && folder.files.length > 0 ? (
                              <Typography variant="caption" color="#6b7280">
                                {folder.files.length} file{folder.files.length !== 1 ? 's' : ''}
                              </Typography>
                            ) : null
                          }
                        />
                      </ListItemButton>
                    </ListItem>
                  ))}
                </Collapse>

                {files.length > 0 && <Divider sx={{ mx: 2 }} />}
              </>
            )}

            {/* Files Section */}
            {files.length > 0 && (
              <>
                <ListItem
                  sx={{
                    px: 2,
                    py: 1,
                    cursor: 'pointer',
                    '&:hover': { backgroundColor: '#f9fafb' },
                  }}
                  onClick={() => setShowFiles(!showFiles)}
                >
                  <ListItemIcon sx={{ minWidth: 32 }}>
                    <FileIcon sx={{ color: '#6b7280' }} />
                  </ListItemIcon>
                  <ListItemText
                    primary={
                      <Typography variant="body2" sx={{ fontWeight: 600, color: '#374151' }}>
                        Files ({files.length})
                      </Typography>
                    }
                  />
                  {showFiles ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                </ListItem>

                <Collapse in={showFiles} timeout="auto" unmountOnExit>
                  {files.map((file) => (
                    <ListItem key={file.id} disablePadding>
                      <ListItemButton
                        onClick={() => handleItemClick(file)}
                        sx={{
                          px: 4,
                          py: 1,
                          '&:hover': { backgroundColor: '#f9fafb' },
                        }}
                      >
                        <ListItemIcon sx={{ minWidth: 32 }}>
                          {getFileIcon(file)}
                        </ListItemIcon>
                        <ListItemText
                          primary={
                            <Typography
                              variant="body2"
                              sx={{
                                fontWeight: 500,
                                color: '#374151',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {file.filename}
                            </Typography>
                          }
                          secondary={
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <Chip
                                label={getCategoryDisplayName(getFileIconName(file.filename) as any)}
                                size="small"
                                variant="outlined"
                                sx={{
                                  height: 16,
                                  fontSize: '0.6rem',
                                  borderColor: '#e5e7eb',
                                  color: '#6b7280',
                                  '& .MuiChip-label': { px: 0.5 },
                                }}
                              />
                            </Box>
                          }
                        />
                      </ListItemButton>
                    </ListItem>
                  ))}
                </Collapse>
              </>
            )}
          </List>
        )}
      </Box>
    </Paper>
  );
};

export default StarredSidebar;