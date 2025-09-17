import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import FileUploadDropzone from '../../../components/common/FileUploadDropzone';

// Mock Apollo Client
const mockUploadFileMutation = jest.fn();

jest.mock('@apollo/client', () => ({
  useMutation: jest.fn(),
}));

// Mock crypto utilities
jest.mock('../../../utils/crypto', () => ({
  generateEncryptionKey: jest.fn(),
  encryptFile: jest.fn(),
  calculateFileHash: jest.fn(),
  fileToUint8Array: jest.fn(),
  formatFileSize: jest.fn(),
  getMimeTypeFromExtension: jest.fn(),
}));

// Import after mocking
import { useMutation } from '@apollo/client';
import {
  generateEncryptionKey,
  encryptFile,
  calculateFileHash,
  fileToUint8Array,
  formatFileSize,
  getMimeTypeFromExtension,
} from '../../../utils/crypto';

const theme = createTheme();

const mockUseMutation = useMutation as jest.MockedFunction<typeof useMutation>;
const mockGenerateEncryptionKey = generateEncryptionKey as jest.MockedFunction<typeof generateEncryptionKey>;
const mockEncryptFile = encryptFile as jest.MockedFunction<typeof encryptFile>;
const mockCalculateFileHash = calculateFileHash as jest.MockedFunction<typeof calculateFileHash>;
const mockFileToUint8Array = fileToUint8Array as jest.MockedFunction<typeof fileToUint8Array>;
const mockFormatFileSize = formatFileSize as jest.MockedFunction<typeof formatFileSize>;
const mockGetMimeTypeFromExtension = getMimeTypeFromExtension as jest.MockedFunction<typeof getMimeTypeFromExtension>;

const renderFileUploadDropzone = (props = {}) => {
  return render(
    <ThemeProvider theme={theme}>
      <FileUploadDropzone {...props} />
    </ThemeProvider>
  );
};

// Mock File constructor
const mockFile = (name: string, size: number, type: string = 'text/plain') => {
  return new File(['test content'], name, { type });
};

