import { gql } from '@apollo/client';

// Authentication Mutations
export const REGISTER_MUTATION = gql`
  mutation Register($input: RegisterInput!) {
    register(input: $input) {
      token
      user {
        id
        username
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
        username
        email
        storage_quota
        used_storage
        is_admin
        created_at
      }
    }
  }
`;

export const LOGOUT_MUTATION = gql`
  mutation Logout {
    logout
  }
`;

export const REFRESH_TOKEN_MUTATION = gql`
  mutation RefreshToken {
    refreshToken {
      token
      user {
        id
        username
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
      encryption_key
      folder_id
      created_at
      file {
        id
        size_bytes
        content_hash
      }
      folder {
        id
        name
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
      folder_id
      created_at
      file {
        id
        size_bytes
        content_hash
      }
      folder {
        id
        name
      }
    }
  }
`;

export const UPLOAD_FILE_FROM_MAP_MUTATION = gql`
  mutation UploadFileFromMap($input: UploadFileFromMapInput!) {
    uploadFileFromMap(input: $input) {
      id
      filename
      mime_type
      folder_id
      created_at
      file {
        id
        size_bytes
        content_hash
      }
      folder {
        id
        name
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

// Trash Operations
export const GET_MY_TRASHED_FILES = gql`
  query GetMyTrashedFiles {
    myTrashedFiles {
      id
      filename
      mime_type
      folder_id
      created_at
      file {
        id
        size_bytes
        content_hash
      }
      folder {
        id
        name
      }
    }
  }
`;

export const RESTORE_FILE_MUTATION = gql`
  mutation RestoreFile($fileID: ID!) {
    restoreFile(fileID: $fileID)
  }
`;

export const PERMANENTLY_DELETE_FILE_MUTATION = gql`
  mutation PermanentlyDeleteFile($fileID: ID!) {
    permanentlyDeleteFile(fileID: $fileID)
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

// Folder Queries
export const GET_MY_FOLDERS = gql`
  query GetMyFolders {
    myFolders {
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
        created_at
      }
      files {
        id
        filename
        mime_type
        created_at
        file {
          size_bytes
        }
      }
    }
  }
`;

export const GET_FOLDER = gql`
  query GetFolder($id: ID!) {
    folder(id: $id) {
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
        created_at
        updated_at
      }
      files {
        id
        filename
        mime_type
        encryption_key
        created_at
        file {
          id
          size_bytes
          content_hash
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

// Folder Mutations
export const CREATE_FOLDER_MUTATION = gql`
  mutation CreateFolder($input: CreateFolderInput!) {
    createFolder(input: $input) {
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
    }
  }
`;

export const RENAME_FOLDER_MUTATION = gql`
  mutation RenameFolder($input: RenameFolderInput!) {
    renameFolder(input: $input)
  }
`;

export const DELETE_FOLDER_MUTATION = gql`
  mutation DeleteFolder($id: ID!) {
    deleteFolder(id: $id)
  }
`;

export const MOVE_FOLDER_MUTATION = gql`
  mutation MoveFolder($input: MoveFolderInput!) {
    moveFolder(input: $input)
  }
`;

export const MOVE_FILE_MUTATION = gql`
  mutation MoveFile($input: MoveFileInput!) {
    moveFile(input: $input)
  }
`;

export const SHARE_FOLDER_TO_ROOM_MUTATION = gql`
  mutation ShareFolderToRoom($input: ShareFolderToRoomInput!) {
    shareFolderToRoom(input: $input)
  }
`;

export const REMOVE_FOLDER_FROM_ROOM_MUTATION = gql`
  mutation RemoveFolderFromRoom($folder_id: ID!, $room_id: ID!) {
    removeFolderFromRoom(folder_id: $folder_id, room_id: $room_id)
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
      encryption_key
      folder_id
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
      folder {
        id
        name
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

// File Share Queries
export const GET_FILE_SHARES = gql`
  query GetFileShares {
    myShares {
      id
      user_file_id
      share_token
      encrypted_key
      salt
      iv
      expires_at
      max_downloads
      download_count
      created_at
      updated_at
      user_file {
        id
        filename
        mime_type
        file {
          size_bytes
        }
      }
    }
  }
`;

// File Share Mutations
export const CREATE_FILE_SHARE_MUTATION = gql`
  mutation CreateFileShare($input: CreateFileShareInput!) {
    createFileShare(input: $input) {
      id
      user_file_id
      share_token
      encrypted_key
      salt
      iv
      expires_at
      max_downloads
      download_count
      created_at
      updated_at
    }
  }
`;

export const DELETE_FILE_SHARE_MUTATION = gql`
  mutation DeleteFileShare($id: ID!) {
    deleteFileShare(id: $id)
  }
`;

export const ACCESS_SHARED_FILE_MUTATION = gql`
  mutation AccessSharedFile($input: AccessSharedFileInput!) {
    accessSharedFile(input: $input) {
      file {
        id
        filename
        mime_type
        encryption_key
        created_at
        file {
          id
          size_bytes
          content_hash
        }
        user {
          id
          email
        }
      }
      share {
        id
        share_token
        expires_at
        max_downloads
        download_count
        created_at
      }
      download_url
    }
  }
`;

// Health Check
export const HEALTH_QUERY = gql`
  query Health {
    health
  }
`;

// Shared with Me Query
export const GET_SHARED_WITH_ME_QUERY = gql`
  query GetSharedWithMe {
    sharedWithMe {
      id
      filename
      mime_type
      size_bytes
      share_token
      shared_by {
        id
        username
        email
      }
      first_access_at
      last_access_at
      access_count
      max_downloads
      download_count
      expires_at
      created_at
    }
  }
`;

// Update File Share Mutation
export const UPDATE_FILE_SHARE_MUTATION = gql`
  mutation UpdateFileShare($input: UpdateFileShareInput!) {
    updateFileShare(input: $input) {
      id
      user_file_id
      share_token
      encrypted_key
      salt
      iv
      expires_at
      max_downloads
      download_count
      created_at
      updated_at
      user_file {
        id
        filename
        mime_type
        file {
          size_bytes
        }
      }
    }
  }
`;


// Public Share Queries (for accessing shared files)
export const GET_SHARED_FILE = gql`
  query GetSharedFile($token: String!) {
    shareMetadata(token: $token) {
      token
      filename
      mime_type
      size_bytes
      max_downloads
      download_count
      expires_at
      created_at
    }
  }
`;

export const ACCESS_SHARED_FILE = gql`
  mutation AccessSharedFile($input: AccessSharedFileInput!) {
    accessSharedFile(input: $input)
  }
`;

export const DOWNLOAD_SHARED_FILE = gql`
  mutation DownloadSharedFile($input: AccessSharedFileInput!) {
    accessSharedFile(input: $input)
  }
`;
