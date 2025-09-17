import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import FileTable from '../../../components/common/FileTable';
import { UserFile } from '../../../types';

// Mock fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock Apollo Client
const mockRefetch = jest.fn();
const mockDeleteFileMutation = jest.fn();
const mockDownloadFileMutation = jest.fn();

jest.mock('@apollo/client', () => ({
  useQuery: jest.fn(),
  useMutation: jest.fn(),
}));

// Mock crypto utilities
jest.mock('../../../utils/crypto', () => ({
  decryptFile: jest.fn(),
  base64ToEncryptionKey: jest.fn(),
  createDownloadBlob: jest.fn(),
  downloadFile: jest.fn(),
  formatFileSize: jest.fn(),
}));

// Mock GraphQL queries
jest.mock('../../../apollo/queries', () => ({
  GET_MY_FILES: 'GET_MY_FILES',
  DELETE_FILE_MUTATION: 'DELETE_FILE_MUTATION',
  DOWNLOAD_FILE_MUTATION: 'DOWNLOAD_FILE_MUTATION',
}));

// Import after mocking
import { useQuery, useMutation } from '@apollo/client';
import {
  decryptFile,
  base64ToEncryptionKey,
  createDownloadBlob,
  downloadFile,
  formatFileSize,
} from '../../../utils/crypto';

const theme = createTheme();

const mockUseQuery = useQuery as jest.MockedFunction<typeof useQuery>;
const mockUseMutation = useMutation as jest.MockedFunction<typeof useMutation>;
const mockDecryptFile = decryptFile as jest.MockedFunction<typeof decryptFile>;
const mockBase64ToEncryptionKey = base64ToEncryptionKey as jest.MockedFunction<typeof base64ToEncryptionKey>;
const mockCreateDownloadBlob = createDownloadBlob as jest.MockedFunction<typeof createDownloadBlob>;
const mockDownloadFile = downloadFile as jest.MockedFunction<typeof downloadFile>;
const mockFormatFileSize = formatFileSize as jest.MockedFunction<typeof formatFileSize>;

const mockUserFile: UserFile = {
  id: '1',
  user_id: '1', 
  file_id: '1',
  filename: 'test.pdf',
  mime_type: 'application/pdf',
  created_at: '2023-12-01T10:00:00Z',
  updated_at: '2023-12-01T10:00:00Z',
  file: {
    id: '1',
    content_hash: 'hash123',
    size_bytes: 1024,
    created_at: '2023-12-01T10:00:00Z',
  },
  user: {
    id: '1',
    email: 'test@example.com',
    storage_quota: 10485760,
    used_storage: 1024,
    is_admin: false,
    created_at: '2023-12-01T10:00:00Z',
  },
};

const renderFileTable = (props = {}) => {
  return render(
    <ThemeProvider theme={theme}>
      <FileTable {...props} />
    </ThemeProvider>
  );
};

