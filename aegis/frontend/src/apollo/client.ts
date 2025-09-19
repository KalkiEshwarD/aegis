import { ApolloClient, InMemoryCache, createHttpLink, from } from '@apollo/client';
import { setContext } from '@apollo/client/link/context';
import { onError } from '@apollo/client/link/error';

// Create a custom HTTP link that does NOT process uploads automatically
// This prevents Apollo from trying to handle File objects and redirecting to uploadFile
const httpLink = createHttpLink({
  uri: process.env.REACT_APP_GRAPHQL_ENDPOINT || 'http://localhost:8080/graphql',
  // Explicitly disable file upload handling to prevent interference
  fetchOptions: {
    method: 'POST',
  },
});

// Auth link - Send token from localStorage in Authorization header
const authLink = setContext((_, { headers }) => {
  // Get token from localStorage
  const token = localStorage.getItem('auth_token');
  
  return {
    headers: {
      ...headers,
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    }
  };
});

// Error link to handle authentication errors
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

      // Log authentication errors but don't force redirects
      // Let the AuthContext handle auth state management
      if (message.includes('unauthenticated') || message.includes('Unauthorized') || message.includes('Invalid token')) {
        console.log('Authentication error detected, will be handled by AuthContext');
      }
    });
  }

  if (networkError) {
    console.error(`Network error: ${networkError}`);
    
    // Log network errors but don't force redirects
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