describe('FileUploadDropzone Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Setup default mocks
    mockUseMutation.mockReturnValue([mockUploadFileMutation, { loading: false, error: undefined, called: true, client: null, reset: jest.fn() } as any]);

    mockFormatFileSize.mockReturnValue('10.00 MB');
    mockCalculateFileHash.mockResolvedValue('test_hash_123');
    mockGenerateEncryptionKey.mockReturnValue({
      key: new Uint8Array(32),
      nonce: new Uint8Array(24),
    });
    mockFileToUint8Array.mockResolvedValue(new Uint8Array([1, 2, 3]));
    mockEncryptFile.mockReturnValue({
      encryptedData: new Uint8Array([4, 5, 6]),
      nonce: new Uint8Array(24),
    });
    mockGetMimeTypeFromExtension.mockReturnValue('application/octet-stream');
  });

  it('renders dropzone with correct initial state', () => {
    renderFileUploadDropzone();

    expect(screen.getByText('Drag & drop files here')).toBeInTheDocument();
    expect(screen.getByText('or click to browse files')).toBeInTheDocument();
    expect(screen.getByText('Maximum file size: 10.00 MB')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toBeInTheDocument(); // CloudUploadIcon
  });

  it('handles drag over events', () => {
    renderFileUploadDropzone();

    const dropzone = screen.getByText('Drag & drop files here').closest('div');

    fireEvent.dragOver(dropzone!);

    // The drag over state change is internal, but we can test that the event is handled
    expect(dropzone).toBeInTheDocument();
  });

  it('handles drag leave events', () => {
    renderFileUploadDropzone();

    const dropzone = screen.getByText('Drag & drop files here').closest('div');

    fireEvent.dragLeave(dropzone!);

    expect(dropzone).toBeInTheDocument();
  });

  it('handles file drop', async () => {
    const file = mockFile('test.txt', 1024);
    mockUploadFileMutation.mockResolvedValue({
      data: { uploadFileFromMap: { id: '1' } },
    });

    renderFileUploadDropzone();

    const dropzone = screen.getByText('Drag & drop files here').closest('div');

    const dropEvent = {
      preventDefault: jest.fn(),
      dataTransfer: {
        files: [file],
      },
    };

    fireEvent.drop(dropzone!, dropEvent);

    await waitFor(() => {
      expect(mockUploadFileMutation).toHaveBeenCalled();
    });
  });

  it('handles click to open file dialog', () => {
    renderFileUploadDropzone();

    const dropzone = screen.getByText('Drag & drop files here').closest('div');

    // Mock file input click
    const fileInput = screen.getByDisplayValue(''); // Hidden input
    const clickSpy = jest.spyOn(fileInput, 'click');

    fireEvent.click(dropzone!);

    expect(clickSpy).toHaveBeenCalled();
  });

  it('validates file size limits', async () => {
    const largeFile = mockFile('large.txt', 15 * 1024 * 1024); // 15MB

    renderFileUploadDropzone({ maxFileSize: 10 * 1024 * 1024 }); // 10MB limit

    const dropzone = screen.getByText('Drag & drop files here').closest('div');

    const dropEvent = {
      preventDefault: jest.fn(),
      dataTransfer: {
        files: [largeFile],
      },
    };

    fireEvent.drop(dropzone!, dropEvent);

    await waitFor(() => {
      expect(screen.getByText(/File size exceeds maximum limit/)).toBeInTheDocument();
    });
  });

  it('validates empty files', async () => {
    const emptyFile = mockFile('empty.txt', 0);

    renderFileUploadDropzone();

    const dropzone = screen.getByText('Drag & drop files here').closest('div');

    const dropEvent = {
      preventDefault: jest.fn(),
      dataTransfer: {
        files: [emptyFile],
      },
    };

    fireEvent.drop(dropzone!, dropEvent);

    await waitFor(() => {
      expect(screen.getByText('Empty files are not allowed')).toBeInTheDocument();
    });
  });

  it('processes valid files successfully', async () => {
    const file = mockFile('test.txt', 1024);
    mockUploadFileMutation.mockResolvedValue({
      data: { uploadFileFromMap: { id: '1' } },
    });

    renderFileUploadDropzone();

    const dropzone = screen.getByText('Drag & drop files here').closest('div');

    const dropEvent = {
      preventDefault: jest.fn(),
      dataTransfer: {
        files: [file],
      },
    };

    fireEvent.drop(dropzone!, dropEvent);

    await waitFor(() => {
      expect(mockCalculateFileHash).toHaveBeenCalledWith(file);
      expect(mockGenerateEncryptionKey).toHaveBeenCalled();
      expect(mockFileToUint8Array).toHaveBeenCalledWith(file);
      expect(mockEncryptFile).toHaveBeenCalled();
      expect(mockUploadFileMutation).toHaveBeenCalled();
    });
  });

  it('handles upload errors', async () => {
    const file = mockFile('test.txt', 1024);
    const errorMessage = 'Upload failed';
    mockUploadFileMutation.mockRejectedValue({
      graphQLErrors: [{ message: errorMessage }],
    });

    renderFileUploadDropzone();

    const dropzone = screen.getByText('Drag & drop files here').closest('div');

    const dropEvent = {
      preventDefault: jest.fn(),
      dataTransfer: {
        files: [file],
      },
    };

    fireEvent.drop(dropzone!, dropEvent);

    await waitFor(() => {
      expect(screen.getByText(errorMessage)).toBeInTheDocument();
    });
  });

  it('shows upload progress', async () => {
    const file = mockFile('test.txt', 1024);
    mockUploadFileMutation.mockResolvedValue({
      data: { uploadFileFromMap: { id: '1' } },
    });

    renderFileUploadDropzone();

    const dropzone = screen.getByText('Drag & drop files here').closest('div');

    const dropEvent = {
      preventDefault: jest.fn(),
      dataTransfer: {
        files: [file],
      },
    };

    fireEvent.drop(dropzone!, dropEvent);

    // Check that progress indicators appear
    await waitFor(() => {
      expect(screen.getByText('Upload Progress')).toBeInTheDocument();
      expect(screen.getByText('test.txt (10.00 MB)')).toBeInTheDocument();
    });
  });

  it('handles multiple file uploads', async () => {
    const file1 = mockFile('test1.txt', 1024);
    const file2 = mockFile('test2.txt', 2048);
    mockUploadFileMutation.mockResolvedValue({
      data: { uploadFileFromMap: { id: '1' } },
    });

    renderFileUploadDropzone();

    const dropzone = screen.getByText('Drag & drop files here').closest('div');

    const dropEvent = {
      preventDefault: jest.fn(),
      dataTransfer: {
        files: [file1, file2],
      },
    };

    fireEvent.drop(dropzone!, dropEvent);

    await waitFor(() => {
      expect(mockUploadFileMutation).toHaveBeenCalledTimes(2);
    });
  });

  it('removes individual uploads', async () => {
    const file = mockFile('test.txt', 1024);
    mockUploadFileMutation.mockResolvedValue({
      data: { uploadFileFromMap: { id: '1' } },
    });

    renderFileUploadDropzone();

    const dropzone = screen.getByText('Drag & drop files here').closest('div');

    const dropEvent = {
      preventDefault: jest.fn(),
      dataTransfer: {
        files: [file],
      },
    };

    fireEvent.drop(dropzone!, dropEvent);

    await waitFor(() => {
      expect(screen.getByText('test.txt (10.00 MB)')).toBeInTheDocument();
    });

    // Find and click the remove button
    const removeButtons = screen.getAllByTitle(''); // Close buttons
    fireEvent.click(removeButtons[0]);

    await waitFor(() => {
      expect(screen.queryByText('test.txt (10.00 MB)')).not.toBeInTheDocument();
    });
  });

  it('clears completed uploads', async () => {
    const file = mockFile('test.txt', 1024);
    mockUploadFileMutation.mockResolvedValue({
      data: { uploadFileFromMap: { id: '1' } },
    });

    renderFileUploadDropzone();

    const dropzone = screen.getByText('Drag & drop files here').closest('div');

    const dropEvent = {
      preventDefault: jest.fn(),
      dataTransfer: {
        files: [file],
      },
    };

    fireEvent.drop(dropzone!, dropEvent);

    await waitFor(() => {
      expect(screen.getByText('completed')).toBeInTheDocument();
    });

    // Click clear completed button
    const clearButton = screen.getByTitle('Clear completed');
    fireEvent.click(clearButton);

    await waitFor(() => {
      expect(screen.queryByText('test.txt (10.00 MB)')).not.toBeInTheDocument();
    });
  });

  it('calls onUploadComplete callback', async () => {
    const onUploadComplete = jest.fn();
    const file = mockFile('test.txt', 1024);
    mockUploadFileMutation.mockResolvedValue({
      data: { uploadFileFromMap: { id: '1' } },
    });

    renderFileUploadDropzone({ onUploadComplete });

    const dropzone = screen.getByText('Drag & drop files here').closest('div');

    const dropEvent = {
      preventDefault: jest.fn(),
      dataTransfer: {
        files: [file],
      },
    };

    fireEvent.drop(dropzone!, dropEvent);

    await waitFor(() => {
      expect(onUploadComplete).toHaveBeenCalled();
    });
  });

  it('handles file input change', async () => {
    const file = mockFile('test.txt', 1024);
    mockUploadFileMutation.mockResolvedValue({
      data: { uploadFileFromMap: { id: '1' } },
    });

    renderFileUploadDropzone();

    const fileInput = screen.getByDisplayValue(''); // Hidden input

    // Simulate file selection
    Object.defineProperty(fileInput, 'files', {
      value: [file],
    });

    fireEvent.change(fileInput);

    await waitFor(() => {
      expect(mockUploadFileMutation).toHaveBeenCalled();
    });
  });

  it('resets file input after selection', async () => {
    const file = mockFile('test.txt', 1024);
    mockUploadFileMutation.mockResolvedValue({
      data: { uploadFileFromMap: { id: '1' } },
    });

    renderFileUploadDropzone();

    const fileInput = screen.getByDisplayValue(''); // Hidden input

    // Mock the value property
    const valueSetter = jest.fn();
    Object.defineProperty(fileInput, 'value', {
      get: () => '',
      set: valueSetter,
    });

    Object.defineProperty(fileInput, 'files', {
      value: [file],
    });

    fireEvent.change(fileInput);

    await waitFor(() => {
      expect(valueSetter).toHaveBeenCalledWith('');
    });
  });

  it('handles files with no MIME type', async () => {
    const file = mockFile('test.unknown', 1024, '');
    mockUploadFileMutation.mockResolvedValue({
      data: { uploadFileFromMap: { id: '1' } },
    });

    renderFileUploadDropzone();

    const dropzone = screen.getByText('Drag & drop files here').closest('div');

    const dropEvent = {
      preventDefault: jest.fn(),
      dataTransfer: {
        files: [file],
      },
    };

    fireEvent.drop(dropzone!, dropEvent);

    await waitFor(() => {
      expect(mockGetMimeTypeFromExtension).toHaveBeenCalledWith('test.unknown');
    });
  });

  it('handles crypto operation failures', async () => {
    const file = mockFile('test.txt', 1024);
    mockCalculateFileHash.mockRejectedValue(new Error('Hash calculation failed'));

    renderFileUploadDropzone();

    const dropzone = screen.getByText('Drag & drop files here').closest('div');

    const dropEvent = {
      preventDefault: jest.fn(),
      dataTransfer: {
        files: [file],
      },
    };

    fireEvent.drop(dropzone!, dropEvent);

    await waitFor(() => {
      expect(screen.getByText('Hash calculation failed')).toBeInTheDocument();
    });
  });

  it('handles large file uploads with progress updates', async () => {
    const file = mockFile('large.txt', 1024 * 1024); // 1MB
    mockUploadFileMutation.mockResolvedValue({
      data: { uploadFileFromMap: { id: '1' } },
    });

    renderFileUploadDropzone();

    const dropzone = screen.getByText('Drag & drop files here').closest('div');

    const dropEvent = {
      preventDefault: jest.fn(),
      dataTransfer: {
        files: [file],
      },
    };

    fireEvent.drop(dropzone!, dropEvent);

    // Check that progress updates occur
    await waitFor(() => {
      expect(screen.getByText('uploading')).toBeInTheDocument();
    });
  });

  it('displays different status chips correctly', async () => {
    const file = mockFile('test.txt', 1024);
    mockUploadFileMutation.mockResolvedValue({
      data: { uploadFileFromMap: { id: '1' } },
    });

    renderFileUploadDropzone();

    const dropzone = screen.getByText('Drag & drop files here').closest('div');

    const dropEvent = {
      preventDefault: jest.fn(),
      dataTransfer: {
        files: [file],
      },
    };

    fireEvent.drop(dropzone!, dropEvent);

    await waitFor(() => {
      expect(screen.getByText('completed')).toBeInTheDocument();
    });
  });

  it('handles null file list', () => {
    renderFileUploadDropzone();

    const dropzone = screen.getByText('Drag & drop files here').closest('div');

    const dropEvent = {
      preventDefault: jest.fn(),
      dataTransfer: {
        files: null,
      },
    };

    // Should not throw error
    expect(() => fireEvent.drop(dropzone!, dropEvent)).not.toThrow();
  });

  it('respects custom maxFileSize prop', () => {
    const customMaxSize = 5 * 1024 * 1024; // 5MB
    mockFormatFileSize.mockReturnValue('5.00 MB');

    renderFileUploadDropzone({ maxFileSize: customMaxSize });

    expect(screen.getByText('Maximum file size: 5.00 MB')).toBeInTheDocument();
    expect(mockFormatFileSize).toHaveBeenCalledWith(customMaxSize);
  });
});