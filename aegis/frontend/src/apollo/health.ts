import { gql } from '@apollo/client';

// Health Check
export const HEALTH_QUERY = gql`
  query Health {
    health
  }
`;