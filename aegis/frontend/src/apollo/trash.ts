import { gql } from '@apollo/client';

// Trash Queries
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

// Trash Mutations
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