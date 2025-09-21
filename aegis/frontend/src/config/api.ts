// API Configuration Types
interface GraphQLConfig {
  endpoint: string;
  timeout: number; // in milliseconds
  retryAttempts: number;
  retryDelay: number; // in milliseconds
}

interface RESTEndpoints {
  health: string;
  files: {
    download: (id: string) => string;
  };
  share: {
    access: (token: string) => string;
    view: (token: string) => string;
  };
  shared: string;
}

interface RESTConfig {
  baseURL: string;
  endpoints: RESTEndpoints;
  timeout: number; // in milliseconds
  retryAttempts: number;
  retryDelay: number; // in milliseconds
}

interface ApiConfig {
  graphql: GraphQLConfig;
  rest: RESTConfig;
}

interface EnvironmentConfig {
  development: ApiConfig;
  production: ApiConfig;
}

// Environment-specific API configurations
const environmentConfigs: EnvironmentConfig = {
  development: {
    graphql: {
      endpoint: process.env.REACT_APP_GRAPHQL_ENDPOINT || 'http://localhost:3000/v1/graphql',
      timeout: 30000, // 30 seconds
      retryAttempts: 3,
      retryDelay: 1000, // 1 second
    },
    rest: {
      baseURL: process.env.REACT_APP_API_BASE_URL || 'http://localhost:3000',
      endpoints: {
        health: '/v1/health',
        files: {
          download: (id: string) => `/v1/api/files/${id}/download`,
        },
        share: {
          access: (token: string) => `/v1/share/${token}/access`,
          view: (token: string) => `/v1/share/${token}`,
        },
        shared: '/v1/shared',
      },
      timeout: 30000, // 30 seconds
      retryAttempts: 3,
      retryDelay: 1000, // 1 second
    },
  },
  production: {
    graphql: {
      endpoint: process.env.REACT_APP_GRAPHQL_ENDPOINT_PROD || 'https://api.aegis.com/v1/graphql',
      timeout: 45000, // 45 seconds
      retryAttempts: 5,
      retryDelay: 2000, // 2 seconds
    },
    rest: {
      baseURL: process.env.REACT_APP_API_BASE_URL_PROD || 'https://api.aegis.com',
      endpoints: {
        health: '/v1/health',
        files: {
          download: (id: string) => `/v1/api/files/${id}/download`,
        },
        share: {
          access: (token: string) => `/v1/share/${token}/access`,
          view: (token: string) => `/v1/share/${token}`,
        },
        shared: '/v1/shared',
      },
      timeout: 45000, // 45 seconds
      retryAttempts: 5,
      retryDelay: 2000, // 2 seconds
    },
  },
};

/**
 * Get the current environment based on NODE_ENV
 */
function getCurrentEnvironment(): keyof EnvironmentConfig {
  const isProduction = process.env.NODE_ENV === 'production';
  return isProduction ? 'production' : 'development';
}

/**
 * Get the API configuration for the current environment
 */
export function getApiConfig(): ApiConfig {
  const environment = getCurrentEnvironment();
  return environmentConfigs[environment];
}

/**
 * Get the API configuration for a specific environment
 */
export function getApiConfigForEnvironment(environment: keyof EnvironmentConfig): ApiConfig {
  return environmentConfigs[environment];
}

/**
 * Get GraphQL configuration for the current environment
 */
export function getGraphQLConfig(): GraphQLConfig {
  return getApiConfig().graphql;
}

/**
 * Get REST configuration for the current environment
 */
export function getRESTConfig(): RESTConfig {
  return getApiConfig().rest;
}

/**
 * Build a full REST endpoint URL
 */
export function buildRESTUrl(endpoint: string): string {
  const config = getRESTConfig();
  return `${config.baseURL}${endpoint}`;
}

// Export the current environment's configuration for backward compatibility
export const apiConfig = getApiConfig();