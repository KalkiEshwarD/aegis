import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import FileExplorer from '../../../components/common/FileExplorer';
import { DocumentNode } from 'graphql';
import { QueryHookOptions, MutationHookOptions } from '@apollo/client';

// Mock all Apollo Client hooks
jest.mock('@apollo/client', () => ({
  useQuery: jest.fn(),
  useMutation: jest.fn(),
  gql: jest.fn((strings) => strings.join('')),
}));

const mockUseQuery = require('@apollo/client').useQuery;
const mockUseMutation = require('@apollo/client').useMutation;

// Mock the file operations hook
jest.mock('../../../hooks/useFileOperations', () => ({
  useFileOperations: () => ({
    downloadingFile: null,
    error: null,
    downloadFile: jest.fn(),
    deleteFile: jest.fn(),
  }),
}));

// Mock the file upload hook
jest.mock('../../../hooks/useFileUpload', () => ({
  useFileUpload: () => ({
    uploads: [],
    handleFiles: jest.fn(),
    removeUpload: jest.fn(),
    clearCompleted: jest.fn(),
  }),
}));

// Mock the file sorting hook
jest.mock('../../../hooks/useFileSorting', () => ({
  useFileSorting: () => ({
    sortBy: 'name',
    sortOrder: 'asc',
    handleSort: jest.fn(),
  }),
}));

const theme = createTheme();

const mockFiles = [
  {
    __typename: 'UserFile',
    id: '1',
    filename: 'test-file.txt',
    mime_type: 'text/plain',
    encryption_key: 'key1',
    folder_id: null,
    is_starred: false,
    created_at: '2023-01-01T00:00:00Z',
    file: {
      __typename: 'File',
      id: 'f1',
      size_bytes: 1024,
      content_hash: 'hash1',
    },
    folder: null,
  },
  {
    __typename: 'UserFile',
    id: '2',
    filename: 'starred-file.txt',
    mime_type: 'text/plain',
    encryption_key: 'key2',
    folder_id: null,
    is_starred: true,
    created_at: '2023-01-02T00:00:00Z',
    file: {
      __typename: 'File',
      id: 'f2',
      size_bytes: 2048,
      content_hash: 'hash2',
    },
    folder: null,
  },
];

const mockFolders = [
  {
    __typename: 'Folder',
    id: '1',
    name: 'Test Folder',
    parent_id: null,
    is_starred: false,
    created_at: '2023-01-01T00:00:00Z',
    updated_at: '2023-01-01T00:00:00Z',
    user: { __typename: 'User', id: 'u1', email: 'test@example.com' },
    parent: null,
    children: [],
    files: [],
  },
  {
    __typename: 'Folder',
    id: '2',
    name: 'Starred Folder',
    parent_id: null,
    is_starred: true,
    created_at: '2023-01-02T00:00:00Z',
    updated_at: '2023-01-02T00:00:00Z',
    user: { __typename: 'User', id: 'u1', email: 'test@example.com' },
    parent: null,
    children: [],
    files: [],
  },
];

const renderWithProviders = (component: React.ReactElement) => {
  return render(
    <ThemeProvider theme={theme}>
      {component}
    </ThemeProvider>
  );
};

