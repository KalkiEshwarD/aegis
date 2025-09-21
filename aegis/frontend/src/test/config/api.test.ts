import { apiConfig } from '../../config/api';

describe('API Configuration', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    // Reset environment variables before each test
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    // Restore original environment after each test
    process.env = originalEnv;
  });

  describe('Configuration Structure', () => {
    it('should export apiConfig object with graphql property', () => {
      expect(apiConfig).toHaveProperty('graphql');
      expect(apiConfig.graphql).toHaveProperty('endpoint');
    });

    it('should have endpoint as a string', () => {
      expect(typeof apiConfig.graphql.endpoint).toBe('string');
    });

    it('should have valid GraphQL endpoint format', () => {
      const endpoint = apiConfig.graphql.endpoint;
      expect(endpoint).toMatch(/^https?:\/\/.+/);
      expect(endpoint).toMatch(/graphql$/);
    });
  });

  describe('Environment-based Configuration', () => {
    it('should use development endpoint when NODE_ENV is development', () => {
      // Mock the environment for this test
      process.env.NODE_ENV = 'development';
      delete process.env.REACT_APP_GRAPHQL_ENDPOINT;
      delete process.env.REACT_APP_GRAPHQL_ENDPOINT_PROD;

      // Force module reload to pick up new env vars
      jest.resetModules();
      const { apiConfig: freshConfig } = require('../../config/api');

      expect(freshConfig.graphql.endpoint).toBe('http://localhost:8080/v1/graphql');
    });

    it('should use production endpoint when NODE_ENV is production', () => {
      process.env.NODE_ENV = 'production';
      delete process.env.REACT_APP_GRAPHQL_ENDPOINT;
      delete process.env.REACT_APP_GRAPHQL_ENDPOINT_PROD;

      jest.resetModules();
      const { apiConfig: freshConfig } = require('../../config/api');

      expect(freshConfig.graphql.endpoint).toBe('https://api.aegis.com/v1/graphql');
    });

    it('should prioritize REACT_APP_GRAPHQL_ENDPOINT in development', () => {
      process.env.NODE_ENV = 'development';
      process.env.REACT_APP_GRAPHQL_ENDPOINT = 'http://custom-dev:3000/graphql';

      jest.resetModules();
      const { apiConfig: freshConfig } = require('../../config/api');

      expect(freshConfig.graphql.endpoint).toBe('http://custom-dev:3000/graphql');
    });

    it('should prioritize REACT_APP_GRAPHQL_ENDPOINT_PROD in production', () => {
      process.env.NODE_ENV = 'production';
      process.env.REACT_APP_GRAPHQL_ENDPOINT_PROD = 'https://custom-prod.com/graphql';

      jest.resetModules();
      const { apiConfig: freshConfig } = require('../../config/api');

      expect(freshConfig.graphql.endpoint).toBe('https://custom-prod.com/graphql');
    });
  });
});