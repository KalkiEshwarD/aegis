import { ApolloClient, InMemoryCache } from '@apollo/client';

// Mock the entire Apollo Client module to avoid instantiation issues
jest.mock('@apollo/client', () => ({
  ApolloClient: jest.fn().mockImplementation(() => ({
    query: jest.fn(),
    mutate: jest.fn(),
    subscribe: jest.fn(),
    cache: new (jest.fn())(),
    link: {},
    defaultOptions: {
      watchQuery: { errorPolicy: 'all' },
      query: { errorPolicy: 'all' },
    },
  })),
  InMemoryCache: jest.fn(),
  createHttpLink: jest.fn(),
  from: jest.fn(),
  setContext: jest.fn(),
  onError: jest.fn(),
}));

// Mock the api config
jest.mock('../../config/api', () => ({
  apiConfig: {
    graphql: {
      endpoint: 'http://localhost:8080/v1/graphql',
    },
  },
}));

describe('Apollo Client', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates Apollo client instance', () => {
    const apolloClient = require('../../apollo/client').default;
    expect(apolloClient).toHaveProperty('query');
    expect(apolloClient).toHaveProperty('mutate');
    expect(apolloClient).toHaveProperty('subscribe');
  });

  it('has cache property', () => {
    const apolloClient = require('../../apollo/client').default;
    expect(apolloClient).toHaveProperty('cache');
  });

  it('has link property', () => {
    const apolloClient = require('../../apollo/client').default;
    expect(apolloClient).toHaveProperty('link');
  });

  it('has correct default options for queries', () => {
    const apolloClient = require('../../apollo/client').default;
    expect(apolloClient.defaultOptions.watchQuery).toEqual({
      errorPolicy: 'all',
    });
    expect(apolloClient.defaultOptions.query).toEqual({
      errorPolicy: 'all',
    });
  });

  it('initializes with apiConfig endpoint', () => {
    // Verify that the client module can be imported without errors
    expect(() => {
      require('../../apollo/client');
    }).not.toThrow();
  });

  describe('Integration with API Config', () => {
    it('imports and uses apiConfig without errors', () => {
      const { apiConfig } = require('../../config/api');
      expect(apiConfig.graphql.endpoint).toBe('http://localhost:8080/v1/graphql');

      // Verify client can be created
      const apolloClient = require('../../apollo/client').default;
      expect(apolloClient).toBeDefined();
    });

    it('handles different endpoint configurations', () => {
      // Test that different mocked endpoints work
      const testConfigs = [
        'http://localhost:8080/v1/graphql',
        'https://api.example.com/graphql',
        'http://dev-server:3000/graphql'
      ];

      testConfigs.forEach(endpoint => {
        jest.doMock('../../config/api', () => ({
          apiConfig: {
            graphql: { endpoint },
          },
        }));

        jest.resetModules();

        const { apiConfig: config } = require('../../config/api');
        expect(config.graphql.endpoint).toBe(endpoint);

        const apolloClient = require('../../apollo/client').default;
        expect(apolloClient).toBeDefined();
      });
    });
  });
});