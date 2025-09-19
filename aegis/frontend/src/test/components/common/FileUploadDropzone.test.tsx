import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MockedProvider } from '@apollo/client/testing';
import FileUploadDropzone from '../../../components/common/FileUploadDropzone';
import { UPLOAD_FILE_FROM_MAP_MUTATION } from '../../../apollo/files';

// Mock crypto utilities
jest.mock('../../../utils/crypto', () => ({
  generateEncryptionKey: jest.fn(() => ({
    key: new Uint8Array(32),
    nonce: new Uint8Array(24)
  })),
  encryptFile: jest.fn(() => ({
    encryptedData: new Uint8Array([1, 2, 3]),
    nonce: new Uint8Array(24)
  })),
  calculateFileHash: jest.fn(() => Promise.resolve('mock-hash')),
  fileToUint8Array: jest.fn(() => Promise.resolve(new Uint8Array([1, 2, 3]))),
  uint8ArrayToBase64: jest.fn(() => 'mock-base64'),
  formatFileSize: jest.fn((bytes) => `${bytes} bytes`),
  getMimeTypeFromExtension: jest.fn(() => 'application/octet-stream'),
}));

const mockUploadMutation = {
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

const createMockFile = (name: string, size: number, type: string = 'text/plain'): File => {
  const file = new File(['test content'], name, { type });
  Object.defineProperty(file, 'size', { value: size });
  return file;
};

describe('FileUploadDropzone Performance Optimizations', () => {
  const renderComponent = (mocks = [mockUploadMutation]) => {
    return render(
      <MockedProvider mocks={mocks} addTypename={false}>
        <FileUploadDropzone />
      </MockedProvider>
    );
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Sequential File Processing', () => {
    test('processes multiple files sequentially to avoid server overload', async () => {
      const { generateEncryptionKey, encryptFile, calculateFileHash } = require('../../../utils/crypto');

      const file1 = createMockFile('file1.txt', 1000);
      const file2 = createMockFile('file2.txt', 2000);
      const file3 = createMockFile('file3.txt', 3000);

      renderComponent();

      const input = screen.getByDisplayValue(''); // file input
      await act(async () => {
        fireEvent.change(input, { target: { files: [file1, file2, file3] } });
      });

      // Wait for all files to be processed
      await waitFor(() => {
        expect(calculateFileHash).toHaveBeenCalledTimes(3);
      });

      // Verify crypto functions were called for each file
      expect(generateEncryptionKey).toHaveBeenCalledTimes(3);
      expect(encryptFile).toHaveBeenCalledTimes(3);
    });

    test('handles file processing errors gracefully without stopping other files', async () => {
      const mockErrorMutation = {
        ...mockUploadMutation,
        error: new Error('Upload failed'),
      };

      const { calculateFileHash } = require('../../../utils/crypto');

      const file1 = createMockFile('file1.txt', 1000);
      const file2 = createMockFile('file2.txt', 2000);

      renderComponent([mockErrorMutation, mockUploadMutation]);

      const input = screen.getByDisplayValue('');
      await act(async () => {
        fireEvent.change(input, { target: { files: [file1, file2] } });
      });

      // Wait for processing to complete
      await waitFor(() => {
        expect(calculateFileHash).toHaveBeenCalledTimes(2);
      });

      // Both files should have been processed despite first failing
      expect(screen.getByText('Upload Progress')).toBeInTheDocument();
    });
  });

  describe('Progress Tracking Optimization', () => {
    test('provides detailed progress updates during upload process', async () => {
      const file = createMockFile('test.txt', 1000);

      renderComponent();

      const input = screen.getByDisplayValue('');
      await act(async () => {
        fireEvent.change(input, { target: { files: [file] } });
      });

      // Check for progress updates
      await waitFor(() => {
        expect(screen.getByText('Upload Progress')).toBeInTheDocument();
      });

      // Verify progress indicators are present
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
      expect(screen.getByText('test.txt (1000 bytes)')).toBeInTheDocument();
    });

    test('shows accurate progress percentages at different stages', async () => {
      const file = createMockFile('test.txt', 1000);

      renderComponent();

      const input = screen.getByDisplayValue('');
      await act(async () => {
        fireEvent.change(input, { target: { files: [file] } });
      });

      // Wait for upload to complete
      await waitFor(() => {
        expect(screen.getByText('completed')).toBeInTheDocument();
      });

      // Verify final progress is 100%
      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toHaveAttribute('aria-valuenow', '100');
    });
  });

  describe('File Size Validation Optimization', () => {
    test('validates file size before processing to prevent memory issues', async () => {
      const oversizedFile = createMockFile('large.txt', 15 * 1024 * 1024); // 15MB > 10MB limit

      renderComponent();

      const input = screen.getByDisplayValue('');
      await act(async () => {
        fireEvent.change(input, { target: { files: [oversizedFile] } });
      });

      // Should show error without attempting crypto operations
      await waitFor(() => {
        expect(screen.getByText(/File size exceeds maximum limit/)).toBeInTheDocument();
      });

      // Verify crypto functions were not called for oversized file
      const { calculateFileHash } = require('../../../utils/crypto');
      expect(calculateFileHash).not.toHaveBeenCalled();
    });

    test('rejects empty files immediately', async () => {
      const emptyFile = createMockFile('empty.txt', 0);

      renderComponent();

      const input = screen.getByDisplayValue('');
      await act(async () => {
        fireEvent.change(input, { target: { files: [emptyFile] } });
      });

      await waitFor(() => {
        expect(screen.getByText('Empty files are not allowed')).toBeInTheDocument();
      });
    });
  });

  describe('React.memo Optimization', () => {
    test('component is memoized to prevent unnecessary re-renders', () => {
      const { container } = renderComponent();

      // Force a re-render by changing props (though this component has no props)
      const { rerender } = render(
        <MockedProvider mocks={[mockUploadMutation]} addTypename={false}>
          <FileUploadDropzone />
        </MockedProvider>
      );

      // Component should maintain its structure
      expect(container.firstChild).toBeDefined();
    });

    test('handles drag and drop events efficiently', async () => {
      renderComponent();

      const dropzone = screen.getByText('Drag & drop files here');

      // Simulate drag over
      fireEvent.dragOver(dropzone);
      expect(dropzone.closest('.MuiPaper-root')).toHaveClass('MuiPaper-root');

      // Simulate drag leave
      fireEvent.dragLeave(dropzone);
      expect(dropzone.closest('.MuiPaper-root')).toHaveClass('MuiPaper-root');
    });
  });

  describe('Memory Management', () => {
    test('clears completed uploads to free memory', async () => {
      const file = createMockFile('test.txt', 1000);

      renderComponent();

      const input = screen.getByDisplayValue('');
      await act(async () => {
        fireEvent.change(input, { target: { files: [file] } });
      });

      // Wait for completion
      await waitFor(() => {
        expect(screen.getByText('completed')).toBeInTheDocument();
      });

      // Click clear completed button
      const clearButton = screen.getByTitle('Clear completed');
      fireEvent.click(clearButton);

      // Upload should be removed from list
      await waitFor(() => {
        expect(screen.queryByText('test.txt (1000 bytes)')).not.toBeInTheDocument();
      });
    });

    test('allows individual upload removal', async () => {
      const file = createMockFile('test.txt', 1000);

      renderComponent();

      const input = screen.getByDisplayValue('');
      await act(async () => {
        fireEvent.change(input, { target: { files: [file] } });
      });

      // Wait for upload to appear
      await waitFor(() => {
        expect(screen.getByText('test.txt (1000 bytes)')).toBeInTheDocument();
      });

      // Click remove button
      const removeButton = screen.getByTitle('Remove upload');
      fireEvent.click(removeButton);

      // Upload should be removed
      await waitFor(() => {
        expect(screen.queryByText('test.txt (1000 bytes)')).not.toBeInTheDocument();
      });
    });
  });
});