// Add TextEncoder and TextDecoder for crypto operations
const { TextEncoder, TextDecoder } = require('util');
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// Note: Jest automatically sets up jsdom when testEnvironment is "jsdom"
// Manual jsdom setup removed to avoid conflicts



// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
require('@testing-library/jest-dom');

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Keep window.location as provided by jsdom
// Only mock specific location properties if needed for tests

// Mock crypto.subtle for crypto utilities
Object.defineProperty(window, 'crypto', {
  value: {
    subtle: {
      digest: jest.fn().mockImplementation(async (algorithm, data) => {
        // Return a mock SHA-256 hash as ArrayBuffer (32 bytes)
        const hash = new ArrayBuffer(32);
        const view = new Uint8Array(hash);
        // Fill with deterministic values based on data length for consistent testing
        for (let i = 0; i < 32; i++) {
          view[i] = (data.byteLength + i) % 256;
        }
        return hash;
      }),
    },
    getRandomValues: jest.fn((array) => {
      // Fill array with deterministic values for testing
      for (let i = 0; i < array.length; i++) {
        array[i] = (i * 7) % 256; // Deterministic pattern
      }
      return array;
    }),
  },
});

// Mock FileReader for file utilities
global.FileReader = jest.fn().mockImplementation(() => ({
  readAsArrayBuffer: jest.fn(function(this: any, file) {
    setTimeout(() => {
      if (this.onload) {
        this.result = new ArrayBuffer(8);
        this.onload();
      }
    }, 0);
  }),
  readAsText: jest.fn(),
  onload: null,
  onerror: null,
  result: null,
}));

// Mock Blob for file utilities
global.Blob = jest.fn().mockImplementation((parts, options) => ({
  size: parts ? parts.reduce((total, part) => total + (part.length || 0), 0) : 0,
  type: options?.type || '',
}));

// Mock File for file utilities
global.File = jest.fn().mockImplementation((parts, filename, options) => {
  const content = parts && parts.length > 0 ? parts[0] : '';
  const size = content ? content.length || 0 : 0;
  const file = {
    name: filename,
    size: size,
    type: options?.type || '',
    arrayBuffer: jest.fn().mockResolvedValue(
      content instanceof ArrayBuffer ? content : new ArrayBuffer(size || 8)
    ),
    text: jest.fn().mockResolvedValue(content || 'test content'),
  };
  return file;
});

// Mock URL for file utilities
global.URL = {
  createObjectURL: jest.fn(() => 'mock-url'),
  revokeObjectURL: jest.fn(),
};

// Mock Apollo Client functions
jest.mock('@apollo/client', () => {
  const actual = jest.requireActual('@apollo/client');
  return {
    ...actual,
    setContext: jest.fn(() => ({ type: 'context' })),
    onError: jest.fn(() => ({ type: 'error' })),
    createHttpLink: jest.fn(() => ({ type: 'http' })),
    useMutation: jest.fn(),
    gql: jest.fn((template: TemplateStringsArray) => template.join('')),
  };
});

// Keep document methods as provided by jsdom
// Only mock specific methods if needed for file download tests

// Reset all mocks before each test
beforeEach(() => {
  jest.clearAllMocks();
  localStorageMock.getItem.mockClear();
  localStorageMock.setItem.mockClear();
  localStorageMock.removeItem.mockClear();
  localStorageMock.clear.mockClear();
});
