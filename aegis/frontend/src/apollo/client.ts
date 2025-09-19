import { ApolloClient, InMemoryCache, createHttpLink, from } from '@apollo/client';
import { setContext } from '@apollo/client/link/context';
import { onError } from '@apollo/client/link/error';

// Create a custom HTTP link that does NOT process uploads automatically
// This prevents Apollo from trying to handle File objects and redirecting to uploadFile
const httpLink = createHttpLink({
  uri: process.env.REACT_APP_GRAPHQL_ENDPOINT || 'http://localhost:8080/graphql',
  // Include credentials to send cookies with requests
  credentials: 'include',
  // Explicitly disable file upload handling to prevent interference
  fetchOptions: {
    method: 'POST',
  },
});

// Auth link - Use cookies for authentication (HttpOnly cookies set by backend)
const authLink = setContext((_, { headers }) => {
  return {
    headers: {
      ...headers,
    },
    // Include credentials to send cookies with requests
    credentials: 'include',
  };
});

// Error link to handle authentication errors and token refresh
const errorLink = onError(({ graphQLErrors, networkError, operation, forward }) => {
  if (graphQLErrors) {
    graphQLErrors.forEach(({ message, locations, path }) => {
      // Skip logging authentication errors for the 'me' query since it's expected to fail when not logged in
      if (operation.operationName === 'GetMe' && message.includes('unauthenticated')) {
        return; // Silently ignore expected auth failures for user checks
      }

      console.error(
        `GraphQL error: Message: ${message}, Location: ${locations}, Path: ${path}`
      );

      // Handle authentication errors with token refresh
      if (message.includes('unauthenticated') || message.includes('Unauthorized') || message.includes('Invalid token')) {
        console.log('Authentication error detected, attempting token refresh');

        // For now, we'll let the AuthContext handle auth state management
        // In a more advanced implementation, we could attempt token refresh here
        console.log('Token refresh should be handled by AuthContext');
      }
    });
  }

  if (networkError) {
    console.error(`Network error: ${networkError}`);

    // Handle network authentication errors
    if ('statusCode' in networkError && networkError.statusCode === 401) {
      console.log('Network authentication error detected, will be handled by AuthContext');
    }
  }
});

// Create Apollo Client
const client = new ApolloClient({
  link: from([errorLink, authLink, httpLink]),
  cache: new InMemoryCache(),
  defaultOptions: {
    watchQuery: {
      errorPolicy: 'all',
    },
    query: {
      errorPolicy: 'all',
    },
  },
});

export default client;
