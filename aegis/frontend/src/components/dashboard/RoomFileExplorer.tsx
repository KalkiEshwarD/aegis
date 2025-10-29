import React, { useState, memo, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Paper,
  Toolbar,
  Alert,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Avatar,
  Typography,
  Chip,
  Breadcrumbs,
  Link,
  Snackbar,
  Menu,
  MenuItem,
  ToggleButtonGroup,
  ToggleButton,
} from '@mui/material';
import {
  Group as GroupIcon,
  ChevronRight as ChevronRightIcon,
  Download as DownloadIcon,
  Delete as DeleteIcon,
  ViewList as ListIcon,
  ViewModule as GridIcon,
} from '@mui/icons-material';
import { useQuery, useMutation } from '@apollo/client';
import { GET_ROOM } from '../../apollo/rooms';
import { REMOVE_FILE_FROM_ROOM_MUTATION, REMOVE_FOLDER_FROM_ROOM_MUTATION } from '../../apollo/queries';
import { RoomMember, FileExplorerItem, isFile, isFolder } from '../../types';
import DashboardAppBar from './DashboardAppBar';
import DashboardSidebar from './DashboardSidebar';
import { useUserMenu } from '../../hooks/useUserMenu';
import { useFileOperations } from '../../hooks/useFileOperations';
import FileGrid from '../common/FileGrid';
import FileToolbar from '../common/FileToolbar';

interface RoomFileExplorerProps {
}

const RoomFileExplorer: React.FC<RoomFileExplorerProps> = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const [showAllMembers, setShowAllMembers] = useState(false);
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
  const [isDragOver, setIsDragOver] = useState(false);

  // Drag and drop handlers for external files
  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    setIsDragOver(false);

    const files = Array.from(event.dataTransfer.files);
    if (files.length > 0) {
      // Show message that files cannot be uploaded directly to rooms
      setSnackbarMessage('Files cannot be uploaded directly to rooms. Please upload them to your personal vault first, then share them to this room.');
      setSnackbarOpen(true);
    }
  }, []);

  const { data: roomData, loading: roomLoading, error: roomError, refetch } = useQuery(GET_ROOM, {
    variables: { id: roomId },
    fetchPolicy: 'cache-and-network',
  });

  const [removeFileFromRoom] = useMutation(REMOVE_FILE_FROM_ROOM_MUTATION, {
    onCompleted: () => {
      refetch();
      setSnackbarMessage('File removed from room');
      setSnackbarOpen(true);
    },
  });

  const [removeFolderFromRoom] = useMutation(REMOVE_FOLDER_FROM_ROOM_MUTATION, {
    onCompleted: () => {
      refetch();
      setSnackbarMessage('Folder removed from room');
      setSnackbarOpen(true);
    },
  });

  const { downloadFile } = useFileOperations();

  const {
    anchorEl,
    handleMenuOpen,
    handleMenuClose,
  } = useUserMenu();

  const room = roomData?.room;

  const onNavigateBack = () => navigate('/dashboard', { state: { selectedNav: 'rooms' } });

  // Combine room files and folders
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

  const handleToggleSortDirection = useCallback(() => {
    setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
  }, []);

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
            {/* Breadcrumbs */}
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
                  border: 'none',
                  background: 'none',
                  cursor: 'pointer',
                  '&:hover': { textDecoration: 'underline' },
                }}
              >
                <GroupIcon sx={{ mr: 0.5 }} fontSize="inherit" />
                Rooms
              </Link>
              <Typography color="text.primary" variant="body1">
                {room.name}
              </Typography>
            </Breadcrumbs>

            {/* Room Info */}
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6" fontWeight={600} sx={{ flexGrow: 1 }}>
                {room.name}
              </Typography>
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Typography variant="body2" color="text.secondary">
                Created by {room.creator?.username || room.creator?.email || 'Unknown'}
              </Typography>
              <Chip
                icon={<GroupIcon />}
                label={`Members ${room.members?.length || 0}`}
                size="small"
                variant="outlined"
                clickable
                onClick={() => setShowAllMembers(true)}
                sx={{ cursor: 'pointer' }}
              />
            </Box>
          </Box>

          {/* File Explorer - Showing room files */}
          <Box>
            {/* Toolbar */}
            <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                {filteredAndSortedItems.length} item(s) in this room
              </Typography>
              <ToggleButtonGroup
                value={viewMode}
                exclusive
                onChange={(_, newMode) => newMode && setViewMode(newMode)}
                size="small"
              >
                <ToggleButton value="list">
                  <ListIcon fontSize="small" />
                </ToggleButton>
                <ToggleButton value="tile">
                  <GridIcon fontSize="small" />
                </ToggleButton>
              </ToggleButtonGroup>
            </Box>

            {/* File Toolbar with search and sort */}
            <FileToolbar
              searchQuery={searchQuery}
              sortBy={sortBy}
              sortDirection={sortOrder}
              onSearchChange={setSearchQuery}
              onSortChange={setSortBy}
              onToggleSortDirection={handleToggleSortDirection}
              canCut={false}
              canPaste={false}
              canDelete={false}
              canStar={false}
            />

            {/* File Grid/List */}
            <Paper
              sx={{
                p: 2,
                border: isDragOver ? '2px dashed #10b981' : '1px solid #e5e7eb',
                backgroundColor: isDragOver ? '#d1fae5' : 'background.paper',
                transition: 'all 0.2s ease-in-out',
                minHeight: 400,
              }}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              {filteredAndSortedItems.length === 0 ? (
                <Box sx={{ textAlign: 'center', py: 8 }}>
                  <GroupIcon sx={{ fontSize: 64, color: 'grey.400', mb: 2 }} />
                  <Typography variant="h6" color="text.secondary" gutterBottom>
                    {searchQuery ? 'No items match your search' : 'No files or folders shared in this room yet'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {searchQuery ? 'Try a different search term' : 'Share files and folders from your vault to collaborate with room members'}
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
            </Paper>
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
                  <DownloadIcon sx={{ mr: 1 }} fontSize="small" />
                  Download
                </MenuItem>
              )}
              <MenuItem onClick={handleRemoveFromRoom}>
                <DeleteIcon sx={{ mr: 1 }} fontSize="small" />
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

        {/* Members Dialog */}
        <Dialog
          open={showAllMembers}
          onClose={() => setShowAllMembers(false)}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>Room Members ({room.members?.length || 0})</DialogTitle>
          <DialogContent>
            <List>
              {room.members?.map((member: RoomMember) => (
                <ListItem key={member.id}>
                  <ListItemAvatar>
                    <Avatar sx={{ bgcolor: 'primary.main' }}>
                      {member.user?.username?.[0]?.toUpperCase() || member.user?.email?.[0]?.toUpperCase() || '?'}
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={member.user?.username || member.user?.email || 'Unknown'}
                    secondary={member.user?.email && member.user?.username ? member.user.email : undefined}
                  />
                  <Chip label={member.role} size="small" variant="outlined" />
                </ListItem>
              ))}
            </List>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setShowAllMembers(false)}>Close</Button>
          </DialogActions>
        </Dialog>
      </Box>
    </Box>
  );
};

export default memo(RoomFileExplorer);
