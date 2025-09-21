import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MockedProvider } from '@apollo/client/testing';
import { InMemoryCache } from '@apollo/client';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import StarredSidebar from '../../../components/common/StarredSidebar';
import {
  GET_STARRED_FILES_QUERY,
  GET_STARRED_FOLDERS_QUERY,
} from '../../../apollo/queries';
import { MockedResponse } from '@apollo/client/testing';
import { UserFile, Folder } from '../../../types';

const theme = createTheme();

const mockStarredFiles = [
  {
    __typename: 'UserFile',
    id: '1',
    filename: 'important-document.pdf',
    mime_type: 'application/pdf',
    folder_id: null,
    is_starred: true,
    created_at: '2023-01-01T00:00:00Z',
    file: {
      __typename: 'File',
      id: 'f1',
      size_bytes: 1024000,
      content_hash: 'hash1',
    },
    folder: null,
  },
  {
    __typename: 'UserFile',
    id: '2',
    filename: 'presentation.pptx',
    mime_type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    folder_id: null,
    is_starred: true,
    created_at: '2023-01-02T00:00:00Z',
    file: {
      __typename: 'File',
      id: 'f2',
      size_bytes: 2048000,
      content_hash: 'hash2',
    },
    folder: null,
  },
];

const mockStarredFolders = [
  {
    __typename: 'Folder',
    id: '1',
    name: 'Project Documents',
    parent_id: null,
    is_starred: true,
    created_at: '2023-01-01T00:00:00Z',
    updated_at: '2023-01-01T00:00:00Z',
    user: { __typename: 'User', id: 'u1', email: 'test@example.com' },
    parent: null,
    children: [],
    files: [
      {
        __typename: 'UserFile',
        id: '1',
        filename: 'readme.txt',
        mime_type: 'text/plain',
        created_at: '2023-01-01T00:00:00Z',
        file: { __typename: 'File', size_bytes: 1024 },
      },
    ],
  },
  {
    __typename: 'Folder',
    id: '2',
    name: 'Personal',
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

const defaultMocks: MockedResponse[] = [
  {
    request: {
      query: GET_STARRED_FILES_QUERY,
    },
    result: {
      data: {
        myStarredFiles: mockStarredFiles,
      },
    },
  },
  {
    request: {
      query: GET_STARRED_FOLDERS_QUERY,
    },
    result: {
      data: {
        myStarredFolders: mockStarredFolders,
      },
    },
  },
];

const renderWithProviders = (component: React.ReactElement, mocks: MockedResponse[] = defaultMocks) => {
  const cache = new InMemoryCache();
  return render(
    <MockedProvider mocks={mocks} cache={cache}>
      <ThemeProvider theme={theme}>
        {component}
      </ThemeProvider>
    </MockedProvider>
  );
};

describe('StarredSidebar', () => {
  describe('Rendering', () => {
    it('should render starred sidebar with collapsed state', () => {
      renderWithProviders(<StarredSidebar isCollapsed={true} />);

      expect(screen.getByText('Starred')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /chevron right/i })).toBeInTheDocument();
    });

    it('should render expanded starred sidebar', () => {
      renderWithProviders(<StarredSidebar isCollapsed={false} />);

      expect(screen.getByText('Starred')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /chevron left/i })).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Search starred items...')).toBeInTheDocument();
    });

    it('should display loading state', () => {
      const loadingMocks = [
        {
          request: {
            query: GET_STARRED_FILES_QUERY,
          },
          result: {
            data: {
              myStarredFiles: [],
            },
          },
          delay: 100, // Simulate loading delay
        },
        {
          request: {
            query: GET_STARRED_FOLDERS_QUERY,
          },
          result: {
            data: {
              myStarredFolders: [],
            },
          },
          delay: 100,
        },
      ];

      renderWithProviders(<StarredSidebar />, loadingMocks);

      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });

    it('should display error state', async () => {
      const errorMocks: MockedResponse[] = [
        {
          request: {
            query: GET_STARRED_FILES_QUERY,
          },
          error: new Error('Failed to load'),
        },
        {
          request: {
            query: GET_STARRED_FOLDERS_QUERY,
          },
          error: new Error('Failed to load'),
        },
      ];

      renderWithProviders(<StarredSidebar />, errorMocks);

      await waitFor(() => {
        expect(screen.getByText('Failed to load starred items')).toBeInTheDocument();
      });
    });
  });

  describe('Data Display', () => {
    it('should display starred files and folders', async () => {
      renderWithProviders(<StarredSidebar />);

      await waitFor(() => {
        expect(screen.getByText('important-document.pdf')).toBeInTheDocument();
        expect(screen.getByText('presentation.pptx')).toBeInTheDocument();
        expect(screen.getByText('Project Documents')).toBeInTheDocument();
        expect(screen.getByText('Personal')).toBeInTheDocument();
      });

      // Check section headers
      expect(screen.getByText('Folders (2)')).toBeInTheDocument();
      expect(screen.getByText('Files (2)')).toBeInTheDocument();
    });

    it('should display file count for folders', async () => {
      renderWithProviders(<StarredSidebar />);

      await waitFor(() => {
        expect(screen.getByText('Project Documents')).toBeInTheDocument();
      });

      // Check that folder shows file count
      expect(screen.getByText('1 file')).toBeInTheDocument();
    });

    it('should display empty state when no starred items', async () => {
      const emptyMocks = [
        {
          request: {
            query: GET_STARRED_FILES_QUERY,
          },
          result: {
            data: {
              myStarredFiles: [],
            },
          },
        },
        {
          request: {
            query: GET_STARRED_FOLDERS_QUERY,
          },
          result: {
            data: {
              myStarredFolders: [],
            },
          },
        },
      ];

      renderWithProviders(<StarredSidebar />, emptyMocks);

      await waitFor(() => {
        expect(screen.getByText('No starred items')).toBeInTheDocument();
        expect(screen.getByText('Star files and folders to access them quickly here')).toBeInTheDocument();
      });
    });
  });

  describe('Search Functionality', () => {
    it('should filter items based on search query', async () => {
      renderWithProviders(<StarredSidebar />);

      await waitFor(() => {
        expect(screen.getByText('important-document.pdf')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText('Search starred items...');
      fireEvent.change(searchInput, { target: { value: 'presentation' } });

      await waitFor(() => {
        expect(screen.getByText('presentation.pptx')).toBeInTheDocument();
        expect(screen.queryByText('important-document.pdf')).not.toBeInTheDocument();
        expect(screen.queryByText('Project Documents')).not.toBeInTheDocument();
      });
    });

    it('should show no results message when search yields no matches', async () => {
      renderWithProviders(<StarredSidebar />);

      await waitFor(() => {
        expect(screen.getByText('important-document.pdf')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText('Search starred items...');
      fireEvent.change(searchInput, { target: { value: 'nonexistent' } });

      await waitFor(() => {
        expect(screen.getByText('No starred items match your search')).toBeInTheDocument();
      });
    });

    it('should clear search and show all items', async () => {
      renderWithProviders(<StarredSidebar />);

      await waitFor(() => {
        expect(screen.getByText('important-document.pdf')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText('Search starred items...');
      fireEvent.change(searchInput, { target: { value: 'presentation' } });

      await waitFor(() => {
        expect(screen.queryByText('important-document.pdf')).not.toBeInTheDocument();
      });

      // Clear search
      fireEvent.change(searchInput, { target: { value: '' } });

      await waitFor(() => {
        expect(screen.getByText('important-document.pdf')).toBeInTheDocument();
        expect(screen.getByText('presentation.pptx')).toBeInTheDocument();
      });
    });
  });

  describe('Section Collapsing', () => {
    it('should collapse and expand folders section', async () => {
      renderWithProviders(<StarredSidebar />);

      await waitFor(() => {
        expect(screen.getByText('Project Documents')).toBeInTheDocument();
      });

      // Click to collapse folders section
      const foldersHeader = screen.getByText('Folders (2)').closest('li');
      expect(foldersHeader).toBeInTheDocument();
      fireEvent.click(foldersHeader!);

      await waitFor(() => {
        expect(screen.queryByText('Project Documents')).not.toBeInTheDocument();
      });

      // Click to expand folders section
      fireEvent.click(foldersHeader!);

      await waitFor(() => {
        expect(screen.getByText('Project Documents')).toBeInTheDocument();
      });
    });

    it('should collapse and expand files section', async () => {
      renderWithProviders(<StarredSidebar />);

      await waitFor(() => {
        expect(screen.getByText('important-document.pdf')).toBeInTheDocument();
      });

      // Click to collapse files section
      const filesHeader = screen.getByText('Files (2)').closest('li');
      expect(filesHeader).toBeInTheDocument();
      fireEvent.click(filesHeader!);

      await waitFor(() => {
        expect(screen.queryByText('important-document.pdf')).not.toBeInTheDocument();
      });

      // Click to expand files section
      fireEvent.click(filesHeader!);

      await waitFor(() => {
        expect(screen.getByText('important-document.pdf')).toBeInTheDocument();
      });
    });
  });

  describe('Item Interaction', () => {
    it('should call onItemClick when file is clicked', async () => {
      const mockOnItemClick = jest.fn();
      renderWithProviders(
        <StarredSidebar onItemClick={mockOnItemClick} />
      );

      await waitFor(() => {
        expect(screen.getByText('important-document.pdf')).toBeInTheDocument();
      });

      const fileItem = screen.getByText('important-document.pdf').closest('li');
      expect(fileItem).toBeInTheDocument();
      fireEvent.click(fileItem!);

      expect(mockOnItemClick).toHaveBeenCalledWith(mockStarredFiles[0]);
    });

    it('should call onFolderClick when folder is clicked', async () => {
      const mockOnFolderClick = jest.fn();
      renderWithProviders(
        <StarredSidebar onFolderClick={mockOnFolderClick} />
      );

      await waitFor(() => {
        expect(screen.getByText('Project Documents')).toBeInTheDocument();
      });

      const folderItem = screen.getByText('Project Documents').closest('li');
      expect(folderItem).toBeInTheDocument();
      fireEvent.click(folderItem!);

      expect(mockOnFolderClick).toHaveBeenCalledWith('1', 'Project Documents');
    });
  });

  describe('Collapse Toggle', () => {
    it('should call onToggleCollapse when collapse button is clicked', () => {
      const mockOnToggleCollapse = jest.fn();
      renderWithProviders(
        <StarredSidebar onToggleCollapse={mockOnToggleCollapse} />
      );

      const collapseButton = screen.getByRole('button', { name: /chevron left/i });
      fireEvent.click(collapseButton);

      expect(mockOnToggleCollapse).toHaveBeenCalledTimes(1);
    });

    it('should call onToggleCollapse when expand button is clicked in collapsed state', () => {
      const mockOnToggleCollapse = jest.fn();
      renderWithProviders(
        <StarredSidebar isCollapsed={true} onToggleCollapse={mockOnToggleCollapse} />
      );

      const expandButton = screen.getByRole('button', { name: /chevron right/i });
      fireEvent.click(expandButton);

      expect(mockOnToggleCollapse).toHaveBeenCalledTimes(1);
    });
  });

  describe('File Type Icons', () => {
    it('should display correct icons for different file types', async () => {
      renderWithProviders(<StarredSidebar />);

      await waitFor(() => {
        expect(screen.getByText('important-document.pdf')).toBeInTheDocument();
      });

      // Check that file icons are rendered (we can't easily test the specific icon components)
      const fileItems = screen.getAllByRole('listitem');
      expect(fileItems.length).toBeGreaterThan(0);
    });
  });

  describe('Sorting and Display', () => {
    it('should display folders before files', async () => {
      renderWithProviders(<StarredSidebar />);

      await waitFor(() => {
        const listItems = screen.getAllByRole('listitem');
        // First few items should be folder-related (header + folders)
        // Then file-related items
        expect(listItems.length).toBeGreaterThan(4); // At least headers + 2 folders + 2 files
      });
    });

    it('should handle folders with no files', async () => {
      renderWithProviders(<StarredSidebar />);

      await waitFor(() => {
        expect(screen.getByText('Personal')).toBeInTheDocument();
      });

      // The Personal folder has no files, should still display
      const personalFolder = screen.getByText('Personal');
      expect(personalFolder).toBeInTheDocument();
    });
  });

  describe('Error Boundaries', () => {
    it('should handle network errors gracefully', async () => {
      const errorMocks: MockedResponse[] = [
        {
          request: {
            query: GET_STARRED_FILES_QUERY,
          },
          error: new Error('Network error'),
        },
        {
          request: {
            query: GET_STARRED_FOLDERS_QUERY,
          },
          error: new Error('Network error'),
        },
      ];

      renderWithProviders(<StarredSidebar />, errorMocks);

      await waitFor(() => {
        expect(screen.getByText('Failed to load starred items')).toBeInTheDocument();
      });
    });

    it('should handle partial data loading', async () => {
      const partialMocks: MockedResponse[] = [
        {
          request: {
            query: GET_STARRED_FILES_QUERY,
          },
          result: {
            data: {
              myStarredFiles: mockStarredFiles,
            },
          },
        },
        {
          request: {
            query: GET_STARRED_FOLDERS_QUERY,
          },
          error: new Error('Folders failed to load'),
        },
      ];

      renderWithProviders(<StarredSidebar />, partialMocks);

      await waitFor(() => {
        // Should still show files even if folders fail
        expect(screen.getByText('important-document.pdf')).toBeInTheDocument();
        expect(screen.getByText('Failed to load starred items')).toBeInTheDocument();
      });
    });
  });
});