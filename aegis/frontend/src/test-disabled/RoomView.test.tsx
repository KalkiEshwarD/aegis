import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MockedProvider } from '@apollo/client/testing';
import RoomView from '../../../components/dashboard/RoomView';
import { GET_MY_ROOMS, CREATE_ROOM_MUTATION, UPDATE_ROOM_MUTATION, DELETE_ROOM_MUTATION } from '../../../apollo/rooms';
import { RoomRole } from '../../../types';

// Mock MUI components
jest.mock('@mui/material', () => ({
  ...jest.requireActual('@mui/material'),
  TextField: ({ onChange, value, onKeyDown, ...props }: any) => (
    <input
      data-testid="text-field"
      onChange={(e) => onChange?.(e)}
      value={value}
      onKeyDown={onKeyDown}
      {...props}
    />
  ),
  Button: ({ onClick, disabled, children, ...props }: any) => (
    <button data-testid="button" onClick={onClick} disabled={disabled} {...props}>
      {children}
    </button>
  ),
  Dialog: ({ open, children, onClose }: any) => (
    open ? <div data-testid="dialog" onClick={onClose}>{children}</div> : null
  ),
  DialogTitle: ({ children }: any) => <div data-testid="dialog-title">{children}</div>,
  DialogContent: ({ children }: any) => <div data-testid="dialog-content">{children}</div>,
  DialogActions: ({ children }: any) => <div data-testid="dialog-actions">{children}</div>,
  Card: ({ children }: any) => <div data-testid="card">{children}</div>,
  CardContent: ({ children }: any) => <div data-testid="card-content">{children}</div>,
  CardActions: ({ children }: any) => <div data-testid="card-actions">{children}</div>,
  Typography: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  Grid: ({ children }: any) => <div data-testid="grid">{children}</div>,
  Box: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  IconButton: ({ onClick, children, ...props }: any) => (
    <button data-testid="icon-button" onClick={onClick} {...props}>
      {children}
    </button>
  ),
  Menu: ({ open, children, onClose, anchorEl }: any) => (
    open ? <div data-testid="menu" onClick={onClose}>{children}</div> : null
  ),
  MenuItem: ({ onClick, children }: any) => (
    <div data-testid="menu-item" onClick={onClick}>{children}</div>
  ),
  ListItemIcon: ({ children }: any) => <div>{children}</div>,
  ListItemText: ({ children }: any) => <div>{children}</div>,
  Chip: ({ label }: any) => <span data-testid="chip">{label}</span>,
  Avatar: ({ children }: any) => <div data-testid="avatar">{children}</div>,
  Fab: ({ onClick, children }: any) => (
    <button data-testid="fab" onClick={onClick}>{children}</button>
  ),
}));

const mockRooms = [
  {
    id: 'room1',
    name: 'Test Room 1',
    creator_id: 'user1',
    created_at: '2024-01-01T00:00:00Z',
    creator: { id: 'user1', username: 'creator', email: 'creator@test.com' },
    members: [
      {
        id: 'member1',
        role: RoomRole.ADMIN,
        user: { id: 'user1', username: 'creator', email: 'creator@test.com' },
      },
      {
        id: 'member2',
        role: RoomRole.CONTENT_VIEWER,
        user: { id: 'user2', username: 'member', email: 'member@test.com' },
      },
    ],
    files: [],
    folders: [],
  },
];

const mockGetRoomsQuery = {
  request: {
    query: GET_MY_ROOMS,
  },
  result: {
    data: {
      myRooms: mockRooms,
    },
  },
};

const mockCreateRoomMutation = {
  request: {
    query: CREATE_ROOM_MUTATION,
    variables: {
      input: { name: 'New Room' },
    },
  },
  result: {
    data: {
      createRoom: {
        id: 'room2',
        name: 'New Room',
        creator_id: 'user1',
        created_at: '2024-01-02T00:00:00Z',
      },
    },
  },
};

const mockUpdateRoomMutation = {
  request: {
    query: UPDATE_ROOM_MUTATION,
    variables: {
      input: { room_id: 'room1', name: 'Updated Room' },
    },
  },
  result: {
    data: {
      updateRoom: {
        id: 'room1',
        name: 'Updated Room',
        creator_id: 'user1',
        created_at: '2024-01-01T00:00:00Z',
      },
    },
  },
};

const mockDeleteRoomMutation = {
  request: {
    query: DELETE_ROOM_MUTATION,
    variables: {
      input: { room_id: 'room1' },
    },
  },
  result: {
    data: {
      deleteRoom: true,
    },
  },
};

