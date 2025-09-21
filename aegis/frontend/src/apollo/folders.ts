import { gql } from '@apollo/client';

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
        parent_id
        created_at
        updated_at
        children {
          id
          name
          parent_id
          created_at
          updated_at
          children {
            id
            name
            parent_id
            created_at
            updated_at
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