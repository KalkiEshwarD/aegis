import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar,
  Typography,
  Box,
  Alert,
  CircularProgress,
} from '@mui/material';
import {
  Group as GroupIcon,
  Person as PersonIcon,
} from '@mui/icons-material';
import { useQuery, useMutation } from '@apollo/client';
import { GET_MY_ROOMS } from '../../apollo/rooms';
import { SHARE_FILE_TO_ROOM_MUTATION } from '../../apollo/files';
import { SHARE_FOLDER_TO_ROOM_MUTATION } from '../../apollo/folders';
import { FileExplorerItem, isFolder } from '../../types';

interface ShareToRoomDialogProps {
  open: boolean;
  onClose: () => void;
  item: FileExplorerItem | null;
}

interface Room {
  id: string;
  name: string;
  creator_id: string;
  created_at: string;
  creator: {
    id: string;
    email: string;
  };
}

export const ShareToRoomDialog: React.FC<ShareToRoomDialogProps> = ({
  open,
  onClose,
  item,
}) => {
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data, loading, error: queryError } = useQuery(GET_MY_ROOMS, {
    skip: !open,
  });

  const [shareFileToRoom] = useMutation(SHARE_FILE_TO_ROOM_MUTATION);
  const [shareFolderToRoom] = useMutation(SHARE_FOLDER_TO_ROOM_MUTATION);

  const handleShare = async () => {
    if (!item || !selectedRoomId) return;

    setSharing(true);
    setError(null);

    try {
      if (isFolder(item)) {
        await shareFolderToRoom({
          variables: {
            input: {
              folder_id: item.id,
              room_id: selectedRoomId,
            },
          },
        });
      } else {
        await shareFileToRoom({
          variables: {
            user_file_id: item.id,
            room_id: selectedRoomId,
          },
        });
      }

      onClose();
    } catch (err: any) {
      console.error('Failed to share to room:', err);
      setError(err.message || 'Failed to share item to room');
    } finally {
      setSharing(false);
    }
  };

  const handleClose = () => {
    setSelectedRoomId(null);
    setError(null);
    onClose();
  };

  const rooms = data?.myRooms || [];

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <GroupIcon />
          Share to Room
        </Box>
      </DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Select a room to share "{item ? (isFolder(item) ? item.name : item.filename) : ''}" with all room members.
        </Typography>

        {queryError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            Failed to load rooms
          </Alert>
        )}

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        ) : rooms.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <GroupIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" color="text.secondary">
              No rooms available
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Create a room first to share files with others
            </Typography>
          </Box>
        ) : (
          <List>
            {rooms.map((room: Room) => (
              <ListItem
                key={room.id}
                button
                selected={selectedRoomId === room.id}
                onClick={() => setSelectedRoomId(room.id)}
                sx={{
                  borderRadius: 1,
                  mb: 1,
                  '&.Mui-selected': {
                    backgroundColor: 'action.selected',
                  },
                }}
              >
                <ListItemAvatar>
                  <Avatar sx={{ bgcolor: 'primary.main' }}>
                    <GroupIcon />
                  </Avatar>
                </ListItemAvatar>
                <ListItemText
                  primary={room.name}
                  secondary={
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        Created by {room.creator.email}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {new Date(room.created_at).toLocaleDateString()}
                      </Typography>
                    </Box>
                  }
                />
              </ListItem>
            ))}
          </List>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={sharing}>
          Cancel
        </Button>
        <Button
          onClick={handleShare}
          variant="contained"
          disabled={!selectedRoomId || sharing}
          startIcon={sharing ? <CircularProgress size={16} /> : null}
        >
          {sharing ? 'Sharing...' : 'Share'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};