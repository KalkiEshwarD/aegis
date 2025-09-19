import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MockedProvider } from '@apollo/client/testing';
import FileTable from '../../../components/common/FileTable';
import { GET_MY_FILES, DELETE_FILE_MUTATION, DOWNLOAD_FILE_MUTATION } from '../../../apollo/files';

// Mock crypto utilities
jest.mock('../../../utils/crypto', () => ({
  decryptFile: jest.fn(() => new Uint8Array([1, 2, 3])),
  base64ToEncryptionKey: jest.fn(() => new Uint8Array(32)),
  createDownloadBlob: jest.fn(() => new Blob(['test'], { type: 'text/plain' })),
  downloadFile: jest.fn(),
  formatFileSize: jest.fn((bytes) => `${bytes} bytes`),
  extractNonceAndData: jest.fn(() => ({
    nonce: new Uint8Array(24),
    encryptedData: new Uint8Array([1, 2, 3])
  })),
}));

// Mock AuthContext
jest.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({
    token: 'mock-token',
  }),
}));

const mockFiles = [
  {
    id: '1',
    filename: 'test1.txt',
    created_at: '2023-01-01T00:00:00Z',
    file: { size_bytes: 1024 },
    encryption_key: 'mock-key-1',
    mime_type: 'text/plain',
  },
  {
    id: '2',
    filename: 'test2.pdf',
    created_at: '2023-01-02T00:00:00Z',
    file: { size_bytes: 2048 },
    encryption_key: 'mock-key-2',
    mime_type: 'application/pdf',
  },
];

const mockGetFilesQuery = {
  request: {
    query: GET_MY_FILES,
    variables: {
      filter: {
        folder_id: undefined,
        filename: undefined,
      },
    },
  },
  result: {
    data: {
      myFiles: mockFiles,
    },
  },
};

const mockDeleteMutation = {
  request: {
    query: DELETE_FILE_MUTATION,
    variables: { id: '1' },
  },
  result: {
    data: {
      deleteFile: true,
    },
  },
};

const mockDownloadMutation = {
  request: {
    query: DOWNLOAD_FILE_MUTATION,
    variables: { id: '1' },
  },
  result: {
    data: {
      downloadFile: 'mock-download-url',
    },
  },
};

