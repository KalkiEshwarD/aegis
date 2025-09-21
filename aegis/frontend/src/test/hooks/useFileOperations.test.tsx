import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { useFileOperations } from '../../hooks/useFileOperations';
import { UserFile } from '../../types';

// Apollo Client is already mocked in setupTests.ts

// Mock the crypto utilities
jest.mock('../../utils/crypto', () => ({
  decryptFile: jest.fn(),
  base64ToEncryptionKey: jest.fn(),
  createDownloadBlob: jest.fn(),
  downloadFile: jest.fn(),
  extractNonceAndData: jest.fn(),
}));

// Mock the auth context
jest.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    token: 'mock-token',
  }),
}));

import { useMutation } from '@apollo/client';
import {
  decryptFile,
  base64ToEncryptionKey,
  createDownloadBlob,
  downloadFile,
  extractNonceAndData,
} from '../../utils/crypto';

const mockUseMutation = useMutation as jest.MockedFunction<typeof useMutation>;
const mockDecryptFile = decryptFile as jest.MockedFunction<typeof decryptFile>;
const mockBase64ToEncryptionKey = base64ToEncryptionKey as jest.MockedFunction<typeof base64ToEncryptionKey>;
const mockCreateDownloadBlob = createDownloadBlob as jest.MockedFunction<typeof createDownloadBlob>;
const mockDownloadFile = downloadFile as jest.MockedFunction<typeof downloadFile>;
const mockExtractNonceAndData = extractNonceAndData as jest.MockedFunction<typeof extractNonceAndData>;

// Test component that uses the hook
const TestComponent = ({ mockFile }: { mockFile?: UserFile }) => {
  const { downloadingFile, error, downloadFile, deleteFile, clearError } = useFileOperations();

  const fileToUse = mockFile || {
    id: '1',
    filename: 'test.txt',
    mime_type: 'text/plain',
    encryption_key: 'mock-key',
    created_at: '2023-01-01T00:00:00Z',
    file: {
      id: 'file-1',
      content_hash: 'mock-hash',
      size_bytes: 100,
      created_at: '2023-01-01T00:00:00Z',
    },
  };

  return (
    <div>
      <div data-testid="downloading">{downloadingFile || 'none'}</div>
      <div data-testid="error">{error || 'no-error'}</div>
      <button onClick={() => downloadFile(fileToUse as UserFile)}>Download</button>
      <button onClick={() => deleteFile(fileToUse as UserFile)}>Delete</button>
      <button onClick={() => clearError()}>Clear Error</button>
    </div>
  );
};

/*
describe('useFileOperations', () => {
  const mockFile: UserFile = {
    id: '1',
    user_id: 'user-1',
    file_id: 'file-1',
    filename: 'test.txt',
    mime_type: 'text/plain',
    encryption_key: 'mock-key',
    created_at: '2023-01-01T00:00:00Z',
    updated_at: '2023-01-01T00:00:00Z',
    is_starred: false,
    file: {
      id: 'file-1',
      content_hash: 'mock-hash',
      size_bytes: 100,
      created_at: '2023-01-01T00:00:00Z',
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup mock implementations
    mockUseMutation.mockReturnValue([
      jest.fn().mockResolvedValue({
        data: { downloadFile: 'mock-url' },
      }),
      {
        loading: false,
        error: undefined,
        called: true,
        client: {} as any,
        reset: jest.fn(),
      },
    ]);

    mockBase64ToEncryptionKey.mockReturnValue(new Uint8Array([1, 2, 3]));
    mockDecryptFile.mockReturnValue(new Uint8Array([4, 5, 6]));
    mockCreateDownloadBlob.mockReturnValue(new Blob(['test']));
    mockExtractNonceAndData.mockReturnValue({
      nonce: new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24]),
      encryptedData: new Uint8Array([7, 8, 9])
    });
  });

  it('should initialize with default state', () => {
    render(<TestComponent />);

    expect(screen.getByTestId('downloading')).toHaveTextContent('none');
    expect(screen.getByTestId('error')).toHaveTextContent('no-error');
  });

  it('should handle successful file download', async () => {
    // Mock fetch
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(8)),
    });

    render(<TestComponent mockFile={mockFile} />);

    fireEvent.click(screen.getByText('Download'));

    // Wait for async operations
    await waitFor(() => {
      expect(mockBase64ToEncryptionKey).toHaveBeenCalled();
      expect(mockDecryptFile).toHaveBeenCalled();
      expect(mockCreateDownloadBlob).toHaveBeenCalled();
      expect(mockDownloadFile).toHaveBeenCalled();
    });
  });

  it('should clear error when clearError is called', () => {
    render(<TestComponent />);

    fireEvent.click(screen.getByText('Clear Error'));

    expect(screen.getByTestId('error')).toHaveTextContent('no-error');
  });

  it('should handle delete file operation', async () => {
    const mockDeleteMutation = jest.fn().mockResolvedValue({
      data: { deleteFile: true },
    });

    mockUseMutation.mockReturnValue([
      mockDeleteMutation,
      {
        loading: false,
        error: undefined,
        called: true,
        client: {} as any,
        reset: jest.fn(),
      },
    ]);

    render(<TestComponent mockFile={mockFile} />);

    fireEvent.click(screen.getByText('Delete'));

    await waitFor(() => {
      expect(mockDeleteMutation).toHaveBeenCalled();
    });
  });
});
*/