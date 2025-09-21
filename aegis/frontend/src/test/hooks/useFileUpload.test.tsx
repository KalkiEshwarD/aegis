import { renderHook, act } from '@testing-library/react-hooks';
import { waitFor } from '@testing-library/react';
import { MockedProvider } from '@apollo/client/testing';
import { useFileUpload } from '../../hooks/useFileUpload';
import { UPLOAD_FILE_FROM_MAP_MUTATION } from '../../apollo/queries';

// Mock File and FileReader
Object.defineProperty(global, 'File', {
  value: jest.fn().mockImplementation((parts, filename, options) => ({
    name: filename,
    size: parts ? parts.reduce((total: number, part: any) => total + (part.length || 0), 0) : 0,
    type: options?.type || '',
    arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(8)),
    text: jest.fn().mockResolvedValue('test content'),
  })),
  writable: true,
});

Object.defineProperty(global, 'FileReader', {
  value: jest.fn().mockImplementation(() => ({
    readAsArrayBuffer: jest.fn(function(this: any) {
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
  })),
  writable: true,
});

// Mock crypto utilities
jest.mock('../../utils/crypto', () => ({
  generateEncryptionKey: jest.fn(() => ({
    key: new Uint8Array([1, 2, 3, 4]),
    nonce: new Uint8Array([5, 6, 7, 8])
  })),
  encryptFile: jest.fn(() => ({
    encryptedData: new Uint8Array([9, 10, 11, 12]),
    nonce: new Uint8Array([5, 6, 7, 8])
  })),
  calculateFileHash: jest.fn().mockResolvedValue('mock-hash-123'),
  fileToUint8Array: jest.fn().mockResolvedValue(new Uint8Array([1, 2, 3, 4])),
  uint8ArrayToBase64: jest.fn().mockReturnValue('mock-base64-data'),
  getMimeTypeFromExtension: jest.fn().mockReturnValue('application/octet-stream'),
  formatFileSize: jest.fn().mockReturnValue('10 MB'),
}));

const renderHookWithProvider = (mocks: any[] = []) => {
  return renderHook(() => useFileUpload(), {
    wrapper: ({ children }) => (
      <MockedProvider mocks={mocks} addTypename={false}>
        {children}
      </MockedProvider>
    ),
  });
};

/*
describe('useFileUpload', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('initial state', () => {
    it('should initialize with empty uploads array', () => {
      const { result } = renderHookWithProvider();

      expect(result.current.uploads).toEqual([]);
    });
  });

  describe('file validation', () => {
    it('should reject files that are too large', async () => {
      const { result } = renderHookWithProvider();

      const largeFile = new File(['x'.repeat(11 * 1024 * 1024)], 'large.txt'); // 11MB

      await act(async () => {
        await result.current.handleFiles({ 0: largeFile, length: 1 } as any);
      });

      expect(result.current.uploads).toHaveLength(1);
      expect(result.current.uploads[0].status).toBe('error');
      expect(result.current.uploads[0].error).toContain('exceeds maximum limit');
    });

    it('should reject empty files', async () => {
      const { result } = renderHookWithProvider();

      const emptyFile = new File([], 'empty.txt');

      await act(async () => {
        await result.current.handleFiles({ 0: emptyFile, length: 1 } as any);
      });

      expect(result.current.uploads).toHaveLength(1);
      expect(result.current.uploads[0].status).toBe('error');
      expect(result.current.uploads[0].error).toBe('Empty files are not allowed');
    });

    it('should accept valid files', async () => {
      const mockMutation = {
        request: {
          query: UPLOAD_FILE_FROM_MAP_MUTATION,
          variables: {
            input: {
              data: expect.any(String),
            },
          },
        },
        result: {
          data: {
            uploadFileFromMap: {
              id: '1',
              filename: 'test.txt',
            },
          },
        },
      };

      const { result } = renderHookWithProvider([mockMutation]);

      const validFile = new File(['test content'], 'test.txt');

      await act(async () => {
        await result.current.handleFiles({ 0: validFile, length: 1 } as any);
      });

      expect(result.current.uploads).toHaveLength(1);
      expect(result.current.uploads[0].status).toBe('completed');
      expect(result.current.uploads[0].progress).toBe(100);
    });
  });

  describe('file upload process', () => {
    it('should process file upload with correct progress updates', async () => {
      const mockMutation = {
        request: {
          query: UPLOAD_FILE_FROM_MAP_MUTATION,
          variables: {
            input: {
              data: expect.any(String),
            },
          },
        },
        result: {
          data: {
            uploadFileFromMap: {
              id: '1',
              filename: 'test.txt',
            },
          },
        },
      };

      const { result } = renderHookWithProvider([mockMutation]);

      const file = new File(['test content'], 'test.txt');

      await act(async () => {
        await result.current.handleFiles({ 0: file, length: 1 } as any);
      });

      // Check that progress updates occurred
      expect(result.current.uploads[0].progress).toBe(100);
      expect(result.current.uploads[0].status).toBe('completed');
    });

    it('should handle upload errors gracefully', async () => {
      const mockMutation = {
        request: {
          query: UPLOAD_FILE_FROM_MAP_MUTATION,
          variables: {
            input: {
              data: expect.any(String),
            },
          },
        },
        error: new Error('Upload failed'),
      };

      const { result } = renderHookWithProvider([mockMutation]);

      const file = new File(['test content'], 'test.txt');

      await act(async () => {
        await result.current.handleFiles({ 0: file, length: 1 } as any);
      });

      expect(result.current.uploads[0].status).toBe('error');
      expect(result.current.uploads[0].error).toBe('Upload failed');
    });

    it('should handle GraphQL errors', async () => {
      const mockMutation = {
        request: {
          query: UPLOAD_FILE_FROM_MAP_MUTATION,
          variables: {
            input: {
              data: expect.any(String),
            },
          },
        },
        result: {
          errors: [{ message: 'GraphQL upload error' }],
        },
      };

      const { result } = renderHookWithProvider([mockMutation]);

      const file = new File(['test content'], 'test.txt');

      await act(async () => {
        await result.current.handleFiles({ 0: file, length: 1 } as any);
      });

      expect(result.current.uploads[0].status).toBe('error');
      expect(result.current.uploads[0].error).toBe('GraphQL upload error');
    });
  });

  describe('upload management', () => {
    it('should remove upload from list', async () => {
      const { result } = renderHookWithProvider();

      const file = new File(['test'], 'test.txt');

      await act(async () => {
        await result.current.handleFiles({ 0: file, length: 1 } as any);
      });

      expect(result.current.uploads).toHaveLength(1);

      act(() => {
        result.current.removeUpload(file);
      });

      expect(result.current.uploads).toHaveLength(0);
    });

    it('should clear completed uploads', async () => {
      const mockMutation = {
        request: {
          query: UPLOAD_FILE_FROM_MAP_MUTATION,
          variables: {
            input: {
              data: expect.any(String),
            },
          },
        },
        result: {
          data: {
            uploadFileFromMap: {
              id: '1',
              filename: 'test.txt',
            },
          },
        },
      };

      const { result } = renderHookWithProvider([mockMutation]);

      const file1 = new File(['test1'], 'test1.txt');
      const file2 = new File(['test2'], 'test2.txt');

      await act(async () => {
        await result.current.handleFiles({ 0: file1, 1: file2, length: 2 } as any);
      });

      expect(result.current.uploads).toHaveLength(2);
      expect(result.current.uploads.every(u => u.status === 'completed')).toBe(true);

      act(() => {
        result.current.clearCompleted();
      });

      expect(result.current.uploads).toHaveLength(0);
    });

    it('should not clear non-completed uploads when clearing completed', async () => {
      const { result } = renderHookWithProvider();

      const file1 = new File(['test1'], 'test1.txt');
      const file2 = new File(['x'.repeat(11 * 1024 * 1024)], 'large.txt'); // Will fail validation

      await act(async () => {
        await result.current.handleFiles({ 0: file1, 1: file2, length: 2 } as any);
      });

      expect(result.current.uploads).toHaveLength(2);
      expect(result.current.uploads[0].status).toBe('error'); // Large file failed
      expect(result.current.uploads[1].status).toBe('error'); // Empty file failed

      act(() => {
        result.current.clearCompleted();
      });

      // Should still have the error uploads
      expect(result.current.uploads).toHaveLength(2);
    });
  });

  describe('multiple file handling', () => {
    it('should handle multiple files sequentially', async () => {
      const mockMutation = {
        request: {
          query: UPLOAD_FILE_FROM_MAP_MUTATION,
          variables: {
            input: {
              data: expect.any(String),
            },
          },
        },
        result: {
          data: {
            uploadFileFromMap: {
              id: '1',
              filename: 'test.txt',
            },
          },
        },
      };

      const { result } = renderHookWithProvider([mockMutation, mockMutation]);

      const file1 = new File(['content1'], 'file1.txt');
      const file2 = new File(['content2'], 'file2.txt');

      await act(async () => {
        await result.current.handleFiles({ 0: file1, 1: file2, length: 2 } as any);
      });

      expect(result.current.uploads).toHaveLength(2);
      expect(result.current.uploads.every(u => u.status === 'completed')).toBe(true);
    });

    it('should handle null file list', async () => {
      const { result } = renderHookWithProvider();

      await act(async () => {
        await result.current.handleFiles([]);
      });

      expect(result.current.uploads).toHaveLength(0);
    });
  });

  describe('callback handling', () => {
    it('should call onUploadComplete callback when provided', async () => {
      const onUploadComplete = jest.fn();

      const mockMutation = {
        request: {
          query: UPLOAD_FILE_FROM_MAP_MUTATION,
          variables: {
            input: {
              data: expect.any(String),
            },
          },
        },
        result: {
          data: {
            uploadFileFromMap: {
              id: '1',
              filename: 'test.txt',
            },
          },
        },
      };

      const { result } = renderHookWithProvider([mockMutation]);

      // Re-render hook with callback
      const { rerender } = renderHook(() => useFileUpload(onUploadComplete), {
        wrapper: ({ children }) => (
          <MockedProvider mocks={[mockMutation]} addTypename={false}>
            {children}
          </MockedProvider>
        ),
      });

      const file = new File(['test'], 'test.txt');

      await act(async () => {
        await result.current.handleFiles({ 0: file, length: 1 } as any);
      });

      expect(onUploadComplete).toHaveBeenCalledTimes(1);
    });
  });

  describe('progress tracking', () => {
    it('should update progress through upload stages', async () => {
      const mockMutation = {
        request: {
          query: UPLOAD_FILE_FROM_MAP_MUTATION,
          variables: {
            input: {
              data: expect.any(String),
            },
          },
        },
        result: {
          data: {
            uploadFileFromMap: {
              id: '1',
              filename: 'test.txt',
            },
          },
        },
      };

      const { result } = renderHookWithProvider([mockMutation]);

      const file = new File(['test content'], 'test.txt');

      // Start upload
      act(() => {
        result.current.handleFiles({ 0: file, length: 1 } as any);
      });

      // Check initial state
      expect(result.current.uploads[0].status).toBe('pending');
      expect(result.current.uploads[0].progress).toBe(0);

      // Wait for completion
      await waitFor(() => {
        expect(result.current.uploads[0].status).toBe('completed');
        expect(result.current.uploads[0].progress).toBe(100);
      });
    });
  });
});
*/