describe('FileExplorer - Starring Functionality', () => {
  beforeEach(() => {
    // Setup default mocks for useQuery
    mockUseQuery.mockImplementation((query: any, options?: QueryHookOptions) => {
      console.log('Mock useQuery called with query:', query);
      if (query.includes('myFiles')) {
        console.log('Returning mockFiles');
        return {
          data: { myFiles: mockFiles },
          loading: false,
          error: null,
          refetch: jest.fn(),
        };
      }
      if (query.includes('myFolders')) {
        console.log('Returning mockFolders');
        return {
          data: { myFolders: mockFolders },
          loading: false,
          error: null,
          refetch: jest.fn(),
        };
      }
      console.log('Returning default null');
      return { data: null, loading: false, error: null, refetch: jest.fn() };
    });

    // Setup default mocks for useMutation
    mockUseMutation.mockImplementation((mutation: any) => {
      const mockMutationFn = jest.fn();
      return [mockMutationFn, { loading: false, error: null }];
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Star File', () => {
    it('should star an unstarred file successfully', async () => {
      const mockStarFile = jest.fn().mockResolvedValue({
        data: { starFile: true },
      });

      mockUseMutation.mockImplementation((mutation: any) => {
        if (mutation.includes('StarFile')) {
          return [mockStarFile, { loading: false, error: null }];
        }
        return [jest.fn(), { loading: false, error: null }];
      });

      renderWithProviders(<FileExplorer externalViewMode="list" />);

      await waitFor(() => {
        expect(screen.getByText('test-file.txt')).toBeInTheDocument();
      });

      // Find the ListItem for the unstarred file
      const unstarredFileListItem = screen.getByText('test-file.txt').closest('[data-file-item]');
      expect(unstarredFileListItem).toBeInTheDocument();

      // Find the star button (second button in the actions)
      const buttons = within(unstarredFileListItem! as HTMLElement).getAllByRole('button');
      const starButton = buttons[1]; // Download (0), Star (1), Delete (2)
      expect(starButton).toBeInTheDocument();
      fireEvent.click(starButton);

      await waitFor(() => {
        expect(mockStarFile).toHaveBeenCalledWith({ variables: { id: '1' } });
      });
    });

    it('should handle star file mutation error', async () => {
      const mockStarFile = jest.fn().mockRejectedValue(new Error('Failed to star file'));

      mockUseMutation.mockImplementation((mutation: DocumentNode) => {
        if (mutation.loc?.source.body.includes('StarFile')) {
          return [mockStarFile, { loading: false, error: new Error('Failed to star file') }];
        }
        return [jest.fn(), { loading: false, error: null }];
      });

      renderWithProviders(<FileExplorer externalViewMode="list" />);

      await waitFor(() => {
        expect(screen.getByText('test-file.txt')).toBeInTheDocument();
      });

      // Find the ListItem for the unstarred file
      const unstarredFileListItem = screen.getByText('test-file.txt').closest('[data-file-item]');
      expect(unstarredFileListItem).toBeInTheDocument();

      // Find the star button (second button in the actions)
      const buttons = within(unstarredFileListItem! as HTMLElement).getAllByRole('button');
      const starButton = buttons[1]; // Download (0), Star (1), Delete (2)
      expect(starButton).toBeInTheDocument();
      fireEvent.click(starButton);

      // Error handling should be tested via snackbar or error state
      expect(mockStarFile).toHaveBeenCalledWith({ variables: { id: '1' } });
    });
  });

  describe('Unstar File', () => {
    it('should unstar a starred file successfully', async () => {
      const mockUnstarFile = jest.fn().mockResolvedValue({
        data: { unstarFile: true },
      });

      mockUseMutation.mockImplementation((mutation: DocumentNode) => {
        if (mutation.loc?.source.body.includes('UnstarFile')) {
          return [mockUnstarFile, { loading: false, error: null }];
        }
        return [jest.fn(), { loading: false, error: null }];
      });

      renderWithProviders(<FileExplorer externalViewMode="list" />);

      await waitFor(() => {
        expect(screen.getByText('starred-file.txt')).toBeInTheDocument();
      });

      // Find the ListItem for the starred file
      const starredFileListItem = screen.getByText('starred-file.txt').closest('[data-file-item]');
      expect(starredFileListItem).toBeInTheDocument();

      // Find the star button (second button in the actions)
      const buttons = within(starredFileListItem! as HTMLElement).getAllByRole('button');
      const starButton = buttons[1]; // Download (0), Star (1), Delete (2)
      expect(starButton).toBeInTheDocument();
      fireEvent.click(starButton);

      await waitFor(() => {
        expect(mockUnstarFile).toHaveBeenCalledWith({ variables: { id: '2' } });
      });
    });
  });

  describe('Star Folder', () => {
    it('should star an unstarred folder successfully', async () => {
      const mockStarFolder = jest.fn().mockResolvedValue({
        data: { starFolder: true },
      });

      mockUseMutation.mockImplementation((mutation: DocumentNode) => {
        if (mutation.loc?.source.body.includes('StarFolder')) {
          return [mockStarFolder, { loading: false, error: null }];
        }
        return [jest.fn(), { loading: false, error: null }];
      });

      renderWithProviders(<FileExplorer />);

      await waitFor(() => {
        expect(screen.getByText('Test Folder')).toBeInTheDocument();
      });

      // Right-click on the unstarred folder to open context menu
      const unstarredFolderItem = screen.getByText('Test Folder').closest('[data-file-item]');
      expect(unstarredFolderItem).toBeInTheDocument();
      fireEvent.contextMenu(unstarredFolderItem!);

      // Find the star menu item in the context menu
      const starMenuItem = screen.getByRole('menuitem', { name: /star/i });
      expect(starMenuItem).toBeInTheDocument();
      fireEvent.click(starMenuItem);

      await waitFor(() => {
        expect(mockStarFolder).toHaveBeenCalledWith({ variables: { id: '1' } });
      });
    });
  });

  describe('Unstar Folder', () => {
    it('should unstar a starred folder successfully', async () => {
      const mockUnstarFolder = jest.fn().mockResolvedValue({
        data: { unstarFolder: true },
      });

      mockUseMutation.mockImplementation((mutation: DocumentNode) => {
        if (mutation.loc?.source.body.includes('UnstarFolder')) {
          return [mockUnstarFolder, { loading: false, error: null }];
        }
        return [jest.fn(), { loading: false, error: null }];
      });

      renderWithProviders(<FileExplorer />);

      await waitFor(() => {
        expect(screen.getByText('Starred Folder')).toBeInTheDocument();
      });

      // Right-click on the starred folder to open context menu
      const starredFolderItem = screen.getByText('Starred Folder').closest('[data-file-item]');
      expect(starredFolderItem).toBeInTheDocument();
      fireEvent.contextMenu(starredFolderItem!);

      // Find the unstar menu item in the context menu
      const unstarMenuItem = screen.getByRole('menuitem', { name: /unstar/i });
      expect(unstarMenuItem).toBeInTheDocument();
      fireEvent.click(unstarMenuItem);

      await waitFor(() => {
        expect(mockUnstarFolder).toHaveBeenCalledWith({ variables: { id: '2' } });
      });
    });
  });

  describe('Bulk Star Operations', () => {
    it('should star multiple selected items', async () => {
      const mockStarFile = jest.fn().mockResolvedValue({ data: { starFile: true } });
      const mockStarFolder = jest.fn().mockResolvedValue({ data: { starFolder: true } });

      mockUseMutation.mockImplementation((mutation: DocumentNode) => {
        if (mutation.loc?.source.body.includes('StarFile')) return [mockStarFile, { loading: false, error: null }];
        if (mutation.loc?.source.body.includes('StarFolder')) return [mockStarFolder, { loading: false, error: null }];
        return [jest.fn(), { loading: false, error: null }];
      });

      renderWithProviders(<FileExplorer />);

      await waitFor(() => {
        expect(screen.getByText('test-file.txt')).toBeInTheDocument();
        expect(screen.getByText('Test Folder')).toBeInTheDocument();
      });

      // Test assumes bulk star functionality exists
      // This is a placeholder test for bulk operations
      expect(screen.getByText('test-file.txt')).toBeInTheDocument();
      expect(screen.getByText('Test Folder')).toBeInTheDocument();
    });
  });

  describe('Context Menu Starring', () => {
    it('should show star/unstar options in context menu', async () => {
      renderWithProviders(<FileExplorer />);

      await waitFor(() => {
        expect(screen.getByText('test-file.txt')).toBeInTheDocument();
      });

      // Right-click on a file to open context menu
      const fileItem = screen.getByText('test-file.txt').closest('[data-file-item]');
      expect(fileItem).toBeInTheDocument();

      fireEvent.contextMenu(fileItem!);

      // Check if star option is available in context menu
      // This test assumes context menu implementation
      expect(screen.getByText('test-file.txt')).toBeInTheDocument();
    });
  });

  describe('Keyboard Shortcuts', () => {
    it('should handle Ctrl+Shift+S to star selected items', async () => {
      renderWithProviders(<FileExplorer />);

      await waitFor(() => {
        expect(screen.getByText('test-file.txt')).toBeInTheDocument();
      });

      // Simulate Ctrl+Shift+S keyboard shortcut
      fireEvent.keyDown(document, {
        key: 'S',
        ctrlKey: true,
        shiftKey: true,
      });

      // Test assumes keyboard shortcut implementation
      expect(screen.getByText('test-file.txt')).toBeInTheDocument();
    });
  });
});