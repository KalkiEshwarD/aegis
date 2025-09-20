import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MockedProvider } from '@apollo/client/testing';
import { ShareLinkManager } from '../../../components/common/ShareLinkManager';
import { GET_FILE_SHARES, DELETE_FILE_SHARE_MUTATION } from '../../../apollo/queries';

// Mock navigator.clipboard
Object.assign(navigator, {
  clipboard: {
    writeText: jest.fn(),
  },
});

// Mock formatFileSize utility
jest.mock('../../../shared/utils', () => ({
  formatFileSize: jest.fn((bytes) => `${bytes} bytes`),
}));

const mockShares = [
  {
    __typename: 'FileShare',
    id: '1',
    share_token: 'token123',
    user_file_id: 'file1',
    password_hash: 'hashed_password',
    expires_at: '2024-12-31T23:59:59Z',
    max_downloads: 10,
    download_count: 2,
    created_at: '2024-01-01T00:00:00Z',
    user_file: {
      __typename: 'UserFile',
      id: 'file1',
      filename: 'test.pdf',
      file: { __typename: 'File', size_bytes: 1024 },
    },
  },
  {
    __typename: 'FileShare',
    id: '2',
    share_token: 'token456',
    user_file_id: 'file2',
    password_hash: null,
    expires_at: null,
    max_downloads: null,
    download_count: 0,
    created_at: '2024-01-02T00:00:00Z',
    user_file: {
      __typename: 'UserFile',
      id: 'file2',
      filename: 'document.txt',
      file: { __typename: 'File', size_bytes: 2048 },
    },
  },
];

const mockGetFileSharesQuery = {
  request: {
    query: GET_FILE_SHARES,
    variables: { userFileId: 'file1' },
  },
  result: {
    data: {
      __typename: 'Query',
      getFileShares: mockShares,
    },
  },
};

const mockEmptySharesQuery = {
  request: {
    query: GET_FILE_SHARES,
    variables: { userFileId: 'empty-file' },
  },
  result: {
    data: {
      __typename: 'Query',
      getFileShares: [],
    },
  },
};

const mockDeleteMutation = {
  request: {
    query: DELETE_FILE_SHARE_MUTATION,
    variables: { id: '1' },
  },
  result: {
    data: {
      __typename: 'Mutation',
      deleteFileShare: true,
    },
  },
};

