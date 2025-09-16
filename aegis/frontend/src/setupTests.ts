// Set up jsdom environment before anything else
const { JSDOM } = require('jsdom');
const dom = new JSDOM('<!doctype html><html><body></body></html>', {
  url: 'http://localhost:3000',
});
global.window = dom.window;
global.document = dom.window.document;
global.navigator = dom.window.navigator;

// Copy properties from window to global
Object.keys(dom.window).forEach(key => {
  if (!(key in global)) {
    global[key] = dom.window[key];
  }
});

// Add TextEncoder and TextDecoder for crypto operations
import { TextEncoder, TextDecoder } from 'util';
Object.defineProperty(global, 'TextEncoder', { value: TextEncoder });
Object.defineProperty(global, 'TextDecoder', { value: TextDecoder });

// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';

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

// Mock window.location
const locationMock = {
  href: '',
  pathname: '/',
  search: '',
  hash: '',
};
Object.defineProperty(window, 'location', {
  value: locationMock,
  writable: true,
});

// Mock window.location methods
Object.defineProperty(window, 'location', {
  value: {
    ...locationMock,
    assign: jest.fn(),
    replace: jest.fn(),
    reload: jest.fn(),
  },
  writable: true,
});

// Mock crypto.subtle for crypto utilities
Object.defineProperty(window, 'crypto', {
  value: {
    subtle: {
      digest: jest.fn(),
    },
    getRandomValues: jest.fn(),
  },
});

// Mock FileReader for file utilities
global.FileReader = jest.fn().mockImplementation(() => ({
  readAsArrayBuffer: jest.fn(function() {
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
global.File = jest.fn().mockImplementation((parts, filename, options) => ({
  name: filename,
  size: parts ? parts.reduce((total, part) => total + (part.length || 0), 0) : 0,
  type: options?.type || '',
  arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(8)),
  text: jest.fn().mockResolvedValue('test content'),
}));

// Mock URL for file utilities
global.URL = {
  createObjectURL: jest.fn(() => 'mock-url'),
  revokeObjectURL: jest.fn(),
};

// Mock document methods for file download
Object.defineProperty(document, 'createElement', {
  value: jest.fn(() => ({
    href: '',
    download: '',
    click: jest.fn(),
    style: { display: '' },
  })),
});

Object.defineProperty(document.body, 'appendChild', {
  value: jest.fn(),
});

Object.defineProperty(document.body, 'removeChild', {
  value: jest.fn(),
});

// Reset all mocks before each test
beforeEach(() => {
  jest.clearAllMocks();
  localStorageMock.getItem.mockClear();
  localStorageMock.setItem.mockClear();
  localStorageMock.removeItem.mockClear();
  localStorageMock.clear.mockClear();
  locationMock.href = '';
});
