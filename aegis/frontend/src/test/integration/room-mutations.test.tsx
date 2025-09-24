/// <reference types="jest" />
import React from 'react';
import { MockedProvider } from '@apollo/client/testing';
import { renderHook, act } from '@testing-library/react-hooks';
import { useMutation } from '@apollo/client';
import {
  CREATE_ROOM_MUTATION,
  ADD_ROOM_MEMBER_MUTATION,
  UPDATE_ROOM_MUTATION,
  DELETE_ROOM_MUTATION,
} from '../../apollo/rooms';
import { GET_USERS } from '../../apollo/queries';
import { RoomRole } from '../../types';

// Wrapper component for MockedProvider
const createWrapper = (mocks: any[]) => ({ children }: { children: React.ReactNode }) => (
  <MockedProvider mocks={mocks} addTypename={false}>
    {children}
  </MockedProvider>
);

describe('Room Mutations Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('CREATE_ROOM_MUTATION', () => {
    const mockCreateRoom = {
      request: {
        query: CREATE_ROOM_MUTATION,
        variables: {
          input: { name: 'Test Room' },
        },
      },
      result: {
        data: {
          createRoom: {
            id: 'room1',
            name: 'Test Room',
            creator_id: 'user1',
            created_at: '2024-01-01T00:00:00Z',
          },
        },
      },
    };

    test('creates room successfully', async () => {
      const { result } = renderHook(() => useMutation(CREATE_ROOM_MUTATION), {
        wrapper: createWrapper([mockCreateRoom]),
      });

      const [createRoom] = result.current;

      await act(async () => {
        const response = await createRoom({
          variables: {
            input: { name: 'Test Room' },
          },
        });

        expect(response.data?.createRoom).toEqual({
          id: 'room1',
          name: 'Test Room',
          creator_id: 'user1',
          created_at: '2024-01-01T00:00:00Z',
        });
      });
    });

    test('handles create room error', async () => {
      const errorMock = {
        ...mockCreateRoom,
        error: new Error('Failed to create room'),
      };

      const { result } = renderHook(() => useMutation(CREATE_ROOM_MUTATION), {
        wrapper: createWrapper([errorMock]),
      });

      const [createRoom] = result.current;

      await expect(
        act(async () => {
          await createRoom({
            variables: {
              input: { name: 'Test Room' },
            },
          });
        })
      ).rejects.toThrow('Failed to create room');
    });
  });

  describe('ADD_ROOM_MEMBER_MUTATION', () => {
    const mockAddMember = {
      request: {
        query: ADD_ROOM_MEMBER_MUTATION,
        variables: {
          input: {
            room_id: 'room1',
            username: 'testuser',
            role: RoomRole.CONTENT_VIEWER,
          },
        },
      },
      result: {
        data: {
          addRoomMember: true,
        },
      },
    };

    const mockGetUsers = {
      request: {
        query: GET_USERS,
        variables: { search: 'test' },
      },
      result: {
        data: {
          users: [
            { id: 'user2', username: 'testuser', email: 'test@example.com' },
          ],
        },
      },
    };

    test('adds room member successfully', async () => {
      const { result } = renderHook(() => useMutation(ADD_ROOM_MEMBER_MUTATION), {
        wrapper: createWrapper([mockAddMember, mockGetUsers]),
      });

      const [addRoomMember] = result.current;

      await act(async () => {
        const response = await addRoomMember({
          variables: {
            input: {
              room_id: 'room1',
              username: 'testuser',
              role: RoomRole.CONTENT_VIEWER,
            },
          },
        });

        expect(response.data?.addRoomMember).toBe(true);
      });
    });

    test('handles user not found error', async () => {
      const errorMock = {
        ...mockAddMember,
        error: new Error('User not found'),
      };

      const { result } = renderHook(() => useMutation(ADD_ROOM_MEMBER_MUTATION), {
        wrapper: createWrapper([errorMock]),
      });

      const [addRoomMember] = result.current;

      await expect(
        act(async () => {
          await addRoomMember({
            variables: {
              input: {
                room_id: 'room1',
                username: 'nonexistent',
                role: RoomRole.CONTENT_VIEWER,
              },
            },
          });
        })
      ).rejects.toThrow('User not found');
    });

    test('handles permission denied error', async () => {
      const errorMock = {
        ...mockAddMember,
        error: new Error('Permission denied: Only admins can add members'),
      };

      const { result } = renderHook(() => useMutation(ADD_ROOM_MEMBER_MUTATION), {
        wrapper: createWrapper([errorMock]),
      });

      const [addRoomMember] = result.current;

      await expect(
        act(async () => {
          await addRoomMember({
            variables: {
              input: {
                room_id: 'room1',
                username: 'testuser',
                role: RoomRole.CONTENT_VIEWER,
              },
            },
          });
        })
      ).rejects.toThrow('Permission denied: Only admins can add members');
    });
  });

  describe('UPDATE_ROOM_MUTATION', () => {
    const mockUpdateRoom = {
      request: {
        query: UPDATE_ROOM_MUTATION,
        variables: {
          input: {
            room_id: 'room1',
            name: 'Updated Room Name',
          },
        },
      },
      result: {
        data: {
          updateRoom: {
            id: 'room1',
            name: 'Updated Room Name',
            creator_id: 'user1',
            created_at: '2024-01-01T00:00:00Z',
          },
        },
      },
    };

    test('updates room successfully', async () => {
      const { result } = renderHook(() => useMutation(UPDATE_ROOM_MUTATION), {
        wrapper: createWrapper([mockUpdateRoom]),
      });

      const [updateRoom] = result.current;

      await act(async () => {
        const response = await updateRoom({
          variables: {
            input: {
              room_id: 'room1',
              name: 'Updated Room Name',
            },
          },
        });

        expect(response.data?.updateRoom).toEqual({
          id: 'room1',
          name: 'Updated Room Name',
          creator_id: 'user1',
          created_at: '2024-01-01T00:00:00Z',
        });
      });
    });

    test('handles room not found error', async () => {
      const errorMock = {
        ...mockUpdateRoom,
        error: new Error('Room not found'),
      };

      const { result } = renderHook(() => useMutation(UPDATE_ROOM_MUTATION), {
        wrapper: createWrapper([errorMock]),
      });

      const [updateRoom] = result.current;

      await expect(
        act(async () => {
          await updateRoom({
            variables: {
              input: {
                room_id: 'nonexistent',
                name: 'Updated Name',
              },
            },
          });
        })
      ).rejects.toThrow('Room not found');
    });

    test('handles permission denied error', async () => {
      const errorMock = {
        ...mockUpdateRoom,
        error: new Error('Permission denied: Only room creator can update room'),
      };

      const { result } = renderHook(() => useMutation(UPDATE_ROOM_MUTATION), {
        wrapper: createWrapper([errorMock]),
      });

      const [updateRoom] = result.current;

      await expect(
        act(async () => {
          await updateRoom({
            variables: {
              input: {
                room_id: 'room1',
                name: 'Updated Name',
              },
            },
          });
        })
      ).rejects.toThrow('Permission denied: Only room creator can update room');
    });
  });

  describe('DELETE_ROOM_MUTATION', () => {
    const mockDeleteRoom = {
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

    test('deletes room successfully', async () => {
      const { result } = renderHook(() => useMutation(DELETE_ROOM_MUTATION), {
        wrapper: createWrapper([mockDeleteRoom]),
      });

      const [deleteRoom] = result.current;

      await act(async () => {
        const response = await deleteRoom({
          variables: {
            input: { room_id: 'room1' },
          },
        });

        expect(response.data?.deleteRoom).toBe(true);
      });
    });

    test('handles room not found error', async () => {
      const errorMock = {
        ...mockDeleteRoom,
        error: new Error('Room not found'),
      };

      const { result } = renderHook(() => useMutation(DELETE_ROOM_MUTATION), {
        wrapper: createWrapper([errorMock]),
      });

      const [deleteRoom] = result.current;

      await expect(
        act(async () => {
          await deleteRoom({
            variables: {
              input: { room_id: 'nonexistent' },
            },
          });
        })
      ).rejects.toThrow('Room not found');
    });

    test('handles permission denied error', async () => {
      const errorMock = {
        ...mockDeleteRoom,
        error: new Error('Permission denied: Only room creator can delete room'),
      };

      const { result } = renderHook(() => useMutation(DELETE_ROOM_MUTATION), {
        wrapper: createWrapper([errorMock]),
      });

      const [deleteRoom] = result.current;

      await expect(
        act(async () => {
          await deleteRoom({
            variables: {
              input: { room_id: 'room1' },
            },
          });
        })
      ).rejects.toThrow('Permission denied: Only room creator can delete room');
    });
  });

  describe('Combined Operations', () => {
    test('performs full room lifecycle', async () => {
      const mocks = [
        // Create room
        {
          request: {
            query: CREATE_ROOM_MUTATION,
            variables: { input: { name: 'Lifecycle Test Room' } },
          },
          result: {
            data: {
              createRoom: {
                id: 'lifecycle-room',
                name: 'Lifecycle Test Room',
                creator_id: 'user1',
                created_at: '2024-01-01T00:00:00Z',
              },
            },
          },
        },
        // Add member
        {
          request: {
            query: ADD_ROOM_MEMBER_MUTATION,
            variables: {
              input: {
                room_id: 'lifecycle-room',
                username: 'newmember',
                role: RoomRole.CONTENT_EDITOR,
              },
            },
          },
          result: {
            data: { addRoomMember: true },
          },
        },
        // Update room
        {
          request: {
            query: UPDATE_ROOM_MUTATION,
            variables: {
              input: {
                room_id: 'lifecycle-room',
                name: 'Updated Lifecycle Room',
              },
            },
          },
          result: {
            data: {
              updateRoom: {
                id: 'lifecycle-room',
                name: 'Updated Lifecycle Room',
                creator_id: 'user1',
                created_at: '2024-01-01T00:00:00Z',
              },
            },
          },
        },
        // Delete room
        {
          request: {
            query: DELETE_ROOM_MUTATION,
            variables: { input: { room_id: 'lifecycle-room' } },
          },
          result: {
            data: { deleteRoom: true },
          },
        },
      ];

      const { result: createResult } = renderHook(() => useMutation(CREATE_ROOM_MUTATION), {
        wrapper: createWrapper(mocks),
      });

      const { result: addResult } = renderHook(() => useMutation(ADD_ROOM_MEMBER_MUTATION), {
        wrapper: createWrapper(mocks),
      });

      const { result: updateResult } = renderHook(() => useMutation(UPDATE_ROOM_MUTATION), {
        wrapper: createWrapper(mocks),
      });

      const { result: deleteResult } = renderHook(() => useMutation(DELETE_ROOM_MUTATION), {
        wrapper: createWrapper(mocks),
      });

      const [createRoom] = createResult.current;
      const [addMember] = addResult.current;
      const [updateRoom] = updateResult.current;
      const [deleteRoom] = deleteResult.current;

      // Create
      await act(async () => {
        const response = await createRoom({
          variables: { input: { name: 'Lifecycle Test Room' } },
        });
        expect(response.data?.createRoom.name).toBe('Lifecycle Test Room');
      });

      // Add member
      await act(async () => {
        const response = await addMember({
          variables: {
            input: {
              room_id: 'lifecycle-room',
              username: 'newmember',
              role: RoomRole.CONTENT_EDITOR,
            },
          },
        });
        expect(response.data?.addRoomMember).toBe(true);
      });

      // Update
      await act(async () => {
        const response = await updateRoom({
          variables: {
            input: {
              room_id: 'lifecycle-room',
              name: 'Updated Lifecycle Room',
            },
          },
        });
        expect(response.data?.updateRoom.name).toBe('Updated Lifecycle Room');
      });

      // Delete
      await act(async () => {
        const response = await deleteRoom({
          variables: { input: { room_id: 'lifecycle-room' } },
        });
        expect(response.data?.deleteRoom).toBe(true);
      });
    });
  });
});

export {};  // For TypeScript isolatedModules