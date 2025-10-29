import { gql } from '@apollo/client';

// Room Queries
export const GET_MY_ROOMS = gql`
  query GetMyRooms {
    myRooms {
      id
      name
      creator_id
      created_at
      creator {
        id
        email
        username
      }
      members {
        id
        role
        user {
          id
          email
          username
        }
      }
    }
  }
`;

export const GET_ROOM = gql`
  query GetRoom($id: ID!) {
    room(id: $id) {
      id
      name
      creator_id
      created_at
      creator {
        id
        email
        username
      }
      members {
        id
        role
        user {
          id
          email
          username
        }
      }
      files {
        id
        filename
        mime_type
        encryption_key
        folder_id
        created_at
        is_starred
        file {
          id
          size_bytes
        }
        user {
          id
          email
          username
        }
        folder {
          id
          name
        }
      }
      folders {
        id
        name
        parent_id
        created_at
        updated_at
        is_starred
        user {
          id
          email
          username
        }
        parent {
          id
          name
        }
        children {
          id
          name
        }
        files {
          id
          filename
          mime_type
        }
      }
    }
  }
`;

// Room Mutations
export const CREATE_ROOM_MUTATION = gql`
  mutation CreateRoom($input: CreateRoomInput!) {
    createRoom(input: $input) {
      id
      name
      creator_id
      created_at
    }
  }
`;

export const ADD_ROOM_MEMBER_MUTATION = gql`
  mutation AddRoomMember($input: AddRoomMemberInput!) {
    addRoomMember(input: $input)
  }
`;

export const UPDATE_ROOM_MUTATION = gql`
  mutation UpdateRoom($input: UpdateRoomInput!) {
    updateRoom(input: $input) {
      id
      name
      creator_id
      created_at
    }
  }
`;

export const DELETE_ROOM_MUTATION = gql`
  mutation DeleteRoom($input: DeleteRoomInput!) {
    deleteRoom(input: $input)
  }
`;

export const REMOVE_ROOM_MEMBER_MUTATION = gql`
  mutation RemoveRoomMember($room_id: ID!, $user_id: ID!) {
    removeRoomMember(room_id: $room_id, user_id: $user_id)
  }
`;