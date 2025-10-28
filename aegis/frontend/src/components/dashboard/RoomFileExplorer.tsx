import React, { useState, useCallback, memo, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  Toolbar,
  Breadcrumbs,
  Link,
  Alert,
  Snackbar,
  IconButton,
  Chip,
  Avatar,
  CircularProgress,
  Menu,
  MenuItem,
  TextField,
  InputAdornment,
  FormControl,
  Select,
  ToggleButtonGroup,
  ToggleButton,
} from '@mui/material';
import {
  Home as HomeIcon,
  ArrowBack as ArrowBackIcon,
  Group as GroupIcon,
  ChevronRight as ChevronRightIcon,
  CreateNewFolder as CreateNewFolderIcon,
  Download as DownloadIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
  Sort as SortIcon,
  ViewList as ListIcon,
  ViewModule as GridIcon,
} from '@mui/icons-material';
import { useQuery, useMutation } from '@apollo/client';
import { GET_ROOM } from '../../apollo/rooms';
import { REMOVE_FILE_FROM_ROOM_MUTATION, REMOVE_FOLDER_FROM_ROOM_MUTATION } from '../../apollo/queries';
import { UserFile, Folder, FileExplorerItem, isFolder, isFile, RoomMember } from '../../types';
import { useFileOperations } from '../../hooks/useFileOperations';
import { formatFileSize, formatDateTime } from '../../shared/utils';
import FileGrid from '../common/FileGrid';
import FileToolbar from '../common/FileToolbar';
import DashboardAppBar from './DashboardAppBar';
import DashboardSidebar from './DashboardSidebar';
import { useUserMenu } from '../../hooks/useUserMenu';

interface RoomFileExplorerProps {
}

