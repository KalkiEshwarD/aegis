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