const mockErrorMutation = {
  request: {
    query: UPDATE_ROOM_MUTATION,
    variables: {
      input: { room_id: 'room1', name: 'Updated Room' },
    },
  },
  error: new Error('Permission denied'),
};

describe('RoomView', () => {
  const renderComponent = (mocks = [mockGetRoomsQuery]) => {
    return render(
      <MockedProvider mocks={mocks} addTypename={false}>
        <RoomView />
      </MockedProvider>
    );
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Loading and Empty States', () => {
    test('shows loading state initially', () => {
      renderComponent();
      expect(screen.getByText('Loading rooms...')).toBeInTheDocument();
    });

    test('shows empty state when no rooms', async () => {
      const emptyQuery = {
        ...mockGetRoomsQuery,
        result: { data: { myRooms: [] } },
      };
      renderComponent([emptyQuery]);

      await waitFor(() => {
        expect(screen.getByText('No rooms yet')).toBeInTheDocument();
      });
    });
  });

  describe('Room Display', () => {
    test('displays rooms correctly', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Test Room 1')).toBeInTheDocument();
        expect(screen.getByText('Created by creator')).toBeInTheDocument();
        expect(screen.getByText('2 members')).toBeInTheDocument();
      });
    });

    test('shows member chips', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('creator (ADMIN)')).toBeInTheDocument();
        expect(screen.getByText('member (CONTENT_VIEWER)')).toBeInTheDocument();
      });
    });
  });

  describe('Create Room', () => {
    test('opens create room dialog', async () => {
      renderComponent([mockGetRoomsQuery]);

      await waitFor(() => {
        expect(screen.getByText('Test Room 1')).toBeInTheDocument();
      });

      const createButton = screen.getByText('Create Room');
      fireEvent.click(createButton);

      expect(screen.getByText('Create New Room')).toBeInTheDocument();
    });

    test('creates room successfully', async () => {
      renderComponent([mockGetRoomsQuery, mockCreateRoomMutation]);

      await waitFor(() => {
        expect(screen.getByText('Test Room 1')).toBeInTheDocument();
      });

      const createButton = screen.getByText('Create Room');
      fireEvent.click(createButton);

      const textField = screen.getByTestId('text-field');
      fireEvent.change(textField, { target: { value: 'New Room' } });

      const submitButton = screen.getAllByTestId('button').find(btn => btn.textContent === 'Create');
      await act(async () => {
        fireEvent.click(submitButton!);
      });

      // Should refetch and close dialog
    });

    test('handles create room error', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const errorMutation = { ...mockCreateRoomMutation, error: new Error('Failed to create') };
      renderComponent([mockGetRoomsQuery, errorMutation]);

      await waitFor(() => {
        expect(screen.getByText('Test Room 1')).toBeInTheDocument();
      });

      const createButton = screen.getByText('Create Room');
      fireEvent.click(createButton);

      const textField = screen.getByTestId('text-field');
      fireEvent.change(textField, { target: { value: 'New Room' } });

      const submitButton = screen.getAllByTestId('button').find(btn => btn.textContent === 'Create');
      await act(async () => {
        fireEvent.click(submitButton!);
      });

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('Failed to create room:', expect.any(Error));
      });

      consoleSpy.mockRestore();
    });
  });

  describe('Update Room', () => {
    test('opens edit dialog from menu', async () => {
      renderComponent([mockGetRoomsQuery]);

      await waitFor(() => {
        expect(screen.getByText('Test Room 1')).toBeInTheDocument();
      });

      const menuButton = screen.getAllByTestId('icon-button')[0];
      fireEvent.click(menuButton);

      const editMenuItem = screen.getAllByTestId('menu-item')[0]; // Edit should be first
      fireEvent.click(editMenuItem);

      expect(screen.getByText('Edit Room Name')).toBeInTheDocument();
    });

    test('updates room successfully', async () => {
      renderComponent([mockGetRoomsQuery, mockUpdateRoomMutation]);

      await waitFor(() => {
        expect(screen.getByText('Test Room 1')).toBeInTheDocument();
      });

      // Open menu and edit
      const menuButton = screen.getAllByTestId('icon-button')[0];
      fireEvent.click(menuButton);

      const editMenuItem = screen.getAllByTestId('menu-item')[0];
      fireEvent.click(editMenuItem);

      const textField = screen.getByTestId('text-field');
      fireEvent.change(textField, { target: { value: 'Updated Room' } });

      const updateButton = screen.getAllByTestId('button').find(btn => btn.textContent === 'Update');
      await act(async () => {
        fireEvent.click(updateButton!);
      });

      // Should close dialog and refetch
    });

    test('handles update permission error', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      renderComponent([mockGetRoomsQuery, mockErrorMutation]);

      await waitFor(() => {
        expect(screen.getByText('Test Room 1')).toBeInTheDocument();
      });

      // Open menu and edit
      const menuButton = screen.getAllByTestId('icon-button')[0];
      fireEvent.click(menuButton);

      const editMenuItem = screen.getAllByTestId('menu-item')[0];
      fireEvent.click(editMenuItem);

      const textField = screen.getByTestId('text-field');
      fireEvent.change(textField, { target: { value: 'Updated Room' } });

      const updateButton = screen.getAllByTestId('button').find(btn => btn.textContent === 'Update');
      await act(async () => {
        fireEvent.click(updateButton!);
      });

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('Failed to update room:', expect.any(Error));
      });

      consoleSpy.mockRestore();
    });
  });

  describe('Delete Room', () => {
    test('opens delete confirmation dialog', async () => {
      renderComponent([mockGetRoomsQuery]);

      await waitFor(() => {
        expect(screen.getByText('Test Room 1')).toBeInTheDocument();
      });

      const menuButton = screen.getAllByTestId('icon-button')[0];
      fireEvent.click(menuButton);

      const deleteMenuItem = screen.getAllByTestId('menu-item')[1]; // Delete should be second
      fireEvent.click(deleteMenuItem);

      expect(screen.getByText('Delete Room')).toBeInTheDocument();
      expect(screen.getByText(/Are you sure you want to delete/)).toBeInTheDocument();
    });

    test('deletes room successfully', async () => {
      renderComponent([mockGetRoomsQuery, mockDeleteRoomMutation]);

      await waitFor(() => {
        expect(screen.getByText('Test Room 1')).toBeInTheDocument();
      });

      // Open menu and delete
      const menuButton = screen.getAllByTestId('icon-button')[0];
      fireEvent.click(menuButton);

      const deleteMenuItem = screen.getAllByTestId('menu-item')[1];
      fireEvent.click(deleteMenuItem);

      const deleteButton = screen.getAllByTestId('button').find(btn => btn.textContent === 'Delete');
      await act(async () => {
        fireEvent.click(deleteButton!);
      });

      // Should close dialog and refetch
    });

    test('handles delete error', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const errorDeleteMutation = { ...mockDeleteRoomMutation, error: new Error('Room not found') };
      renderComponent([mockGetRoomsQuery, errorDeleteMutation]);

      await waitFor(() => {
        expect(screen.getByText('Test Room 1')).toBeInTheDocument();
      });

      // Open menu and delete
      const menuButton = screen.getAllByTestId('icon-button')[0];
      fireEvent.click(menuButton);

      const deleteMenuItem = screen.getAllByTestId('menu-item')[1];
      fireEvent.click(deleteMenuItem);

      const deleteButton = screen.getAllByTestId('button').find(btn => btn.textContent === 'Delete');
      await act(async () => {
        fireEvent.click(deleteButton!);
      });

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('Failed to delete room:', expect.any(Error));
      });

      consoleSpy.mockRestore();
    });
  });

  describe('Permissions', () => {
    test('allows creator to update room', async () => {
      // Test assumes user is creator (permissions checked on backend)
      renderComponent([mockGetRoomsQuery, mockUpdateRoomMutation]);

      await waitFor(() => {
        expect(screen.getByText('Test Room 1')).toBeInTheDocument();
      });

      // Should be able to open edit dialog
      const menuButton = screen.getAllByTestId('icon-button')[0];
      fireEvent.click(menuButton);

      expect(screen.getAllByTestId('menu-item')).toHaveLength(2); // Edit and Delete
    });

    test('allows creator to delete room', async () => {
      // Test assumes user is creator
      renderComponent([mockGetRoomsQuery, mockDeleteRoomMutation]);

      await waitFor(() => {
        expect(screen.getByText('Test Room 1')).toBeInTheDocument();
      });

      // Should be able to open delete dialog
      const menuButton = screen.getAllByTestId('icon-button')[0];
      fireEvent.click(menuButton);

      const deleteMenuItem = screen.getAllByTestId('menu-item')[1];
      fireEvent.click(deleteMenuItem);

      expect(screen.getByText('Delete Room')).toBeInTheDocument();
    });
  });

  describe('Add Member Dialog', () => {
    test('opens add member dialog', async () => {
      renderComponent([mockGetRoomsQuery]);

      await waitFor(() => {
        expect(screen.getByText('Test Room 1')).toBeInTheDocument();
      });

      const addMemberButton = screen.getByText('Add Member');
      fireEvent.click(addMemberButton);

      // AddRoomMemberDialog should open (tested separately)
    });
  });
});