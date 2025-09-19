import { gql } from '@apollo/client';

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