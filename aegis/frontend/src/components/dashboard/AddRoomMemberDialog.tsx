import React, { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Box,
  Typography,
  Avatar,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Chip,
  Autocomplete,
} from '@mui/material';
import { PersonAdd as PersonAddIcon } from '@mui/icons-material';
import { ADD_ROOM_MEMBER_MUTATION } from '../../apollo/rooms';
import { GET_USERS } from '../../apollo/queries';
import { Room, RoomRole, User } from '../../types';

interface AddRoomMemberDialogProps {
  open: boolean;
  onClose: () => void;
  room: Room | null;
  onMemberAdded?: () => void;
}

const AddRoomMemberDialog: React.FC<AddRoomMemberDialogProps> = ({
  open,
  onClose,
  room,
  onMemberAdded,
}) => {
  const [selectedUsername, setSelectedUsername] = useState<string>('');
  const [selectedRole, setSelectedRole] = useState<RoomRole>(RoomRole.CONTENT_VIEWER);
  const [searchQuery, setSearchQuery] = useState('');

  const { data: usersData, loading: usersLoading } = useQuery(GET_USERS, {
    variables: { search: searchQuery },
    skip: !searchQuery || searchQuery.length < 2,
  });

  const [addRoomMember] = useMutation(ADD_ROOM_MEMBER_MUTATION);

  const handleAddMember = async () => {
    if (!room || !selectedUsername.trim()) return;

    try {
      await addRoomMember({
        variables: {
          input: {
            room_id: room.id,
            username: selectedUsername.trim(),
            role: selectedRole,
          },
        },
      });

      console.log('Member added successfully');
      setSelectedUsername('');
      setSelectedRole(RoomRole.CONTENT_VIEWER);
      onMemberAdded?.();
      onClose();
    } catch (error: any) {
      console.error('Failed to add member:', error);
    }
  };

  const handleClose = () => {
    setSelectedUsername('');
    setSelectedRole(RoomRole.CONTENT_VIEWER);
    setSearchQuery('');
    onClose();
  };

  // Get existing member usernames to filter them out
  const existingUsernames = room?.members?.map(member => member.user?.username).filter(Boolean) || [];
  const availableUsers = usersData?.users?.filter((user: User) =>
    !existingUsernames.includes(user.username)
  ) || [];

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center' }}>
        <PersonAddIcon sx={{ mr: 1 }} />
        Add Member to {room?.name}
      </DialogTitle>
      <DialogContent>
        <Box sx={{ mt: 2 }}>
          <Autocomplete
            fullWidth
            options={availableUsers}
            getOptionLabel={(option: User) => option.username}
            loading={usersLoading}
            onInputChange={(event, newInputValue) => {
              setSearchQuery(newInputValue);
            }}
            onChange={(event, newValue: User | null) => {
              setSelectedUsername(newValue?.username || '');
            }}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Search users by username"
                variant="outlined"
                helperText="Type at least 2 characters to search"
              />
            )}
            renderOption={(props, option) => (
              <Box component="li" {...props}>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <Avatar sx={{ width: 32, height: 32, mr: 2 }}>
                    {option.username.charAt(0).toUpperCase()}
                  </Avatar>
                  <Box>
                    <Typography variant="body1">{option.username}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {option.email}
                    </Typography>
                  </Box>
                </Box>
              </Box>
            )}
            noOptionsText={searchQuery.length < 2 ? "Type to search users" : "No users found"}
          />

          <FormControl fullWidth sx={{ mt: 3 }}>
            <InputLabel>Role</InputLabel>
            <Select
              value={selectedRole}
              label="Role"
              onChange={(e) => setSelectedRole(e.target.value as RoomRole)}
            >
              <MenuItem value={RoomRole.CONTENT_VIEWER}>Content Viewer</MenuItem>
              <MenuItem value={RoomRole.CONTENT_EDITOR}>Content Editor</MenuItem>
              <MenuItem value={RoomRole.CONTENT_CREATOR}>Content Creator</MenuItem>
              <MenuItem value={RoomRole.ADMIN}>Admin</MenuItem>
            </Select>
          </FormControl>

          {room?.members && room.members.length > 0 && (
            <Box sx={{ mt: 3 }}>
              <Typography variant="subtitle2" gutterBottom>
                Current Members:
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {room.members.map((member) => (
                  <Chip
                    key={member.id}
                    label={`${member.user?.username} (${member.role})`}
                    size="small"
                    variant="outlined"
                  />
                ))}
              </Box>
            </Box>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>Cancel</Button>
        <Button
          onClick={handleAddMember}
          variant="contained"
          disabled={!selectedUsername.trim()}
        >
          Add Member
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default AddRoomMemberDialog;