const RoomFileExplorer: React.FC<RoomFileExplorerProps> = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();

  const [viewMode, setViewMode] = useState<'list' | 'tile'>('tile');
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [contextMenu, setContextMenu] = useState<{
    mouseX: number;
    mouseY: number;
    item: FileExplorerItem | null;
  } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'date' | 'size' | 'type'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const { data: roomData, loading: roomLoading, error: roomError, refetch: refetchRoom } = useQuery(GET_ROOM, {
    variables: { id: roomId },
    fetchPolicy: 'cache-and-network',
  });

  const [removeFileFromRoom] = useMutation(REMOVE_FILE_FROM_ROOM_MUTATION, {
    onCompleted: () => {
      refetchRoom();
      setSnackbarMessage('File removed from room');
      setSnackbarOpen(true);
    },
  });

  const [removeFolderFromRoom] = useMutation(REMOVE_FOLDER_FROM_ROOM_MUTATION, {
    onCompleted: () => {
      refetchRoom();
      setSnackbarMessage('Folder removed from room');
      setSnackbarOpen(true);
    },
  });

  const {
    anchorEl,
    handleMenuOpen,
    handleMenuClose,
  } = useUserMenu();

  const { downloadFile } = useFileOperations();

  const room = roomData?.room;

  const onNavigateBack = () => navigate('/dashboard');

  // Combine files and folders into items
  const allItems: FileExplorerItem[] = useMemo(() => {
    const items: FileExplorerItem[] = [];
    if (room?.files) items.push(...room.files);
    if (room?.folders) items.push(...room.folders);
    return items;
  }, [room?.files, room?.folders]);

  // Filter and sort items
  const filteredAndSortedItems = useMemo(() => {
    let filtered = allItems;

    // Apply search filter
    if (searchQuery) {
      filtered = filtered.filter(item => {
        const name = isFile(item) ? item.filename : item.name;
        return name?.toLowerCase().includes(searchQuery.toLowerCase());
      });
    }

    // Apply sorting
    return filtered.sort((a, b) => {
      let comparison = 0;

      // Folders first
      if (isFolder(a) && isFile(b)) return -1;
      if (isFile(a) && isFolder(b)) return 1;

      switch (sortBy) {
        case 'name':
          const nameA = (isFile(a) ? a.filename : a.name) || '';
          const nameB = (isFile(b) ? b.filename : b.name) || '';
          comparison = nameA.localeCompare(nameB);
          break;
        case 'date':
          const dateA = new Date(a.created_at || 0).getTime();
          const dateB = new Date(b.created_at || 0).getTime();
          comparison = dateB - dateA;
          break;
        case 'size':
          if (isFile(a) && isFile(b)) {
            comparison = (a.file?.size_bytes || 0) - (b.file?.size_bytes || 0);
          }
          break;
        case 'type':
          if (isFile(a) && isFile(b)) {
            const typeA = a.mime_type || '';
            const typeB = b.mime_type || '';
            comparison = typeA.localeCompare(typeB);
          }
          break;
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }, [allItems, searchQuery, sortBy, sortOrder]);

  const handleContextMenu = useCallback((event: React.MouseEvent, itemId: string) => {
    event.preventDefault();
    const item = allItems.find(i => i.id === itemId);
    if (item) {
      setContextMenu({
        mouseX: event.clientX - 2,
        mouseY: event.clientY - 4,
        item,
      });
    }
  }, [allItems]);

  const handleContextMenuClose = () => {
    setContextMenu(null);
  };

  const handleDownload = async () => {
    if (contextMenu?.item && isFile(contextMenu.item)) {
      try {
        await downloadFile(contextMenu.item);
      } catch (error) {
        console.error('Download failed:', error);
        setSnackbarMessage('Download failed');
        setSnackbarOpen(true);
      }
    }
    handleContextMenuClose();
  };

  const handleRemoveFromRoom = async () => {
    const item = contextMenu?.item;
    if (!item) return;

    if (isFile(item)) {
      try {
        await removeFileFromRoom({
          variables: {
            user_file_id: item.id,
            room_id: roomId,
          },
        });
      } catch (error) {
        console.error('Failed to remove file from room:', error);
        setSnackbarMessage('Failed to remove file from room');
        setSnackbarOpen(true);
      }
    } else if (isFolder(item)) {
      try {
        await removeFolderFromRoom({
          variables: {
            folder_id: item.id,
            room_id: roomId,
          },
        });
      } catch (error) {
        console.error('Failed to remove folder from room:', error);
        setSnackbarMessage('Failed to remove folder from room');
        setSnackbarOpen(true);
      }
    }
    handleContextMenuClose();
  };

  const handleFileClick = (itemId: string, event: React.MouseEvent) => {
    // Handle file/folder selection
    setSelectedFiles(prev => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      }
      return newSet;
    });
  };

  const handleFolderClick = (folderId: string, folderName: string) => {
    // For now, folders in rooms are not navigable
    console.log('Folder clicked:', folderId, folderName);
  };

  if (!roomId) {
    return <div>Room ID not found</div>;
  }

  if (roomLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (roomError) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', p: 3 }}>
        <Alert severity="error">
          Failed to load room: {roomError.message}
        </Alert>
      </Box>
    );
  }

  if (!room) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', p: 3 }}>
        <Alert severity="error">
          Room not found
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{
      display: 'flex',
      minHeight: '100vh',
      backgroundColor: '#f8fafc'
    }}>
      {/* App Bar */}
      <DashboardAppBar
        onMenuOpen={handleMenuOpen}
        anchorEl={anchorEl}
        onMenuClose={handleMenuClose}
      />

      {/* Sidebar */}
      <DashboardSidebar
        selectedNav="rooms"
        onNavChange={(nav) => {
          if (nav === 'rooms') {
            navigate('/dashboard');
          } else {
            navigate('/dashboard');
          }
        }}
        statsData={null}
        statsLoading={false}
        onUploadComplete={() => {}}
        onFileSelect={() => {}}
        onProcessFile={async () => {}}
      />

      {/* Main Content */}
      <Box component="main" sx={{ flexGrow: 1, p: 3 }}>
        <Toolbar />

        <Paper sx={{
          p: 4,
          border: '1px solid #e5e7eb',
          boxShadow: 'none',
          borderRadius: 3
        }}>
          {/* Room Header with Members */}
          <Box sx={{ mb: 3, pb: 3, borderBottom: '1px solid #e5e7eb' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <Typography variant="body2" color="text.secondary">
                Created by {room.creator?.username || 'Unknown'}
              </Typography>
              <Chip
                icon={<GroupIcon />}
                label={`${room.members?.length || 0} members`}
                size="small"
                variant="outlined"
                sx={{ ml: 2 }}
              />
            </Box>

            {/* Members */}
            {room.members && room.members.length > 0 && (
              <Box>
                <Typography variant="subtitle2" gutterBottom sx={{ mb: 1 }}>
                  Members
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {room.members.slice(0, 5).map((member: RoomMember) => (
                    <Chip
                      key={member.id}
                      avatar={<Avatar sx={{ width: 24, height: 24 }}>{member.user?.username?.[0]?.toUpperCase()}</Avatar>}
                      label={member.user?.username || 'Unknown'}
                      size="small"
                      variant="outlined"
                    />
                  ))}
                  {room.members.length > 5 && (
                    <Chip
                      label={`+${room.members.length - 5} more`}
                      size="small"
                      variant="outlined"
                    />
                  )}
                </Box>
              </Box>
            )}
          </Box>

          {/* File Explorer - Custom implementation for room files */}
          <Box>
            {/* Header with Breadcrumbs */}
            <Box sx={{ mb: 3 }}>
              <Breadcrumbs
                separator={<ChevronRightIcon fontSize="small" />}
                aria-label="breadcrumb"
                sx={{ mb: 2 }}
              >
                <Link
                  component="button"
                  variant="body1"
                  onClick={onNavigateBack}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    textDecoration: 'none',
                    color: 'primary.main',
                    '&:hover': { textDecoration: 'underline' },
                  }}
                >
                  <HomeIcon sx={{ mr: 0.5 }} fontSize="inherit" />
                  Rooms
                </Link>
                <Typography color="text.primary" variant="body1">
                  {room.name}
                </Typography>
              </Breadcrumbs>

              <Typography variant="h6" fontWeight={600}>
                {room.name}
              </Typography>
            </Box>

            {/* Toolbar */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3, flexWrap: 'wrap' }}>
              {/* Search */}
              <TextField
                size="small"
                placeholder="Search files..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon />
                    </InputAdornment>
                  ),
                }}
                sx={{ minWidth: 300, flexGrow: 1 }}
              />

              {/* Sort */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="body2" color="text.secondary">
                  Sort by
                </Typography>
                <FormControl size="small" sx={{ minWidth: 120 }}>
                  <Select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as 'name' | 'date' | 'size' | 'type')}
                  >
                    <MenuItem value="name">Name</MenuItem>
                    <MenuItem value="date">Date</MenuItem>
                    <MenuItem value="size">Size</MenuItem>
                    <MenuItem value="type">Type</MenuItem>
                  </Select>
                </FormControl>
                <IconButton
                  size="small"
                  onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                >
                  <SortIcon sx={{ transform: sortOrder === 'desc' ? 'rotate(180deg)' : 'none' }} />
                </IconButton>
              </Box>

              {/* View Toggle */}
              <ToggleButtonGroup
                value={viewMode}
                exclusive
                onChange={(_, newMode) => newMode && setViewMode(newMode)}
                size="small"
              >
                <ToggleButton value="tile">
                  <GridIcon />
                </ToggleButton>
                <ToggleButton value="list">
                  <ListIcon />
                </ToggleButton>
              </ToggleButtonGroup>
            </Box>

            {/* File Grid/List */}
            <Box sx={{ mt: 3 }}>
              {filteredAndSortedItems.length === 0 ? (
                <Box sx={{ textAlign: 'center', py: 8 }}>
                  <GroupIcon sx={{ fontSize: 64, color: 'grey.400', mb: 2 }} />
                  <Typography variant="h6" color="text.secondary" gutterBottom>
                    {searchQuery ? 'No items match your search' : 'No files or folders shared in this room yet'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {searchQuery ? 'Try a different search term' : 'Share files and folders to collaborate with room members'}
                  </Typography>
                </Box>
              ) : (
                <FileGrid
                  files={filteredAndSortedItems}
                  selectedFiles={selectedFiles}
                  downloadingFile={null}
                  onFileClick={handleFileClick}
                  onContextMenu={handleContextMenu}
                  onDownload={(file) => downloadFile(file)}
                  onDelete={() => {}}
                  onFolderClick={handleFolderClick}
                />
              )}
            </Box>
          </Box>
        </Paper>

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
          {contextMenu?.item && (
            <>
              {isFile(contextMenu.item) && (
                <MenuItem onClick={handleDownload}>
                  <DownloadIcon sx={{ mr: 1 }} />
                  Download
                </MenuItem>
              )}
              <MenuItem onClick={handleRemoveFromRoom}>
                <DeleteIcon sx={{ mr: 1 }} />
                Remove from Room
              </MenuItem>
            </>
          )}
        </Menu>

        {/* Snackbar */}
        <Snackbar
          open={snackbarOpen}
          autoHideDuration={4000}
          onClose={() => setSnackbarOpen(false)}
          message={snackbarMessage}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        />
      </Box>
    </Box>
  );
};

export default memo(RoomFileExplorer);