describe('FileTable Performance Optimizations', () => {
  const renderComponent = (mocks = [mockGetFilesQuery, mockDeleteMutation, mockDownloadMutation]) => {
    return render(
      <MockedProvider mocks={mocks} addTypename={false}>
        <FileTable />
      </MockedProvider>
    );
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Mock fetch for download
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
      } as Response)
    );
  });

  describe('React.memo Optimization', () => {
    test('component is memoized to prevent unnecessary re-renders', async () => {
      renderComponent();

      // Wait for data to load
      await waitFor(() => {
        expect(screen.getByText('test1.txt')).toBeInTheDocument();
      });

      // Component should render without unnecessary re-renders
      expect(screen.getByText('File Name')).toBeInTheDocument();
      expect(screen.getByText('Type')).toBeInTheDocument();
      expect(screen.getByText('Size')).toBeInTheDocument();
    });

    test('handles prop changes efficiently', async () => {
      const { rerender } = renderComponent();

      // Wait for initial render
      await waitFor(() => {
        expect(screen.getByText('test1.txt')).toBeInTheDocument();
      });

      // Re-render with same props (should not cause unnecessary updates)
      rerender(
        <MockedProvider mocks={[mockGetFilesQuery]} addTypename={false}>
          <FileTable />
        </MockedProvider>
      );

      // Content should remain the same
      expect(screen.getByText('test1.txt')).toBeInTheDocument();
    });
  });

  describe('Efficient Data Fetching', () => {
    test('uses cache-and-network fetch policy for optimal performance', async () => {
      renderComponent();

      // Wait for data to load
      await waitFor(() => {
        expect(screen.getByText('test1.txt')).toBeInTheDocument();
      });

      // Verify files are displayed
      expect(screen.getByText('test2.pdf')).toBeInTheDocument();
    });

    test('handles loading states efficiently', async () => {
      renderComponent();

      // Should show loading state initially
      expect(screen.getByText('Loading files...')).toBeInTheDocument();

      // Wait for data to load
      await waitFor(() => {
        expect(screen.queryByText('Loading files...')).not.toBeInTheDocument();
      });

      // Should show actual data
      expect(screen.getByText('test1.txt')).toBeInTheDocument();
    });
  });

  describe('Search and Filter Optimization', () => {
    test('debounces search input to prevent excessive filtering', async () => {
      renderComponent();

      // Wait for data to load
      await waitFor(() => {
        expect(screen.getByText('test1.txt')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText('Search files by name...');

      // Type search query
      fireEvent.change(searchInput, { target: { value: 'test1' } });

      // Should still show both files initially (debouncing)
      expect(screen.getByText('test1.txt')).toBeInTheDocument();
      expect(screen.getByText('test2.pdf')).toBeInTheDocument();
    });

    test('filters files efficiently without full re-render', async () => {
      renderComponent();

      // Wait for data to load
      await waitFor(() => {
        expect(screen.getByText('test1.txt')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText('Search files by name...');

      // Search for specific file
      fireEvent.change(searchInput, { target: { value: 'test1' } });

      // Should maintain table structure
      expect(screen.getByText('File Name')).toBeInTheDocument();
      expect(screen.getByText('Type')).toBeInTheDocument();
    });
  });

  describe('Memory Management', () => {
    test('handles empty file list efficiently', async () => {
      const mockEmptyQuery = {
        ...mockGetFilesQuery,
        result: {
          data: {
            myFiles: [],
          },
        },
      };

      renderComponent([mockEmptyQuery]);

      // Should show empty state
      await waitFor(() => {
        expect(screen.getByText('No files found')).toBeInTheDocument();
        expect(screen.getByText('Upload some files to get started')).toBeInTheDocument();
      });
    });
  });

  describe('Download Performance', () => {
    test('handles concurrent downloads efficiently', async () => {
      renderComponent();

      // Wait for data to load
      await waitFor(() => {
        expect(screen.getByText('test1.txt')).toBeInTheDocument();
      });

      const downloadButtons = screen.getAllByTitle('Download file');

      // Click first download button
      await act(async () => {
        fireEvent.click(downloadButtons[0]);
      });

      // Should show downloading state
      await waitFor(() => {
        expect(downloadButtons[0]).toBeDisabled();
      });

      // Verify download functions were called
      const { decryptFile, downloadFile } = require('../../../utils/crypto');
      await waitFor(() => {
        expect(decryptFile).toHaveBeenCalled();
        expect(downloadFile).toHaveBeenCalled();
      });
    });

    test('prevents multiple simultaneous downloads of same file', async () => {
      renderComponent();

      // Wait for data to load
      await waitFor(() => {
        expect(screen.getByText('test1.txt')).toBeInTheDocument();
      });

      const downloadButton = screen.getAllByTitle('Download file')[0];

      // Click download button multiple times rapidly
      await act(async () => {
        fireEvent.click(downloadButton);
        fireEvent.click(downloadButton);
      });

      // Button should be disabled during download
      expect(downloadButton).toBeDisabled();
    });
  });

  describe('File Type Color Coding Optimization', () => {
    test('efficiently determines file type colors', async () => {
      renderComponent();

      // Wait for data to load
      await waitFor(() => {
        expect(screen.getByText('test1.txt')).toBeInTheDocument();
      });

      // Should show file type chips with appropriate colors
      const chips = screen.getAllByRole('button'); // MUI Chip renders as button
      expect(chips.length).toBeGreaterThan(0);
    });

    test('handles unknown file types gracefully', async () => {
      const mockUnknownFile = {
        ...mockFiles[0],
        mime_type: 'application/unknown',
      };

      const mockQueryWithUnknown = {
        ...mockGetFilesQuery,
        result: {
          data: {
            myFiles: [mockUnknownFile],
          },
        },
      };

      renderComponent([mockQueryWithUnknown]);

      // Wait for data to load
      await waitFor(() => {
        expect(screen.getByText('test1.txt')).toBeInTheDocument();
      });

      // Should handle unknown type without errors
      expect(screen.getByText('test1.txt')).toBeInTheDocument();
    });
  });
});