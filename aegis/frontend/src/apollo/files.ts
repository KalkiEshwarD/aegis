import { gql } from '@apollo/client';

// File Queries
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

export const MOVE_FILE_MUTATION = gql`
  mutation MoveFile($input: MoveFileInput!) {
    moveFile(input: $input)
  }
`;

export const SHARE_FILE_TO_ROOM_MUTATION = gql`
  mutation ShareFileToRoom($user_file_id: ID!, $room_id: ID!) {
    shareFileToRoom(user_file_id: $user_file_id, room_id: $room_id)
  }
`;