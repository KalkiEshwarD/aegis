# Apollo Client

This directory contains the configuration for Apollo Client, which is used for communicating with the GraphQL backend.

## Files

*   `client.ts`: This file configures and creates the Apollo Client instance. It sets up the HTTP link to the GraphQL endpoint, the authentication link to add JWT tokens to requests, and an error link to handle GraphQL and network errors.
*   `queries.ts`: This file defines all the GraphQL queries and mutations that are used by the application. These are defined using the `gql` template literal tag from `@apollo/client`.
*   Other files (`admin.ts`, `auth.ts`, etc.): These files organize the queries and mutations into different domains, which are then re-exported from `index.ts`.

## Functionality

This directory is responsible for all communication with the GraphQL backend. The configured Apollo Client instance is used throughout the application to send queries and mutations and to manage the local cache of GraphQL data.

The `queries.ts` file serves as a central repository for all the GraphQL operations, making it easy to find and reuse them across different components.