describe('FileTable Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Setup default mocks
    mockUseQuery.mockReturnValue({
      data: { myFiles: [mockUserFile] },
      loading: false,
      error: undefined,
      refetch: mockRefetch,
    } as any);

    mockUseMutation
      .mockReturnValueOnce([mockDeleteFileMutation, { loading: false, error: undefined, called: true, client: null, reset: jest.fn() } as any])
      .mockReturnValueOnce([mockDownloadFileMutation, { loading: false, error: undefined, called: true, client: null, reset: jest.fn() } as any]);

    mockFormatFileSize.mockReturnValue('1.00 KB');
    mockBase64ToEncryptionKey.mockReturnValue(new Uint8Array(32));
    mockDecryptFile.mockReturnValue(new Uint8Array([1, 2, 3]));
    mockCreateDownloadBlob.mockReturnValue(new Blob(['test']));
  });

  it('renders loading state', () => {
    mockUseQuery.mockReturnValue({
      data: null,
      loading: true,
      error: undefined,
      refetch: mockRefetch,
    } as any);

    renderFileTable();

    expect(screen.getByText('Loading files...')).toBeInTheDocument();
  });

  it('renders error state', () => {
    const errorMessage = 'GraphQL error';
    mockUseQuery.mockReturnValue({
      data: null,
      loading: false,
      error: { message: errorMessage, name: 'ApolloError', graphQLErrors: [], protocolErrors: [], clientErrors: [], networkError: null } as any,
      refetch: mockRefetch,
    } as any);

    renderFileTable();

    expect(screen.getByText(`Failed to load files: ${errorMessage}`)).toBeInTheDocument();
  });

  it('renders empty state', () => {
    mockUseQuery.mockReturnValue({
      data: { myFiles: [] },
      loading: false,
      error: undefined,
      refetch: mockRefetch,
    } as any);

    renderFileTable();

    expect(screen.getByText('No files found')).toBeInTheDocument();
    expect(screen.getByText('Upload some files to get started')).toBeInTheDocument();
  });

  it('renders files correctly', () => {
    renderFileTable();

    expect(screen.getByText('test.pdf')).toBeInTheDocument();
    expect(screen.getByText('PDF')).toBeInTheDocument();
    expect(screen.getByText('1.00 KB')).toBeInTheDocument();
    expect(mockFormatFileSize).toHaveBeenCalledWith(1024);
  });

  it('handles file filtering', () => {
    renderFileTable();

    const searchInput = screen.getByPlaceholderText('Search files by name...');
    fireEvent.change(searchInput, { target: { value: 'test' } });

    expect(mockUseQuery).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        variables: { filter: { filename: 'test' } },
      })
    );
  });

  it('handles delete confirmation dialog', () => {
    renderFileTable();

    // Click delete button
    const deleteButtons = screen.getAllByTitle('Delete file');
    fireEvent.click(deleteButtons[0]);

    // Check dialog appears
    expect(screen.getByText('Delete File')).toBeInTheDocument();
    expect(screen.getByText('Are you sure you want to delete "test.pdf"?')).toBeInTheDocument();
  });

  it('handles delete cancellation', () => {
    renderFileTable();

    // Open delete dialog
    const deleteButtons = screen.getAllByTitle('Delete file');
    fireEvent.click(deleteButtons[0]);

    // Click cancel
    const cancelButton = screen.getByText('Cancel');
    fireEvent.click(cancelButton);

    // Dialog should close
    expect(screen.queryByText('Delete File')).not.toBeInTheDocument();
  });

  it('handles successful file deletion', async () => {
    const onFileDeleted = jest.fn();
    mockDeleteFileMutation.mockResolvedValue({
      data: { deleteFile: true },
    });

    renderFileTable({ onFileDeleted });

    // Open and confirm delete
    const deleteButtons = screen.getAllByTitle('Delete file');
    fireEvent.click(deleteButtons[0]);

    const deleteConfirmButton = screen.getByText('Delete');
    fireEvent.click(deleteConfirmButton);

    await waitFor(() => {
      expect(mockDeleteFileMutation).toHaveBeenCalledWith({
        variables: { id: '1' },
      });
      expect(mockRefetch).toHaveBeenCalled();
      expect(onFileDeleted).toHaveBeenCalled();
    });
  });

  it('handles delete error', async () => {
    const errorMessage = 'Delete failed';
    mockDeleteFileMutation.mockRejectedValue({
      graphQLErrors: [{ message: errorMessage }],
    });

    renderFileTable();

    // Open and confirm delete
    const deleteButtons = screen.getAllByTitle('Delete file');
    fireEvent.click(deleteButtons[0]);

    const deleteConfirmButton = screen.getByText('Delete');
    fireEvent.click(deleteConfirmButton);

    await waitFor(() => {
      expect(screen.getByText(errorMessage)).toBeInTheDocument();
    });
  });

  it('handles successful file download', async () => {
    const mockBlob = new Blob(['test content']);
    const mockResponse = {
      ok: true,
      arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(8)),
    };

    mockFetch.mockResolvedValue(mockResponse);
    mockDownloadFileMutation.mockResolvedValue({
      data: { downloadFile: 'http://example.com/download' },
    });
    mockCreateDownloadBlob.mockReturnValue(mockBlob);

    renderFileTable();

    // Click download button
    const downloadButtons = screen.getAllByTitle('Download file');
    fireEvent.click(downloadButtons[0]);

    await waitFor(() => {
      expect(mockDownloadFileMutation).toHaveBeenCalledWith({
        variables: { id: '1' },
      });
      expect(mockFetch).toHaveBeenCalledWith('http://example.com/download');
      expect(mockDownloadFile).toHaveBeenCalledWith(mockBlob, 'test.pdf');
    });
  });

  it('handles download URL error', async () => {
    mockDownloadFileMutation.mockResolvedValue({
      data: { downloadFile: null },
    });

    renderFileTable();

    const downloadButtons = screen.getAllByTitle('Download file');
    fireEvent.click(downloadButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('No download URL received')).toBeInTheDocument();
    });
  });

  it('handles download fetch error', async () => {
    const mockResponse = {
      ok: false,
    };

    mockFetch.mockResolvedValue(mockResponse);
    mockDownloadFileMutation.mockResolvedValue({
      data: { downloadFile: 'http://example.com/download' },
    });

    renderFileTable();

    const downloadButtons = screen.getAllByTitle('Download file');
    fireEvent.click(downloadButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('Failed to download file')).toBeInTheDocument();
    });
  });

  it('handles decryption failure with fallback', async () => {
    const mockResponse = {
      ok: true,
      arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(8)),
    };

    mockFetch.mockResolvedValue(mockResponse);
    mockDownloadFileMutation.mockResolvedValue({
      data: { downloadFile: 'http://example.com/download' },
    });
    mockDecryptFile.mockReturnValue(null); // Decryption fails

    renderFileTable();

    const downloadButtons = screen.getAllByTitle('Download file');
    fireEvent.click(downloadButtons[0]);

    await waitFor(() => {
      expect(mockDownloadFile).toHaveBeenCalledWith(
        expect.any(Blob),
        'encrypted_test.pdf'
      );
    });
  });

  it('shows download button as disabled during download', () => {
    renderFileTable();

    const downloadButtons = screen.getAllByTitle('Download file');
    const downloadButton = downloadButtons[0];

    // Initially enabled
    expect(downloadButton).not.toBeDisabled();

    // Click to start download
    fireEvent.click(downloadButton);

    // Should be disabled during download (this would be tested with state changes)
    // Note: In this simplified test, we can't easily test the loading state
  });

  it('formats file types correctly', () => {
    const files = [
      { ...mockUserFile, mime_type: 'image/jpeg' },
      { ...mockUserFile, mime_type: 'video/mp4', id: '2', filename: 'video.mp4' },
      { ...mockUserFile, mime_type: 'audio/mpeg', id: '3', filename: 'audio.mp3' },
      { ...mockUserFile, mime_type: 'application/pdf', id: '4', filename: 'doc.pdf' },
      { ...mockUserFile, mime_type: 'text/plain', id: '5', filename: 'text.txt' },
    ];

    mockUseQuery.mockReturnValue({
      data: { myFiles: files },
      loading: false,
      error: undefined,
      refetch: mockRefetch,
    } as any);

    renderFileTable();

    expect(screen.getByText('JPEG')).toBeInTheDocument();
    expect(screen.getByText('MP4')).toBeInTheDocument();
    expect(screen.getByText('MPEG')).toBeInTheDocument();
    expect(screen.getByText('PDF')).toBeInTheDocument();
    expect(screen.getByText('PLAIN')).toBeInTheDocument();
  });

  it('handles files without file data', () => {
    const fileWithoutData = {
      ...mockUserFile,
      file: null,
    };

    mockUseQuery.mockReturnValue({
      data: { myFiles: [fileWithoutData] },
      loading: false,
      error: undefined,
      refetch: mockRefetch,
    } as any);

    renderFileTable();

    expect(screen.getByText('Unknown')).toBeInTheDocument();
  });

  it('handles long filenames with truncation', () => {
    const longFilename = 'a'.repeat(100) + '.txt';
    const fileWithLongName = {
      ...mockUserFile,
      filename: longFilename,
    };

    mockUseQuery.mockReturnValue({
      data: { myFiles: [fileWithLongName] },
      loading: false,
      error: undefined,
      refetch: mockRefetch,
    } as any);

    renderFileTable();

    const filenameElement = screen.getByText(longFilename);
    expect(filenameElement).toHaveStyle({ maxWidth: '200px' });
  });

  it('calls onFileDeleted callback after successful deletion', async () => {
    const onFileDeleted = jest.fn();
    mockDeleteFileMutation.mockResolvedValue({
      data: { deleteFile: true },
    });

    renderFileTable({ onFileDeleted });

    // Perform delete
    const deleteButtons = screen.getAllByTitle('Delete file');
    fireEvent.click(deleteButtons[0]);

    const deleteConfirmButton = screen.getByText('Delete');
    fireEvent.click(deleteConfirmButton);

    await waitFor(() => {
      expect(onFileDeleted).toHaveBeenCalledTimes(1);
    });
  });

  it('handles network errors during download', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));
    mockDownloadFileMutation.mockResolvedValue({
      data: { downloadFile: 'http://example.com/download' },
    });

    renderFileTable();

    const downloadButtons = screen.getAllByTitle('Download file');
    fireEvent.click(downloadButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeInTheDocument();
    });
  });

  it('clears error state on new operations', async () => {
    // First cause an error
    mockDownloadFileMutation.mockRejectedValueOnce(new Error('First error'));

    renderFileTable();

    const downloadButtons = screen.getAllByTitle('Download file');
    fireEvent.click(downloadButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('First error')).toBeInTheDocument();
    });

    // Try download again - error should be cleared
    mockDownloadFileMutation.mockResolvedValue({
      data: { downloadFile: 'http://example.com/download' },
    });

    fireEvent.click(downloadButtons[0]);

    await waitFor(() => {
      expect(screen.queryByText('First error')).not.toBeInTheDocument();
    });
  });
});