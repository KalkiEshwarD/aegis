import React from 'react';
import {
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
  Chip,
} from '@mui/material';
import { Group as GroupIcon } from '@mui/icons-material';
import { Room, RoomMember } from '../../types';

interface ViewRoomMembersDialogProps {
  open: boolean;
  onClose: () => void;
  room: Room | null;
  onAddMember?: () => void;
}

const ViewRoomMembersDialog: React.FC<ViewRoomMembersDialogProps> = ({
  open,
  onClose,
  room,
  onAddMember,
}) => {
  if (!room) return null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center' }}>
        <GroupIcon sx={{ mr: 1 }} />
        {room.name} - Members ({room.members?.length || 0})
      </DialogTitle>
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
        {onAddMember && (
          <Button onClick={onAddMember} color="primary">
            Add Member
          </Button>
        )}
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};

export default ViewRoomMembersDialog;