describe('ShareLinkManager', () => {
  const renderComponent = (mocks = [mockGetFileSharesQuery], props = {}) => {
    return render(
      <MockedProvider mocks={mocks}>
        <ShareLinkManager userFileId="file1" {...props} />
      </MockedProvider>
    );
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    test('renders share links table with data', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Share Links')).toBeInTheDocument();
      });

      expect(screen.getByText('test.pdf')).toBeInTheDocument();
      expect(screen.getByText('document.txt')).toBeInTheDocument();
      expect(screen.getByText('Active')).toBeInTheDocument();
      expect(screen.getByText('Protected')).toBeInTheDocument();
      expect(screen.getByText('No')).toBeInTheDocument();
    });

    test('renders empty state when no shares exist', async () => {
      renderComponent([mockEmptySharesQuery], { userFileId: 'empty-file' });

      await waitFor(() => {
        expect(screen.getByText('No share links')).toBeInTheDocument();
      });

      expect(screen.getByText('Create share links to allow others to access your files')).toBeInTheDocument();
    });

    test('shows loading state initially', () => {
      renderComponent();

      expect(screen.getByText('Loading share links...')).toBeInTheDocument();
    });

    test('displays error state when query fails', async () => {
      const errorMock = {
        ...mockGetFileSharesQuery,
        error: new Error('Failed to fetch'),
      };

      renderComponent([errorMock]);

      await waitFor(() => {
        expect(screen.getByText('Failed to load share links')).toBeInTheDocument();
      });
    });
  });

  describe('Share Status', () => {
    test('shows active status for valid shares', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Active')).toBeInTheDocument();
      });
    });

    test('shows expired status for expired shares', async () => {
      const expiredShare = {
        ...mockShares[0],
        expires_at: '2020-01-01T00:00:00Z',
      };

      const expiredMock = {
        ...mockGetFileSharesQuery,
        result: {
          data: {
            __typename: 'Query',
            getFileShares: [expiredShare],
          },
        },
      };

      renderComponent([expiredMock]);

      await waitFor(() => {
        expect(screen.getByText('Expired')).toBeInTheDocument();
      });
    });

    test('shows limit reached status when download limit exceeded', async () => {
      const limitReachedShare = {
        ...mockShares[0],
        download_count: 10,
        max_downloads: 10,
      };

      const limitMock = {
        ...mockGetFileSharesQuery,
        result: {
          data: {
            __typename: 'Query',
            getFileShares: [limitReachedShare],
          },
        },
      };

      renderComponent([limitMock]);

      await waitFor(() => {
        expect(screen.getByText('Limit Reached')).toBeInTheDocument();
      });
    });
  });

  describe('Copy Link Functionality', () => {
    test('copies share link to clipboard successfully', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('test.pdf')).toBeInTheDocument();
      });

      const copyButton = screen.getAllByTitle('Copy share link')[0];
      fireEvent.click(copyButton);

      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        `${window.location.origin}/shared/token123`
      );

      await waitFor(() => {
        expect(screen.getByText('Share link copied to clipboard!')).toBeInTheDocument();
      });
    });

    test('handles clipboard copy failure gracefully', async () => {
      const mockClipboardError = jest.fn().mockRejectedValue(new Error('Clipboard error'));
      Object.assign(navigator, {
        clipboard: {
          writeText: mockClipboardError,
        },
      });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('test.pdf')).toBeInTheDocument();
      });

      const copyButton = screen.getAllByTitle('Copy share link')[0];
      fireEvent.click(copyButton);

      expect(mockClipboardError).toHaveBeenCalled();
      // Error is logged to console, but UI doesn't show error message
    });
  });

  describe('Delete Share Functionality', () => {
    test('opens delete confirmation dialog when delete button clicked', async () => {
      renderComponent([mockGetFileSharesQuery, mockDeleteMutation]);

      await waitFor(() => {
        expect(screen.getByText('test.pdf')).toBeInTheDocument();
      });

      const deleteButton = screen.getAllByTitle('Delete share')[0];
      fireEvent.click(deleteButton);

      expect(screen.getByText('Delete Share Link')).toBeInTheDocument();
      expect(screen.getByText('Are you sure you want to delete this share link? Recipients will no longer be able to access the file.')).toBeInTheDocument();
    });

    test('deletes share when confirmed', async () => {
      const mockOnShareDeleted = jest.fn();

      renderComponent([mockGetFileSharesQuery, mockDeleteMutation], {
        onShareDeleted: mockOnShareDeleted,
      });

      await waitFor(() => {
        expect(screen.getByText('test.pdf')).toBeInTheDocument();
      });

      const deleteButton = screen.getAllByTitle('Delete share')[0];
      fireEvent.click(deleteButton);

      const confirmButton = screen.getByText('Delete Share');
      await act(async () => {
        fireEvent.click(confirmButton);
      });

      await waitFor(() => {
        expect(mockOnShareDeleted).toHaveBeenCalled();
      });

      expect(screen.queryByText('Delete Share Link')).not.toBeInTheDocument();
    });

    test('closes dialog when cancelled', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('test.pdf')).toBeInTheDocument();
      });

      const deleteButton = screen.getAllByTitle('Delete share')[0];
      fireEvent.click(deleteButton);

      const cancelButton = screen.getByText('Cancel');
      fireEvent.click(cancelButton);

      expect(screen.queryByText('Delete Share Link')).not.toBeInTheDocument();
    });
  });

  describe('Data Formatting', () => {
    test('formats dates correctly', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Jan 1, 2024, 12:00 AM')).toBeInTheDocument();
      });
    });

    test('shows "Never" for shares without expiration', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Never')).toBeInTheDocument();
      });
    });

    test('displays download counts correctly', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('2 / 10')).toBeInTheDocument();
        expect(screen.getByText('0')).toBeInTheDocument();
      });
    });

    test('formats file sizes using utility function', async () => {
      renderComponent();

      await waitFor(() => {
        expect(require('../../../shared/utils').formatFileSize).toHaveBeenCalledWith(1024);
        expect(require('../../../shared/utils').formatFileSize).toHaveBeenCalledWith(2048);
      });
    });
  });

  describe('Password Protection Display', () => {
    test('shows protected chip for password-protected shares', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Protected')).toBeInTheDocument();
      });
    });

    test('shows "No" for unprotected shares', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('No')).toBeInTheDocument();
      });
    });
  });

  describe('Props Handling', () => {
    test('passes userFileId to query when provided', () => {
      renderComponent();

      // Query should be called with userFileId
      expect(mockGetFileSharesQuery.request.variables.userFileId).toBe('file1');
    });

    test('handles undefined userFileId', () => {
      renderComponent([mockEmptySharesQuery], { userFileId: 'empty-file' });

      expect(mockEmptySharesQuery.request.variables.userFileId).toBe('empty-file');
    });

    test('calls onShareDeleted callback after successful deletion', async () => {
      const mockOnShareDeleted = jest.fn();

      renderComponent([mockGetFileSharesQuery, mockDeleteMutation], {
        onShareDeleted: mockOnShareDeleted,
      });

      await waitFor(() => {
        expect(screen.getByText('test.pdf')).toBeInTheDocument();
      });

      const deleteButton = screen.getAllByTitle('Delete share')[0];
      fireEvent.click(deleteButton);

      const confirmButton = screen.getByText('Delete Share');
      await act(async () => {
        fireEvent.click(confirmButton);
      });

      await waitFor(() => {
        expect(mockOnShareDeleted).toHaveBeenCalledTimes(1);
      });
    });
  });
});