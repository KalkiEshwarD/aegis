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
      }
      members {
        id
        role
        user {
          id
          email
        }
      }
      files {
        id
        filename
        mime_type
        encryption_key
        folder_id
        created_at
        file {
          id
          size_bytes
        }
        user {
          id
          email
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
        user {
          id
          email
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