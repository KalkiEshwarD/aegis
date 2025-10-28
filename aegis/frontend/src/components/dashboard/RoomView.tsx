import React, { useState } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  CardActions,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  IconButton,
  Chip,
  Avatar,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Fab,
  Tooltip,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  MoreVert as MoreVertIcon,
  Group as GroupIcon,
  PersonAdd as PersonAddIcon,
} from '@mui/icons-material';
import { GET_MY_ROOMS, CREATE_ROOM_MUTATION, UPDATE_ROOM_MUTATION, DELETE_ROOM_MUTATION } from '../../apollo/rooms';
import { Room } from '../../types';
import AddRoomMemberDialog from './AddRoomMemberDialog';

const RoomView: React.FC = () => {
  const navigate = useNavigate();
  const { data, loading, refetch } = useQuery(GET_MY_ROOMS);
  const [createRoom] = useMutation(CREATE_ROOM_MUTATION);
  const [updateRoom] = useMutation(UPDATE_ROOM_MUTATION);
  const [deleteRoom] = useMutation(DELETE_ROOM_MUTATION);

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [roomToDelete, setRoomToDelete] = useState<Room | null>(null);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [roomName, setRoomName] = useState('');
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [addMemberDialogOpen, setAddMemberDialogOpen] = useState(false);
  const [roomForAddingMember, setRoomForAddingMember] = useState<Room | null>(null);

  const handleCreateRoom = async () => {
    if (!roomName.trim()) return;

    try {
      await createRoom({
        variables: {
          input: { name: roomName.trim() },
        },
      });
      setCreateDialogOpen(false);
      setRoomName('');
      refetch();
      console.log('Room created successfully');
    } catch (error: any) {
      console.error('Failed to create room:', error);
    }
  };

  const handleEditRoom = (room: Room) => {
    setEditingRoom(room);
    setRoomName(room.name);
    setAnchorEl(null);
  };

  const handleUpdateRoom = async () => {
    if (!editingRoom || !roomName.trim()) return;

    try {
      await updateRoom({
        variables: {
          input: { room_id: editingRoom.id, name: roomName.trim() },
        },
      });
      setEditingRoom(null);
      setRoomName('');
      refetch();
      console.log('Room updated successfully');
    } catch (error: any) {
      console.error('Failed to update room:', error);
    }
  };

  const handleDeleteRoom = async () => {
    if (!roomToDelete) return;

    try {
      await deleteRoom({
        variables: {
          input: { room_id: roomToDelete.id },
        },
      });
      setDeleteDialogOpen(false);
      setRoomToDelete(null);
      refetch();
      console.log('Room deleted successfully');
    } catch (error: any) {
      console.error('Failed to delete room:', error);
    }
  };

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, room: Room) => {
    setAnchorEl(event.currentTarget);
    setSelectedRoom(room);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedRoom(null);
  };

  if (loading) {
    return (
      <Box sx={{ p: 4 }}>
        <Typography>Loading rooms...</Typography>
      </Box>
    );
  }

  const rooms = data?.myRooms || [];

  return (
    <Box sx={{ p: 4 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Typography variant="h4" component="h1" fontWeight={600}>
          My Rooms
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setCreateDialogOpen(true)}
          sx={{ borderRadius: 2 }}
        >
          Create Room
        </Button>
      </Box>

      {rooms.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <GroupIcon sx={{ fontSize: 64, color: 'grey.400', mb: 2 }} />
          <Typography variant="h6" color="text.secondary" gutterBottom>
            No rooms yet
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Create your first room to start collaborating
          </Typography>
        </Box>
      ) : (
        <Grid container spacing={3}>
          {rooms.map((room: Room) => (
            <Grid item xs={12} sm={6} md={4} key={room.id}>
              <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                <CardContent sx={{ flex: 1 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                    <Typography variant="h6" component="h2" fontWeight={600}>
                      {room.name}
                    </Typography>
                    <IconButton
                      size="small"
                      onClick={(e) => handleMenuOpen(e, room)}
                      sx={{ ml: 1 }}
                    >
                      <MoreVertIcon />
                    </IconButton>
                  </Box>

                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Created by {room.creator?.username || 'Unknown'}
                  </Typography>

                  <Box sx={{ display: 'flex', alignItems: 'center', mt: 2 }}>
                    <GroupIcon sx={{ mr: 1, fontSize: 18, color: 'text.secondary' }} />
                    <Typography variant="body2" color="text.secondary">
                      {room.members?.length || 0} members
                    </Typography>
                  </Box>

                  {room.members && room.members.length > 0 && (
                    <Box sx={{ mt: 2 }}>
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        Members:
                      </Typography>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {room.members.slice(0, 3).map((member) => (
                          <Chip
                            key={member.id}
                            label={member.user?.username || 'Unknown'}
                            size="small"
                            variant="outlined"
                          />
                        ))}
                        {room.members.length > 3 && (
                          <Chip
                            label={`+${room.members.length - 3} more`}
                            size="small"
                            variant="outlined"
                          />
                        )}
                      </Box>
                    </Box>
                  )}
                </CardContent>

                <CardActions sx={{ justifyContent: 'space-between', px: 2, pb: 2 }}>
                  <Button size="small" color="primary" onClick={() => navigate(`/room/${room.id}`)}>
                    Open Room
                  </Button>
                  <Button
                    size="small"
                    startIcon={<PersonAddIcon />}
                    color="secondary"
                    onClick={() => {
                      setRoomForAddingMember(room);
                      setAddMemberDialogOpen(true);
                    }}
                  >
                    Add Member
                  </Button>
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Create Room Dialog */}
      <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create New Room</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Room Name"
            fullWidth
            variant="outlined"
            value={roomName}
            onChange={(e) => setRoomName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleCreateRoom();
              }
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleCreateRoom}
            variant="contained"
            disabled={!roomName.trim()}
          >
            Create
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Room Dialog */}
      <Dialog open={!!editingRoom} onClose={() => setEditingRoom(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Edit Room Name</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Room Name"
            fullWidth
            variant="outlined"
            value={roomName}
            onChange={(e) => setRoomName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleUpdateRoom();
              }
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditingRoom(null)}>Cancel</Button>
          <Button
            onClick={handleUpdateRoom}
            variant="contained"
            disabled={!roomName.trim()}
          >
            Update
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Delete Room</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete "{roomToDelete?.name}"? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleDeleteRoom} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Room Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={() => selectedRoom && handleEditRoom(selectedRoom)}>
          <ListItemIcon>
            <EditIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Edit Name</ListItemText>
        </MenuItem>
        <MenuItem
          onClick={() => {
            setRoomToDelete(selectedRoom);
            setDeleteDialogOpen(true);
            handleMenuClose();
          }}
        >
          <ListItemIcon>
            <DeleteIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Delete Room</ListItemText>
        </MenuItem>
      </Menu>

      {/* Add Member Dialog */}
      <AddRoomMemberDialog
        open={addMemberDialogOpen}
        onClose={() => setAddMemberDialogOpen(false)}
        room={roomForAddingMember}
        onMemberAdded={refetch}
      />
    </Box>
  );
};

export default RoomView;