import { ApolloClient, InMemoryCache, createHttpLink, from } from '@apollo/client';
import { setContext } from '@apollo/client/link/context';
import { onError } from '@apollo/client/link/error';

// HTTP link to GraphQL endpoint
const httpLink = createHttpLink({
  uri: process.env.REACT_APP_GRAPHQL_ENDPOINT || 'http://localhost:8080/graphql',
});

// Auth link to add authorization header
const authLink = setContext((_, { headers }) => {
  const token = localStorage.getItem('aegis_token');
  
  return {
    headers: {
      ...headers,
      authorization: token ? `Bearer ${token}` : '',
    }
  };
});

// Error link to handle authentication errors
const errorLink = onError(({ graphQLErrors, networkError, operation, forward }) => {
  if (graphQLErrors) {
    graphQLErrors.forEach(({ message, locations, path }) => {
      console.error(
        `GraphQL error: Message: ${message}, Location: ${locations}, Path: ${path}`
      );
      
      // Handle authentication errors
      if (message.includes('Unauthorized') || message.includes('Invalid token')) {
        localStorage.removeItem('aegis_token');
        localStorage.removeItem('aegis_user');
        window.location.href = '/login';
      }
    });
  }

  if (networkError) {
    console.error(`Network error: ${networkError}`);
    
    // Handle network authentication errors
    if ('statusCode' in networkError && networkError.statusCode === 401) {
      localStorage.removeItem('aegis_token');
      localStorage.removeItem('aegis_user');
      window.location.href = '/login';
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
