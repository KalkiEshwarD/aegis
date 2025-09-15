import { gql } from '@apollo/client';

// Authentication Mutations
export const REGISTER_MUTATION = gql`
  mutation Register($input: RegisterInput!) {
    register(input: $input) {
      token
      user {
        id
        email
        storage_quota
        used_storage
        is_admin
        created_at
      }
    }
  }
`;

export const LOGIN_MUTATION = gql`
  mutation Login($input: LoginInput!) {
    login(input: $input) {
      token
      user {
        id
        email
        storage_quota
        used_storage
        is_admin
        created_at
      }
    }
  }
`;

// User Queries
export const GET_ME = gql`
  query GetMe {
    me {
      id
      email
      storage_quota
      used_storage
      is_admin
      created_at
    }
  }
`;

export const GET_MY_FILES = gql`
  query GetMyFiles($filter: FileFilterInput) {
    myFiles(filter: $filter) {
      id
      filename
      mime_type
      created_at
      file {
        id
        size_bytes
        content_hash
      }
    }
  }
`;

export const GET_MY_STATS = gql`
  query GetMyStats {
    myStats {
      total_files
      used_storage
      storage_quota
      storage_savings
    }
  }
`;

// File Mutations
export const UPLOAD_FILE_MUTATION = gql`
  mutation UploadFile($input: UploadFileInput!) {
    uploadFile(input: $input) {
      id
      filename
      mime_type
      created_at
      file {
        id
        size_bytes
        content_hash
      }
    }
  }
`;

export const DELETE_FILE_MUTATION = gql`
  mutation DeleteFile($id: ID!) {
    deleteFile(id: $id)
  }
`;

export const DOWNLOAD_FILE_MUTATION = gql`
  mutation DownloadFile($id: ID!) {
    downloadFile(id: $id)
  }
`;

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
        created_at
        file {
          id
          size_bytes
        }
        user {
          id
          email
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

export const REMOVE_ROOM_MEMBER_MUTATION = gql`
  mutation RemoveRoomMember($room_id: ID!, $user_id: ID!) {
    removeRoomMember(room_id: $room_id, user_id: $user_id)
  }
`;

export const SHARE_FILE_TO_ROOM_MUTATION = gql`
  mutation ShareFileToRoom($user_file_id: ID!, $room_id: ID!) {
    shareFileToRoom(user_file_id: $user_file_id, room_id: $room_id)
  }
`;

// Admin Queries
export const GET_ADMIN_DASHBOARD = gql`
  query GetAdminDashboard {
    adminDashboard {
      total_users
      total_files
      total_storage_used
      recent_uploads {
        id
        filename
        created_at
        user {
          id
          email
        }
        file {
          size_bytes
        }
      }
    }
  }
`;

export const GET_ALL_USERS = gql`
  query GetAllUsers {
    allUsers {
      id
      email
      storage_quota
      used_storage
      is_admin
      created_at
    }
  }
`;

export const GET_ALL_FILES = gql`
  query GetAllFiles {
    allFiles {
      id
      filename
      mime_type
      created_at
      user {
        id
        email
      }
      file {
        id
        size_bytes
        content_hash
      }
    }
  }
`;

// Admin Mutations
export const PROMOTE_USER_TO_ADMIN_MUTATION = gql`
  mutation PromoteUserToAdmin($user_id: ID!) {
    promoteUserToAdmin(user_id: $user_id)
  }
`;

export const DELETE_USER_ACCOUNT_MUTATION = gql`
  mutation DeleteUserAccount($user_id: ID!) {
    deleteUserAccount(user_id: $user_id)
  }
`;

// Health Check
export const HEALTH_QUERY = gql`
  query Health {
    health
  }
`;
