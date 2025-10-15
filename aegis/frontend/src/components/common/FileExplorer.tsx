import React, { useState, useCallback, useRef, memo, useMemo, useEffect } from 'react';
import {
   Box,
   Typography,
   Paper,
   Menu,
   MenuItem,
   Alert,
   Dialog,
   DialogTitle,
   DialogContent,
   DialogActions,
   Button,
   TextField,
   Snackbar,
   IconButton,
   Breadcrumbs,
   Link,
   ToggleButton,
   ToggleButtonGroup,
} from '@mui/material';
import {
   Download as DownloadIcon,
   Delete as DeleteIcon,
   DeleteForever as DeleteForeverIcon,
   CloudUpload as CloudUploadIcon,
   Edit as EditIcon,
   ContentCut as CutIcon,
   Share as ShareIcon,
   Star as StarIcon,
   StarBorder as StarBorderIcon,
   ViewList as ListIcon,
   ViewModule as GridIcon,
   Search as SearchIcon,
   ArrowBack as ArrowBackIcon,
   ChevronRight as ChevronRightIcon,
   CreateNewFolder as CreateNewFolderIcon,
   Restore as RestoreIcon,
} from '@mui/icons-material';
import { useQuery, useMutation } from '@apollo/client';
import { GET_MY_FILES, MOVE_FILE_MUTATION } from '../../apollo/files';
import { GET_MY_FOLDERS, CREATE_FOLDER_MUTATION, RENAME_FOLDER_MUTATION, MOVE_FOLDER_MUTATION, DELETE_FOLDER_MUTATION } from '../../apollo/folders';
import { STAR_FILE_MUTATION, UNSTAR_FILE_MUTATION, STAR_FOLDER_MUTATION, UNSTAR_FOLDER_MUTATION, GET_STARRED_FILES_QUERY, GET_STARRED_FOLDERS_QUERY } from '../../apollo/queries';
import { GET_MY_TRASHED_FILES, GET_MY_TRASHED_FOLDERS, RESTORE_FILE_MUTATION, PERMANENTLY_DELETE_FILE_MUTATION, RESTORE_FOLDER_MUTATION, PERMANENTLY_DELETE_FOLDER_MUTATION, GET_MY_STATS } from '../../apollo/queries';
import { UserFile, Folder, FileExplorerItem, isFolder, isFile } from '../../types';
import { useFileOperations } from '../../hooks/useFileOperations';
import { useFileUpload } from '../../hooks/useFileUpload';
import FileGrid from './FileGrid';
import FileToolbar from './FileToolbar';
import { FileListItem } from './FileListItem';
import UploadProgress from './UploadProgress';
import { ShareLinkManager } from './ShareLinkManager';

// Helper function to calculate folder size recursively
const calculateFolderSize = (folder: Folder): number => {
  let totalSize = 0;

  // Add sizes of direct files in this folder
  if (folder.files) {
    totalSize += folder.files.reduce((sum, file) => {
      return sum + (file.file?.size_bytes || 0);
    }, 0);
  }

  // Add sizes of files in subfolders recursively
  if (folder.children) {
    totalSize += folder.children.reduce((sum, childFolder) => {
      return sum + calculateFolderSize(childFolder);
    }, 0);
  }

  return totalSize;
};


interface FileExplorerProps {
    folderId?: string | null;
    onFileDeleted?: () => void;
    onUploadComplete?: () => void;
    onFolderClick?: (folderId: string, folderName: string) => void;
    externalSearchTerm?: string;
    externalViewMode?: 'list' | 'tile';
    onSelectionChange?: (count: number) => void;
    // New header props
    showHeader?: boolean;
    title?: string;
    description?: string;
    showBreadcrumbs?: boolean;
    folderPath?: Array<{ id: string | null; name: string }>;
    onBreadcrumbClick?: (index: number) => void;
    canNavigateBack?: boolean;
    onNavigateBack?: () => void;
    showNewFolderButton?: boolean;
    onCreateFolder?: () => void;
    onViewModeChange?: (mode: 'list' | 'tile') => void;
    // Trash mode props
    isTrashMode?: boolean;
    onFileRestored?: () => void;
    isStarredMode?: boolean;
    onFileSelect?: (files: File[]) => void;
}

const FileExplorer: React.FC<FileExplorerProps> = ({
    folderId,
    onFileDeleted,
    onUploadComplete,
    onFolderClick,
    externalSearchTerm = '',
    externalViewMode,
    onSelectionChange,
    // Header props with defaults
    showHeader = true,
    title,
    description,
    showBreadcrumbs = !!folderId,
    folderPath = [],
    onBreadcrumbClick,
    canNavigateBack = false,
    onNavigateBack,
    showNewFolderButton = true,
    onCreateFolder,
    onViewModeChange,
    // Trash mode props
    isTrashMode = false,
    onFileRestored,
    isStarredMode = false,
    onFileSelect,
}) => {
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [contextMenu, setContextMenu] = useState<{
    mouseX: number;
    mouseY: number;
    fileId: string;
  } | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [fileToDelete, setFileToDelete] = useState<UserFile | null>(null);
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
  const [itemsToDelete, setItemsToDelete] = useState<FileExplorerItem[]>([]);
  const [folderDeleteDialogOpen, setFolderDeleteDialogOpen] = useState(false);
  const [folderToDelete, setFolderToDelete] = useState<Folder | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [createFolderDialogOpen, setCreateFolderDialogOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [folderCreationError, setFolderCreationError] = useState<string | null>(null);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [renameItem, setRenameItem] = useState<FileExplorerItem | null>(null);
  const [newItemName, setNewItemName] = useState('');
  const [renameError, setRenameError] = useState<string | null>(null);
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);
  const [selectionAnchor, setSelectionAnchor] = useState<number>(-1);
  const [isBoxSelecting, setIsBoxSelecting] = useState(false);
  const [boxSelectionStart, setBoxSelectionStart] = useState<{ x: number; y: number } | null>(null);
  const [boxSelectionEnd, setBoxSelectionEnd] = useState<{ x: number; y: number } | null>(null);
  const [cutItems, setCutItems] = useState<Set<string>>(() => {
    // Initialize from localStorage to persist across folder navigation
    const stored = localStorage.getItem('fileExplorerCutItems');
    const initialCutItems = stored ? new Set(JSON.parse(stored) as string[]) : new Set<string>();
    console.log('DEBUG: Initializing cutItems from localStorage:', stored, 'parsed:', Array.from(initialCutItems));
    return initialCutItems;
  });
  const [copiedItems, setCopiedItems] = useState<Set<string>>(() => {
    // Initialize from localStorage to persist across folder navigation
    const stored = localStorage.getItem('fileExplorerCopiedItems');
    const initialCopiedItems = stored ? new Set(JSON.parse(stored) as string[]) : new Set<string>();
    console.log('DEBUG: Initializing copiedItems from localStorage:', stored, 'parsed:', Array.from(initialCopiedItems));
    return initialCopiedItems;
  });
  const [snackbarMessage, setSnackbarMessage] = useState<string>('');
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [fileToShare, setFileToShare] = useState<UserFile | null>(null);
  const [fileToRestore, setFileToRestore] = useState<UserFile | null>(null);
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);
  const [folderToRestore, setFolderToRestore] = useState<Folder | null>(null);
  const [folderRestoreDialogOpen, setFolderRestoreDialogOpen] = useState(false);
  const [emptyTrashDialogOpen, setEmptyTrashDialogOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // New state for view mode, search, and sorting
  const viewMode = externalViewMode || 'tile';
  const [searchQuery, setSearchQuery] = useState(externalSearchTerm);
  const [fileSortBy, setFileSortBy] = useState<'name' | 'date' | 'size' | 'type'>('name');
  const [fileSortOrder, setFileSortOrder] = useState<'asc' | 'desc'>('asc');

  // Sync external search term with internal state
  useEffect(() => {
    setSearchQuery(externalSearchTerm);
  }, [externalSearchTerm]);

  const { data, error: queryError, refetch } = useQuery(isTrashMode ? GET_MY_TRASHED_FILES : (isStarredMode ? GET_STARRED_FILES_QUERY : GET_MY_FILES), {
    variables: isTrashMode || isStarredMode ? {} : {
      filter: {
        folder_id: folderId || "",
        includeTrashed: false // Explicitly exclude trashed files
      }
    },
    fetchPolicy: 'cache-and-network',
    onCompleted: (data: any) => {
      // Debug logging removed - issue resolved
    },
    onError: (error) => {
      // Debug logging removed - issue resolved
    },
  });

  const { data: foldersData, refetch: refetchFolders } = useQuery(isStarredMode ? GET_STARRED_FOLDERS_QUERY : GET_MY_FOLDERS, {
    fetchPolicy: 'cache-and-network',
  });

  const { data: trashedFoldersData } = useQuery(GET_MY_TRASHED_FOLDERS, {
    fetchPolicy: 'cache-and-network',
    skip: !isTrashMode, // Only fetch when in trash mode
  });

  // Get all available files and folders for paste operations
  const allAvailableItems = useMemo(() => {
    const allFiles = (isTrashMode ? data?.myTrashedFiles : (isStarredMode ? data?.myStarredFiles : data?.myFiles)) || [];
    const allFolders = isTrashMode ? [] : (isStarredMode ? foldersData?.myStarredFolders : foldersData?.myFolders) || []; // No paste operations in trash mode
    return [...allFiles, ...allFolders];
  }, [isTrashMode, isStarredMode, data?.myTrashedFiles, data?.myStarredFiles, data?.myFiles, foldersData?.myStarredFolders, foldersData?.myFolders]);

  const [moveFileMutation] = useMutation(MOVE_FILE_MUTATION);
  const [createFolderMutation] = useMutation(CREATE_FOLDER_MUTATION);
  const [renameFolderMutation] = useMutation(RENAME_FOLDER_MUTATION);
  const [moveFolderMutation] = useMutation(MOVE_FOLDER_MUTATION);
  const [deleteFolderMutation] = useMutation(DELETE_FOLDER_MUTATION);
  const [starFileMutation] = useMutation(STAR_FILE_MUTATION);
  const [unstarFileMutation] = useMutation(UNSTAR_FILE_MUTATION);
  const [starFolderMutation] = useMutation(STAR_FOLDER_MUTATION);
  const [unstarFolderMutation] = useMutation(UNSTAR_FOLDER_MUTATION);
  const [restoreFileMutation] = useMutation(RESTORE_FILE_MUTATION);
  const [permanentlyDeleteFileMutation] = useMutation(PERMANENTLY_DELETE_FILE_MUTATION);
  const [restoreFolderMutation] = useMutation(RESTORE_FOLDER_MUTATION);
  const [permanentlyDeleteFolderMutation] = useMutation(PERMANENTLY_DELETE_FOLDER_MUTATION);

  // Filter and sort folders based on current folderId and search query
  const currentFolders = useMemo(() => {
    let filtered;

    if (isStarredMode) {
      // In starred mode, show all starred folders (no folder hierarchy filtering)
      filtered = foldersData?.myStarredFolders?.filter((folder: Folder) => {
        // First filter out null/undefined items
        if (!folder) return false;

        // Search filter for folders
        if (searchQuery) {
          const query = searchQuery.toLowerCase();
          return folder.name.toLowerCase().includes(query);
        }

        return true;
      }) || [];
    } else if (isTrashMode) {
      // In trash mode, try to use trashed folders data, but fall back to creating virtual folders
      if (trashedFoldersData?.myTrashedFolders) {
        // Normal path: use actual trashed folders data
        filtered = trashedFoldersData.myTrashedFolders.filter((folder: Folder) => {
          // First filter out null/undefined items
          if (!folder) return false;

          if (folderId) {
            // In a specific trashed folder, show its children that are also trashed
            if (folder.parent_id !== folderId) return false;
          } else {
            // In trash root, show trashed folders with no parent or whose parent is not trashed
            // This allows top-level deleted folders to appear in trash
            if (folder.parent_id) {
              // Check if parent is also in trash - if not, this folder should appear at root level
              const parentInTrash = trashedFoldersData.myTrashedFolders.find(
                (f: Folder) => f.id === folder.parent_id
              );
              if (parentInTrash) return false;
            }
          }

          // Search filter for folders
          if (searchQuery) {
            const query = searchQuery.toLowerCase();
            return folder.name.toLowerCase().includes(query);
          }

          return true;
        });
      } else {
        // Fallback: Create virtual folders from trashed files' folder information
        const trashedFiles = data?.myTrashedFiles || [];
        const folderMap = new Map<string, Folder>();

        // Extract unique folders from trashed files and count their files
        trashedFiles.forEach((file: UserFile) => {
          if (file.folder && file.folder.id && file.folder.name) {
            if (!folderMap.has(file.folder.id)) {
              // Create a virtual folder entity with proper defaults
              folderMap.set(file.folder.id, {
                id: file.folder.id,
                name: file.folder.name || 'Unnamed Folder',
                user_id: file.user_id,
                parent_id: file.folder.parent_id || null,
                is_starred: false, // Default value for virtual folders
                created_at: file.folder.created_at || file.created_at,
                updated_at: file.folder.updated_at || file.updated_at,
                children: [], // Required for isFolder type guard
                files: [], // Will be populated with files belonging to this folder
              } as Folder);
            }

            // Add this file to the virtual folder's files array
            const virtualFolder = folderMap.get(file.folder.id);
            if (virtualFolder) {
              virtualFolder.files!.push(file);
            }
          }
        });

        // Convert to array and filter
        const virtualFolders = Array.from(folderMap.values());
        filtered = virtualFolders.filter((folder: Folder) => {
          if (folderId) {
            // In a specific folder, show its children
            return folder.parent_id === folderId;
          } else {
            // In trash root, show top-level folders (those without parents in the folderMap)
            return !folder.parent_id || !folderMap.has(folder.parent_id);
          }
        });
      }
      
      // Apply search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        filtered = filtered.filter((folder: Folder) => 
          folder.name.toLowerCase().includes(query)
        );
      }
    } else {
      // Regular mode - show active folders
      filtered = foldersData?.myFolders?.filter((folder: Folder) => {
        // First filter out null/undefined items
        if (!folder) return false;

        if (folderId) {
          // In a specific folder, show its children
          if (folder.parent_id !== folderId) return false;
        } else {
          // In root, show folders with no parent
          if (folder.parent_id) return false;
        }

        // Search filter for folders
        if (searchQuery) {
          const query = searchQuery.toLowerCase();
          return folder.name.toLowerCase().includes(query);
        }

        return true;
      }) || [];
    }

    // Sort folders using the same logic as files
    filtered.sort((a: Folder, b: Folder) => {
      let comparison = 0;

      switch (fileSortBy) {
        case 'name':
          const aName = a.name || 'Unnamed Folder';
          const bName = b.name || 'Unnamed Folder';
          comparison = aName.localeCompare(bName);
          break;
        case 'date':
          comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          break;
        case 'size':
          // Use calculated folder size for sorting
          const aSize = calculateFolderSize(a);
          const bSize = calculateFolderSize(b);
          comparison = aSize - bSize;
          break;
        default:
          comparison = 0;
      }

      return fileSortOrder === 'asc' ? comparison : -comparison;
    });

    return filtered;
  }, [isTrashMode, isStarredMode, foldersData?.myFolders, foldersData?.myStarredFolders, trashedFoldersData?.myTrashedFolders, data?.myTrashedFiles, folderId, searchQuery, fileSortBy, fileSortOrder]);

  // Client-side filter files by folder_id and search query
  const filteredFiles = useMemo(() => {
    const files = isTrashMode ? data?.myTrashedFiles : (isStarredMode ? data?.myStarredFiles : data?.myFiles);
    if (!files) return [];

    let filtered = files.filter((file: UserFile) => {
      // Filter out null/undefined items for data integrity
      if (!file || !file.id) return false;

      // Folder filter
      if (isStarredMode) {
        // In starred mode, show all starred files (no folder filtering)
      } else if (isTrashMode) {
        // In trash mode, if we're browsing into a specific folder, show only files from that folder
        if (folderId) {
          if (file.folder_id !== folderId) return false;
        } else {
          // In trash root (no folderId), show files that either:
          // 1. Don't belong to any folder (folder_id is null), OR
          // 2. Belong to a folder that is not trashed (parent folder is still active)
          if (file.folder_id) {
            // Check if the parent folder is trashed
            const parentFolderTrashed = trashedFoldersData?.myTrashedFolders?.some(
              (folder: Folder) => folder.id === file.folder_id
            );
            if (parentFolderTrashed) return false; // Hide files whose parent folder is trashed
          }
          // Show files with no parent folder or whose parent folder is not trashed
        }
      } else {
        // Normal mode folder filtering
        if (folderId) {
          if (file.folder_id !== folderId) return false;
        } else {
          if (file.folder_id) return false;
        }
      }

      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return file.filename.toLowerCase().includes(query) ||
                file.mime_type?.toLowerCase().includes(query);
      }

      return true;
    });

    return filtered;
  }, [isTrashMode, isStarredMode, data?.myTrashedFiles, data?.myStarredFiles, data?.myFiles, folderId, searchQuery]);

  // Use custom hooks
  const { downloadingFile, error, downloadFile, deleteFile } = useFileOperations();
  const { uploads, handleFiles, removeUpload, clearCompleted } = useFileUpload(onUploadComplete);

  // Combine folders and files for display and sort them together
  const allItems: FileExplorerItem[] = useMemo(() => {
    let combined = [...currentFolders, ...filteredFiles];

    // Sort the combined array
    combined.sort((a: FileExplorerItem, b: FileExplorerItem) => {
      let comparison = 0;

      switch (fileSortBy) {
        case 'name':
          const aName = isFolder(a) ? (a.name || 'Unnamed Folder') : (a.filename || 'Unnamed File');
          const bName = isFolder(b) ? (b.name || 'Unnamed Folder') : (b.filename || 'Unnamed File');
          comparison = aName.localeCompare(bName);
          break;
        case 'date':
          comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          break;
        case 'size':
          const aSize = isFolder(a) ? calculateFolderSize(a) : (a.file?.size_bytes || 0);
          const bSize = isFolder(b) ? calculateFolderSize(b) : (b.file?.size_bytes || 0);
          comparison = aSize - bSize;
          break;
        case 'type':
          // Folders first, then files sorted by extension
          const aIsFolder = isFolder(a);
          const bIsFolder = isFolder(b);
          if (aIsFolder && !bIsFolder) {
            comparison = -1; // folders come first
          } else if (!aIsFolder && bIsFolder) {
            comparison = 1; // folders come first
          } else if (aIsFolder && bIsFolder) {
            // both folders, sort by name
            const aFolderName = a.name || 'Unnamed Folder';
            const bFolderName = b.name || 'Unnamed Folder';
            comparison = aFolderName.localeCompare(bFolderName);
          } else {
            // both files, sort by extension
            const aExt = isFile(a) ? a.filename.split('.').pop()?.toLowerCase() || '' : '';
            const bExt = isFile(b) ? b.filename.split('.').pop()?.toLowerCase() || '' : '';
            comparison = aExt.localeCompare(bExt);
          }
          break;
        default:
          comparison = 0;
      }

      return fileSortOrder === 'asc' ? comparison : -comparison;
    });

    return combined;
  }, [currentFolders, filteredFiles, fileSortBy, fileSortOrder]);

  // Helper function to select a range of items
  const selectRange = useCallback((startIndex: number, endIndex: number) => {
    const start = Math.min(startIndex, endIndex);
    const end = Math.max(startIndex, endIndex);
    const rangeIds = allItems.slice(start, end + 1).map(item => item.id);
    setSelectedFiles(new Set(rangeIds));
  }, [allItems]);

  // File operations handlers
  const handleDownload = useCallback(async (file: UserFile) => {
    await downloadFile(file);
  }, [downloadFile]);

  const handleDeleteClick = useCallback((file: UserFile) => {
    setFileToDelete(file);
    setDeleteDialogOpen(true);
    setContextMenu(null);
  }, []);

  const handleStarFile = useCallback(async (file: UserFile) => {
    try {
      await starFileMutation({
        variables: { id: file.id },
      });
      refetch(); // Refresh the data
      setSnackbarMessage(`Starred "${file.filename}"`);
      setSnackbarOpen(true);
    } catch (error) {
      console.error('Error starring file:', error);
      setSnackbarMessage('Failed to star file');
      setSnackbarOpen(true);
    }
  }, [starFileMutation, refetch]);

  const handleUnstarFile = useCallback(async (file: UserFile) => {
    try {
      await unstarFileMutation({
        variables: { id: file.id },
      });
      refetch(); // Refresh the data
      setSnackbarMessage(`Unstarred "${file.filename}"`);
      setSnackbarOpen(true);
    } catch (error) {
      console.error('Error unstarring file:', error);
      setSnackbarMessage('Failed to unstar file');
      setSnackbarOpen(true);
    }
  }, [unstarFileMutation, refetch]);

  const handleStarFolder = useCallback(async (folder: Folder) => {
    try {
      await starFolderMutation({
        variables: { id: folder.id },
      });
      refetchFolders(); // Refresh the folder data
      setSnackbarMessage(`Starred "${folder.name}"`);
      setSnackbarOpen(true);
    } catch (error) {
      console.error('Error starring folder:', error);
      setSnackbarMessage('Failed to star folder');
      setSnackbarOpen(true);
    }
  }, [starFolderMutation, refetchFolders]);

  const handleUnstarFolder = useCallback(async (folder: Folder) => {
    try {
      await unstarFolderMutation({
        variables: { id: folder.id },
      });
      refetchFolders(); // Refresh the folder data
      setSnackbarMessage(`Unstarred "${folder.name}"`);
      setSnackbarOpen(true);
    } catch (error) {
      console.error('Error unstarring folder:', error);
      setSnackbarMessage('Failed to unstar folder');
      setSnackbarOpen(true);
    }
  }, [unstarFolderMutation, refetchFolders]);

  const handleStarToggle = useCallback(async (item: FileExplorerItem) => {
    if (isFile(item)) {
      if (item.is_starred) {
        await handleUnstarFile(item);
      } else {
        await handleStarFile(item);
      }
    } else if (isFolder(item)) {
      if (item.is_starred) {
        await handleUnstarFolder(item);
      } else {
        await handleStarFolder(item);
      }
    }
  }, [handleStarFile, handleUnstarFile, handleStarFolder, handleUnstarFolder]);

  // Handle file selection
  const handleFileClick = (fileId: string, event: React.MouseEvent) => {
    console.log('DEBUG: handleFileClick called with fileId:', fileId, 'selectedFiles before:', Array.from(selectedFiles));
    if (event.ctrlKey || event.metaKey) {
      setSelectedFiles(prev => {
        const newSet = new Set(prev);
        if (newSet.has(fileId)) {
          newSet.delete(fileId);
        } else {
          newSet.add(fileId);
        }
        console.log('DEBUG: Multi-select, new selection:', Array.from(newSet));
        return newSet;
      });
    } else {
      // If clicking on an already selected file, deselect it
      if (selectedFiles.has(fileId)) {
        console.log('DEBUG: Deselecting already selected item');
        setSelectedFiles(new Set());
      } else {
        console.log('DEBUG: Selecting single item:', fileId);
        setSelectedFiles(new Set([fileId]));
      }
    }
  };

  // Handle file input change
  const handleFileInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0 && onFileSelect) {
      onFileSelect(Array.from(files));
    }
    // Reset the input so the same file can be selected again
    event.target.value = '';
  };

  // Handle delete selected items
  const handleDeleteSelected = useCallback(() => {
    const selectedItemIds = Array.from(selectedFiles);
    if (selectedItemIds.length === 0) return;

    const selectedItems = allItems.filter(item => selectedItemIds.includes(item.id));
    setItemsToDelete(selectedItems);
    setBulkDeleteDialogOpen(true);
  }, [selectedFiles, allItems]);

  // Handle star selected items
  const handleStarSelected = useCallback(async () => {
    const selectedItemIds = Array.from(selectedFiles);
    if (selectedItemIds.length === 0) return;

    const selectedItems = allItems.filter(item => selectedItemIds.includes(item.id));
    const filesToStar = selectedItems.filter(item => isFile(item)) as UserFile[];
    const foldersToStar = selectedItems.filter(item => isFolder(item)) as Folder[];

    try {
      // Star files
      for (const file of filesToStar) {
        if (!file.is_starred) {
          await starFileMutation({
            variables: { id: file.id },
          });
        }
      }

      // Star folders
      for (const folder of foldersToStar) {
        if (!folder.is_starred) {
          await starFolderMutation({
            variables: { id: folder.id },
          });
        }
      }

      refetch();
      refetchFolders();
      const totalItems = filesToStar.length + foldersToStar.length;
      setSnackbarMessage(`Starred ${totalItems} item(s)`);
      setSnackbarOpen(true);
    } catch (error) {
      console.error('Error starring items:', error);
      setSnackbarMessage('Failed to star items');
      setSnackbarOpen(true);
    }
  }, [selectedFiles, allItems, starFileMutation, starFolderMutation, refetch, refetchFolders]);

  // Handle restore selected items
  const handleRestoreSelected = useCallback(async () => {
    const selectedItemIds = Array.from(selectedFiles);
    if (selectedItemIds.length === 0) return;

    const selectedItems = allItems.filter(item => selectedItemIds.includes(item.id));
    const filesToRestore = selectedItems.filter(item => isFile(item)) as UserFile[];
    const foldersToRestore = selectedItems.filter(item => !isFile(item)) as Folder[];

    try {
      // Restore files
      for (const file of filesToRestore) {
        await restoreFileMutation({
          variables: { fileID: file.id },
          refetchQueries: [{ query: GET_MY_FILES }, { query: GET_MY_TRASHED_FILES }, { query: GET_MY_STATS }],
        });
      }

      // Restore folders
      for (const folder of foldersToRestore) {
        await restoreFolderMutation({
          variables: { folderID: folder.id },
          refetchQueries: [
            { query: GET_MY_FOLDERS },
            { query: GET_MY_TRASHED_FOLDERS },
            { query: GET_MY_FILES },
            { query: GET_MY_TRASHED_FILES },
            { query: GET_MY_STATS }
          ],
        });
      }

      setSelectedFiles(new Set());
      refetch();
      if (onFileRestored) {
        onFileRestored();
      }
      const totalItems = filesToRestore.length + foldersToRestore.length;
      setSnackbarMessage(`Restored ${totalItems} item(s)`);
      setSnackbarOpen(true);
    } catch (error) {
      console.error('Error restoring items:', error);
      setSnackbarMessage('Failed to restore items');
      setSnackbarOpen(true);
    }
  }, [selectedFiles, allItems, restoreFileMutation, restoreFolderMutation, refetch, onFileRestored]);

  // Handle item selection (for both files and folders)
  const handleItemSelect = (itemId: string, event: React.MouseEvent, modifiers?: { ctrlKey: boolean; metaKey: boolean; shiftKey: boolean }) => {
    console.log('DEBUG: handleItemSelect called with itemId:', itemId, 'modifiers:', modifiers, 'selectedFiles before:', Array.from(selectedFiles));
    // Use captured modifiers if provided (for folders), otherwise use event properties (for files)
    const ctrlKey = modifiers?.ctrlKey ?? event.ctrlKey;
    const metaKey = modifiers?.metaKey ?? event.metaKey;
    const shiftKey = modifiers?.shiftKey ?? event.shiftKey;

    const itemIndex = allItems.findIndex(item => item.id === itemId);

    if (shiftKey) {
      if (selectionAnchor === -1 || selectedFiles.size === 0) {
        // If no anchor or no selection, set current as anchor and select it
        setSelectionAnchor(itemIndex);
        setSelectedFiles(new Set([itemId]));
      } else {
        // Select range from anchor to current
        selectRange(selectionAnchor, itemIndex);
      }
    } else if (ctrlKey || metaKey) {
      // Cmd/Ctrl selection: toggle individual items
      setSelectedFiles(prev => {
        const newSet = new Set(prev);
        if (newSet.has(itemId)) {
          newSet.delete(itemId);
          // If this was the only selected item, clear the anchor
          if (newSet.size === 0) {
            setSelectionAnchor(-1);
          }
        } else {
          newSet.add(itemId);
          // Set anchor to current item for future shift selections
          setSelectionAnchor(itemIndex);
        }
        return newSet;
      });
    } else {
      // Regular click - if already selected, deselect it; otherwise single selection
      console.log('DEBUG: Regular click - selectedFiles.has(itemId):', selectedFiles.has(itemId));
      if (selectedFiles.has(itemId)) {
        console.log('DEBUG: Deselecting item');
        setSelectedFiles(new Set());
        setSelectionAnchor(-1);
      } else {
        console.log('DEBUG: Selecting single item:', itemId);
        setSelectionAnchor(itemIndex);
        setSelectedFiles(new Set([itemId]));
      }
    }
  };

  // Context menu handlers
  const handleContextMenu = (event: React.MouseEvent, fileId: string) => {
    event.preventDefault();
    setContextMenu({
      mouseX: event.clientX - 2,
      mouseY: event.clientY - 4,
      fileId,
    });
  };


  const handleDeleteConfirm = useCallback(async () => {
    if (!fileToDelete) return;

    const success = await deleteFile(fileToDelete);
    if (success) {
      setDeleteDialogOpen(false);
      setFileToDelete(null);
      setSelectedFiles(prev => {
        const newSet = new Set(prev);
        newSet.delete(fileToDelete.id);
        return newSet;
      });

      refetch();
      refetchFolders();
      if (onFileDeleted) {
        onFileDeleted();
      }
    }
  }, [fileToDelete, deleteFile, refetch, refetchFolders, onFileDeleted]);

  const handleBulkDeleteConfirm = useCallback(async () => {
    if (itemsToDelete.length === 0) return;

    try {
      const filesToDelete = itemsToDelete.filter(item => isFile(item)) as UserFile[];
      const foldersToDelete = itemsToDelete.filter(item => isFolder(item)) as Folder[];

      // Delete files
      for (const file of filesToDelete) {
        const success = await deleteFile(file);
        if (!success) {
          throw new Error(`Failed to delete file: ${file.filename}`);
        }
      }

      // Delete folders (if supported)
      if (foldersToDelete.length > 0) {
        console.warn('Folder deletion not implemented for bulk operations');
      }

      // Clear selection and refresh
      setSelectedFiles(new Set());
      setBulkDeleteDialogOpen(false);
      setItemsToDelete([]);
      refetch();
      refetchFolders();
      if (onFileDeleted) {
        onFileDeleted();
      }
      setSnackbarMessage(`Deleted ${filesToDelete.length + foldersToDelete.length} item(s)`);
      setSnackbarOpen(true);
    } catch (error) {
      console.error('Error deleting selected items:', error);
      setSnackbarMessage('Failed to delete selected items');
      setSnackbarOpen(true);
      // Don't clear selection on error
    }
  }, [itemsToDelete, deleteFile, refetch, refetchFolders, onFileDeleted]);

  // Drag and drop handlers
  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(async (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragOver(false);

    const files = Array.from(event.dataTransfer.files) as File[];
    if (files.length > 0) {
      await handleFiles(files);
    }
  }, [handleFiles]);

  // Box selection handlers
  const [mouseDownPos, setMouseDownPos] = useState<{ x: number; y: number } | null>(null);

  const handleMouseDown = useCallback((event: React.MouseEvent) => {
    // Only start potential box selection if clicking on the container itself (empty space)
    // Check if we're clicking on the container or empty space
    const isContainer = event.target === event.currentTarget;
    const isEmptySpace = (event.target as HTMLElement).classList.contains('file-explorer-empty-space');
    const hasFileItem = (event.target as HTMLElement).closest('[data-file-item]');
    const hasButton = (event.target as HTMLElement).closest('button');
    const hasIconButton = (event.target as HTMLElement).closest('.MuiIconButton-root');

    // Only prepare for box selection if we're clicking on truly empty space
    if ((isContainer || isEmptySpace) && !hasFileItem && !hasButton && !hasIconButton) {
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        setMouseDownPos({ x, y });
      }
    }
  }, []);

  const handleMouseMove = useCallback((event: React.MouseEvent) => {
    if (mouseDownPos && !isBoxSelecting) {
      // Start box selection only if mouse has moved significantly
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
        const currentX = event.clientX - rect.left;
        const currentY = event.clientY - rect.top;
        const deltaX = Math.abs(currentX - mouseDownPos.x);
        const deltaY = Math.abs(currentY - mouseDownPos.y);

        // Only start box selection if moved more than 5 pixels
        if (deltaX > 5 || deltaY > 5) {
          setBoxSelectionStart(mouseDownPos);
          setBoxSelectionEnd({ x: currentX, y: currentY });
          setIsBoxSelecting(true);
        }
      }
    } else if (isBoxSelecting && boxSelectionStart) {
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        setBoxSelectionEnd({ x, y });
      }
    }
  }, [mouseDownPos, isBoxSelecting, boxSelectionStart]);

  const handleMouseUp = useCallback(() => {
    if (isBoxSelecting && boxSelectionStart && boxSelectionEnd) {
      // Calculate which items are within the selection box
      const selectedIds = new Set<string>();
      const containerRect = containerRef.current?.getBoundingClientRect();

      if (containerRect) {
        allItems.forEach((item, index) => {
          const itemElement = document.querySelector(`[data-file-item="${item.id}"]`) as HTMLElement;
          if (itemElement) {
            const itemRect = itemElement.getBoundingClientRect();
            const relativeRect = {
              left: itemRect.left - containerRect.left,
              top: itemRect.top - containerRect.top,
              right: itemRect.right - containerRect.left,
              bottom: itemRect.bottom - containerRect.top,
            };

            const boxLeft = Math.min(boxSelectionStart.x, boxSelectionEnd.x);
            const boxRight = Math.max(boxSelectionStart.x, boxSelectionEnd.x);
            const boxTop = Math.min(boxSelectionStart.y, boxSelectionEnd.y);
            const boxBottom = Math.max(boxSelectionStart.y, boxSelectionEnd.y);

            // Check if item intersects with selection box
            if (relativeRect.left < boxRight && relativeRect.right > boxLeft &&
                relativeRect.top < boxBottom && relativeRect.bottom > boxTop) {
              selectedIds.add(item.id);
            }
          }
        });
      }

      setSelectedFiles(selectedIds);
    }

    setIsBoxSelecting(false);
    setBoxSelectionStart(null);
    setBoxSelectionEnd(null);
    setMouseDownPos(null);
  }, [isBoxSelecting, boxSelectionStart, boxSelectionEnd, allItems]);



  // Handle file/folder move via drag and drop
  const handleFileMove = useCallback(async (itemIds: string[], targetFolderId: string | null) => {
    console.log('handleFileMove called with itemIds:', itemIds, 'targetFolderId:', targetFolderId);
    try {
      const allFiles = isStarredMode ? data?.myStarredFiles : data?.myFiles;
      const allFolders = isStarredMode ? foldersData?.myStarredFolders : foldersData?.myFolders;
      const allItems = [...(allFiles || []), ...(allFolders || [])];
      const itemsToMove = allItems.filter((item) => itemIds.includes(item.id));

      // Filter out items that are already in the target folder
      const itemsToActuallyMove = itemsToMove.filter((item) => {
        if (isFile(item)) {
          return item.folder_id !== targetFolderId;
        } else if (isFolder(item)) {
          return item.id !== targetFolderId && item.parent_id !== targetFolderId;
        }
        return false;
      });

      if (itemsToActuallyMove.length === 0) {
        console.log('Items are already in the target folder');
        return;
      }

      // Move each item
      for (const item of itemsToActuallyMove) {
        if (isFile(item)) {
          await moveFileMutation({
            variables: {
              input: {
                id: item.id,
                folder_id: targetFolderId,
              },
            },
          });
        } else if (isFolder(item)) {
          await moveFolderMutation({
            variables: {
              input: {
                id: item.id,
                parent_id: targetFolderId,
              },
            },
          });
        }
      }

      // Refetch data to update UI
      refetch();
      refetchFolders();

      if (onUploadComplete) {
        onUploadComplete();
      }
    } catch (error: any) {
      console.error('Error moving items:', error);
      // Note: The error state is managed by useFileOperations hook, but we could add a separate error state here
      // For now, we'll rely on the existing error display mechanism
    }
  }, [moveFileMutation, moveFolderMutation, data?.myFiles, foldersData?.myFolders, refetch, refetchFolders, onUploadComplete]);

  // Folder creation handlers
  const handleCreateFolderClick = useCallback(() => {
    setNewFolderName('');
    setFolderCreationError(null);
    setCreateFolderDialogOpen(true);
  }, []);

  const handleCreateFolderConfirm = useCallback(async () => {
    if (!newFolderName.trim()) {
      setFolderCreationError('Folder name cannot be empty');
      return;
    }

    // Check for duplicate folder names in current folder
    const isDuplicate = currentFolders.some((folder: Folder) =>
      folder.name.toLowerCase() === newFolderName.trim().toLowerCase()
    );

    if (isDuplicate) {
      setFolderCreationError('A folder with this name already exists');
      return;
    }

    try {
      await createFolderMutation({
        variables: {
          input: {
            name: newFolderName.trim(),
            parent_id: folderId || undefined,
          },
        },
      });

      // Close dialog and reset state
      setCreateFolderDialogOpen(false);
      setNewFolderName('');
      setFolderCreationError(null);

      // Refetch data to update UI
      refetch();
      refetchFolders();

      if (onUploadComplete) {
        onUploadComplete();
      }
    } catch (error: any) {
      console.error('Error creating folder:', error);
      setFolderCreationError(error.message || 'Failed to create folder');
    }
  }, [newFolderName, currentFolders, folderId, createFolderMutation, refetch, refetchFolders, onUploadComplete]);

  const handleCreateFolderCancel = useCallback(() => {
     setCreateFolderDialogOpen(false);
     setNewFolderName('');
     setFolderCreationError(null);
   }, []);

  // Keyboard navigation and shortcuts
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    console.log('DEBUG: handleKeyDown called with key:', event.key, 'ctrlKey:', event.ctrlKey, 'metaKey:', event.metaKey);
    
    const { key, ctrlKey, metaKey, shiftKey } = event;
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const cmdOrCtrl = (isMac ? metaKey : ctrlKey) || (ctrlKey || metaKey); // Support both Ctrl and Cmd on all platforms
    
    console.log('DEBUG: isMac:', isMac, 'cmdOrCtrl:', cmdOrCtrl);

    // Prevent default browser shortcuts
    if (cmdOrCtrl && (key === 'n' || key === 'x' || key === 'v')) {
      event.preventDefault();
      console.log('DEBUG: Prevented default for shortcut:', key);
    }

    switch (key) {
      case 'ArrowUp':
      case 'ArrowDown':
      case 'ArrowLeft':
      case 'ArrowRight':
        event.preventDefault();
        handleArrowNavigation(key, shiftKey);
        break;
      case 'Enter':
        event.preventDefault();
        handleEnterKey();
        break;
      case 'F2':
        event.preventDefault();
        handleRenameKey();
        break;
      case 'Delete':
      case 'Backspace':
        event.preventDefault();
        console.log('DEBUG: Delete shortcut triggered');
        handleDeleteKey();
        break;
      case 'n':
      case 'N':
        if (cmdOrCtrl) {
          event.preventDefault();
          handleCreateFolderClick();
          setSnackbarMessage('Create folder shortcut used');
          setSnackbarOpen(true);
        }
        break;
      case 'x':
      case 'X':
        if (cmdOrCtrl) {
          event.preventDefault();
          console.log('DEBUG: Cut shortcut triggered');
          handleCutKey();
        }
        break;
      case 'c':
      case 'C':
        if (cmdOrCtrl) {
          event.preventDefault();
          console.log('DEBUG: Copy shortcut triggered');
          handleCopyKey();
        }
        break;
      case 'v':
      case 'V':
        if (cmdOrCtrl) {
          console.log('DEBUG: Paste shortcut triggered');
          // Don't prevent default for paste - let the browser handle it naturally
          // This allows handlePasteEvent to receive actual files from clipboardData
          // Only handle our internal cut/copy operations manually
          if (cutItems.size > 0 || copiedItems.size > 0) {
            event.preventDefault();
            handlePasteKey();
          }
          // If no internal items to paste, let browser handle the paste event naturally
        }
        break;
      case 's':
      case 'S':
        if (cmdOrCtrl && shiftKey) {
          event.preventDefault();
          handleStarSelected();
          setSnackbarMessage('Star toggle shortcut used');
          setSnackbarOpen(true);
        }
        break;
    }
  }, [
    focusedIndex,
    selectedFiles,
    cutItems,
    copiedItems,
    allItems,
    handleCreateFolderClick,
    handleStarSelected,
    setSnackbarMessage,
    setSnackbarOpen,
  ]);

  const handleArrowNavigation = useCallback((direction: string, shiftKey: boolean) => {
    if (allItems.length === 0) return;

    let newIndex = focusedIndex;

    // Calculate grid dimensions (assuming responsive grid)
    const itemsPerRow = Math.floor(800 / 140) || 1; // Approximate based on FileGrid

    switch (direction) {
      case 'ArrowUp':
        newIndex = Math.max(0, focusedIndex - itemsPerRow);
        break;
      case 'ArrowDown':
        newIndex = Math.min(allItems.length - 1, focusedIndex + itemsPerRow);
        break;
      case 'ArrowLeft':
        newIndex = Math.max(0, focusedIndex - 1);
        break;
      case 'ArrowRight':
        newIndex = Math.min(allItems.length - 1, focusedIndex + 1);
        break;
    }

    setFocusedIndex(newIndex);

    if (shiftKey) {
      if (selectionAnchor === -1) {
        // If no anchor, set current focused index as anchor
        setSelectionAnchor(focusedIndex >= 0 ? focusedIndex : newIndex);
        setSelectedFiles(new Set([allItems[newIndex].id]));
      } else {
        // Select range from anchor to new index
        selectRange(selectionAnchor, newIndex);
      }
    } else {
      setSelectionAnchor(newIndex);
      setSelectedFiles(new Set([allItems[newIndex].id]));
    }
  }, [allItems, focusedIndex, selectionAnchor, selectRange]);

  const handleEnterKey = useCallback(() => {
    if (focusedIndex >= 0 && focusedIndex < allItems.length) {
      const item = allItems[focusedIndex];
      if (isFolder(item) && onFolderClick) {
        onFolderClick(item.id, item.name);
      } else if (isFile(item)) {
        // For files, just select it (could be extended to open/download)
        setSelectedFiles(new Set([item.id]));
      }
    }
  }, [allItems, focusedIndex, onFolderClick]);

  const handleRenameKey = useCallback(() => {
    const selectedItemIds = Array.from(selectedFiles);
    if (selectedItemIds.length === 1) {
      const item = allItems.find(i => i.id === selectedItemIds[0]);
      if (item) {
        setRenameItem(item);
        setNewItemName(isFolder(item) ? item.name : (item as UserFile).filename);
        setRenameError(null);
        setRenameDialogOpen(true);
      }
    }
  }, [selectedFiles, allItems]);

  const handleDeleteKey = useCallback(() => {
    const selectedItemIds = Array.from(selectedFiles);
    if (selectedItemIds.length === 0) return;

    if (selectedItemIds.length === 1) {
      // Single item deletion - show appropriate dialog
      const item = allItems.find(i => i.id === selectedItemIds[0]);
      if (item) {
        if (isFile(item)) {
          handleDeleteClick(item as UserFile);
        } else if (isFolder(item)) {
          setFolderToDelete(item as Folder);
          setFolderDeleteDialogOpen(true);
        }
      }
    } else {
      // Multiple items - use bulk delete
      handleDeleteSelected();
    }
  }, [selectedFiles, allItems, handleDeleteClick, handleDeleteSelected]);

  const handleCutKey = useCallback(() => {
    const selectedItemIds = Array.from(selectedFiles);
    console.log('DEBUG: handleCutKey called with selectedFiles:', selectedItemIds);
    if (selectedItemIds.length > 0) {
      console.log('DEBUG: Setting cutItems to:', selectedItemIds);
      const newCutItems = new Set(selectedItemIds);
      setCutItems(newCutItems);
      localStorage.setItem('fileExplorerCutItems', JSON.stringify(Array.from(newCutItems)));
      setCopiedItems(new Set()); // Clear copied items when cutting
      localStorage.setItem('fileExplorerCopiedItems', JSON.stringify([]));
      setSelectedFiles(new Set()); // Clear selection after cutting
      setSnackbarMessage(`${selectedItemIds.length} item(s) cut`);
      setSnackbarOpen(true);
      console.log('DEBUG: After cut - cutItems.size:', newCutItems.size, 'canPaste should be:', newCutItems.size > 0);
    } else {
      console.log('DEBUG: No items selected for cutting');
    }
  }, [selectedFiles]);

  // Handle cut operation
  const handleCut = useCallback(() => {
    console.log('DEBUG: handleCut called from toolbar button, selectedFiles.size:', selectedFiles.size, 'selectedFiles:', Array.from(selectedFiles));
    if (selectedFiles.size > 0) {
      console.log('DEBUG: About to call handleCutKey from handleCut');
      handleCutKey();
    } else {
      console.log('DEBUG: No files selected, cannot cut');
    }
  }, [selectedFiles, handleCutKey]);

  const handleCopyKey = useCallback(() => {
    const selectedItemIds = Array.from(selectedFiles);
    if (selectedItemIds.length > 0) {
      const newCopiedItems = new Set(selectedItemIds);
      setCopiedItems(newCopiedItems);
      localStorage.setItem('fileExplorerCopiedItems', JSON.stringify(Array.from(newCopiedItems)));
      setCutItems(new Set()); // Clear cut items when copying
      localStorage.setItem('fileExplorerCutItems', JSON.stringify([]));
      setSnackbarMessage(`${selectedItemIds.length} item(s) copied`);
      setSnackbarOpen(true);
    }
  }, [selectedFiles]);

  const handlePasteKey = useCallback(async () => {
    console.log('DEBUG: handlePasteKey called');
    console.log('DEBUG: cutItems size:', cutItems.size, 'cutItems:', Array.from(cutItems));
    console.log('DEBUG: copiedItems size:', copiedItems.size, 'copiedItems:', Array.from(copiedItems));
    console.log('DEBUG: current folderId:', folderId);
    console.log('DEBUG: allAvailableItems count:', allAvailableItems.length);
    console.log('DEBUG: canPaste calculation:', cutItems.size > 0 || copiedItems.size > 0);

    // Handle cut items (move operation)
    if (cutItems.size > 0) {
      try {
        const cutItemIds = Array.from(cutItems);
        console.log('DEBUG: Processing cut items:', cutItemIds);

        for (const itemId of cutItemIds) {
          const item = allAvailableItems.find(i => i.id === itemId);
          console.log('DEBUG: Looking for itemId:', itemId, 'found:', !!item);
          if (!item) {
            console.log('DEBUG: Item not found in allAvailableItems, skipping:', itemId);
            continue;
          }

          if (isFile(item)) {
            console.log('DEBUG: Moving file:', item.filename);
            await moveFileMutation({
              variables: {
                input: {
                  id: item.id,
                  folder_id: folderId,
                },
              },
            });
          } else if (isFolder(item)) {
            console.log('DEBUG: Moving folder:', item.name);
            await moveFolderMutation({
              variables: {
                input: {
                  id: item.id,
                  parent_id: folderId,
                },
              },
            });
          }
        }

        setCutItems(new Set());
        localStorage.setItem('fileExplorerCutItems', JSON.stringify([]));
        refetch();
        refetchFolders();
        setSnackbarMessage(`${cutItemIds.length} item(s) moved`);
        setSnackbarOpen(true);

        if (onUploadComplete) {
          onUploadComplete();
        }
        return;
      } catch (error: any) {
        console.error('Error moving items:', error);
        setSnackbarMessage('Error moving items');
        setSnackbarOpen(true);
        return;
      }
    }

    // Handle copied items (copy operation)
    if (copiedItems.size > 0) {
      console.log('DEBUG: Copy functionality not implemented, showing message');
      setSnackbarMessage('Copy functionality requires backend API implementation. Only cut/paste (move) is currently supported.');
      setSnackbarOpen(true);
      // Clear copied items since paste was attempted
      setCopiedItems(new Set());
      localStorage.setItem('fileExplorerCopiedItems', JSON.stringify([]));
      return;
    }

    // No internal items to paste - this function only handles internal cut/copy operations
    // External file pasting is handled by handlePasteEvent
    console.log('DEBUG: No internal items to paste - cutItems.size:', cutItems.size, 'copiedItems.size:', copiedItems.size);
    setSnackbarMessage('No files or folders to paste');
    setSnackbarOpen(true);
  }, [
    cutItems,
    copiedItems,
    allAvailableItems,
    folderId,
    moveFileMutation,
    moveFolderMutation,
    refetch,
    refetchFolders,
    onUploadComplete,
    handleFiles
  ]);

  const handleDeleteFolder = useCallback(async (folder: Folder) => {
    setFolderToDelete(folder);
    setFolderDeleteDialogOpen(true);
  }, []);

  const handleDeleteFolderConfirm = useCallback(async () => {
    if (!folderToDelete) return;

    try {
      if (isTrashMode) {
        // In trash mode, permanently delete the folder
        await permanentlyDeleteFolderMutation({
          variables: { folderID: folderToDelete.id },
          refetchQueries: [
            { query: GET_MY_TRASHED_FOLDERS },
            { query: GET_MY_TRASHED_FILES }
          ],
        });
      } else {
        // In regular mode, move folder to trash
        await deleteFolderMutation({
          variables: { id: folderToDelete.id },
        });
        refetchFolders();
      }
      
      refetch();
      setSelectedFiles(prev => {
        const newSet = new Set(prev);
        newSet.delete(folderToDelete.id);
        return newSet;
      });
      if (onFileDeleted) {
        onFileDeleted();
      }
      setFolderDeleteDialogOpen(false);
      setFolderToDelete(null);
    } catch (error: any) {
      console.error('Error deleting folder:', error);
      setSnackbarMessage('Error deleting folder');
      setSnackbarOpen(true);
    }
  }, [folderToDelete, deleteFolderMutation, permanentlyDeleteFolderMutation, isTrashMode, refetch, refetchFolders, onFileDeleted]);

  // Trash-specific handlers
  const handleRestoreClick = useCallback((item: FileExplorerItem) => {
    if (isFile(item)) {
      setFileToRestore(item as UserFile);
      setRestoreDialogOpen(true);
    } else {
      setFolderToRestore(item as Folder);
      setFolderRestoreDialogOpen(true);
    }
  }, []);

  const handlePermanentDeleteClick = useCallback((item: FileExplorerItem) => {
    if (isFile(item)) {
      setFileToDelete(item as UserFile);
      setDeleteDialogOpen(true);
    } else {
      // For folders in trash mode, we want permanent deletion
      setFolderToDelete(item as Folder);
      setFolderDeleteDialogOpen(true);
    }
  }, []);

  const handleRestoreConfirm = useCallback(async () => {
    if (!fileToRestore) return;

    try {
      console.log('DEBUG: Starting file restore for:', fileToRestore.filename);
      await restoreFileMutation({
        variables: { fileID: fileToRestore.id },
        refetchQueries: [{ query: GET_MY_FILES }, { query: GET_MY_TRASHED_FILES }, { query: GET_MY_STATS }],
      });

      setRestoreDialogOpen(false);
      setFileToRestore(null);

      // Refetch files or call callback
      refetch();
      if (onFileRestored) {
        onFileRestored();
      }
      console.log('DEBUG: File restore completed successfully');
    } catch (err: any) {
      console.error('Restore error:', err);
      console.log('DEBUG: Restore failed with error:', err.graphQLErrors?.[0]?.message || err.message);
      // TODO: Add proper error state handling
      setSnackbarMessage('Failed to restore file');
      setSnackbarOpen(true);
    }
  }, [fileToRestore, restoreFileMutation, refetch, onFileRestored]);

  const handleFolderRestoreConfirm = useCallback(async () => {
    if (!folderToRestore) return;

    try {
      console.log('DEBUG: Starting folder restore for:', folderToRestore.name);
      await restoreFolderMutation({
        variables: { folderID: folderToRestore.id },
        refetchQueries: [
          { query: GET_MY_FOLDERS },
          { query: GET_MY_TRASHED_FOLDERS },
          { query: GET_MY_FILES },
          { query: GET_MY_TRASHED_FILES },
          { query: GET_MY_STATS }
        ],
      });

      setFolderRestoreDialogOpen(false);
      setFolderToRestore(null);

      // Refetch files or call callback
      refetch();
      if (onFileRestored) {
        onFileRestored();
      }
      console.log('DEBUG: Folder restore completed successfully');
    } catch (err: any) {
      console.error('Folder restore error:', err);
      console.log('DEBUG: Folder restore failed with error:', err.graphQLErrors?.[0]?.message || err.message);
      setSnackbarMessage('Failed to restore folder');
      setSnackbarOpen(true);
    }
  }, [folderToRestore, restoreFolderMutation, refetch, onFileRestored]);

  const handlePermanentDeleteConfirm = useCallback(async () => {
    if (!fileToDelete) return;

    try {
      console.log('DEBUG: Starting permanent delete for:', fileToDelete.filename);
      await permanentlyDeleteFileMutation({
        variables: { fileID: fileToDelete.id },
        refetchQueries: [{ query: GET_MY_TRASHED_FILES }],
      });

      setDeleteDialogOpen(false);
      setFileToDelete(null);

      // Refetch files or call callback
      refetch();
      if (onFileDeleted) {
        onFileDeleted();
      }
      console.log('DEBUG: Permanent delete completed successfully');
    } catch (err: any) {
      console.error('Permanent delete error:', err);
      console.log('DEBUG: Permanent delete failed with error:', err.graphQLErrors?.[0]?.message || err.message);
      setSnackbarMessage('Failed to permanently delete file');
      setSnackbarOpen(true);
    }
  }, [fileToDelete, permanentlyDeleteFileMutation, refetch, onFileDeleted]);

  const handleEmptyTrashConfirm = useCallback(async () => {
    const trashedFiles = data?.myTrashedFiles || [];
    if (trashedFiles.length === 0) return;

    try {
      console.log('DEBUG: Starting empty trash operation for', trashedFiles.length, 'files');
      // Permanently delete all files in trash
      for (const file of trashedFiles) {
        await permanentlyDeleteFileMutation({
          variables: { fileID: file.id },
          refetchQueries: [{ query: GET_MY_TRASHED_FILES }],
        });
      }

      setEmptyTrashDialogOpen(false);
      refetch();
      if (onFileDeleted) {
        onFileDeleted();
      }
      setSnackbarMessage(`Permanently deleted ${trashedFiles.length} file(s) from trash`);
      setSnackbarOpen(true);
      console.log('DEBUG: Empty trash completed successfully');
    } catch (err: any) {
      console.error('Empty trash error:', err);
      console.log('DEBUG: Empty trash failed with error:', err.graphQLErrors?.[0]?.message || err.message);
      setSnackbarMessage('Failed to empty trash');
      setSnackbarOpen(true);
    }
  }, [data?.myTrashedFiles, permanentlyDeleteFileMutation, refetch, onFileDeleted]);

  // Rename handlers
  const handleRenameConfirm = useCallback(async () => {
    if (!renameItem || !newItemName.trim()) {
      setRenameError('Name cannot be empty');
      return;
    }

    try {
      if (isFolder(renameItem)) {
        await renameFolderMutation({
          variables: {
            input: {
              id: renameItem.id,
              name: newItemName.trim(),
            },
          },
        });
      } else if (isFile(renameItem)) {
        // Note: File rename might need a separate mutation, using move for now
        // This is a placeholder - you might need to add a rename file mutation
        console.log('File rename not implemented yet');
        setRenameError('File rename not implemented');
        return;
      }

      setRenameDialogOpen(false);
      setRenameItem(null);
      setNewItemName('');
      setRenameError(null);
      refetch();
      refetchFolders();
      setSnackbarMessage('Item renamed successfully');
      setSnackbarOpen(true);
    } catch (error: any) {
      console.error('Error renaming item:', error);
      setRenameError(error.message || 'Failed to rename item');
    }
  }, [renameItem, newItemName, renameFolderMutation, refetch, refetchFolders]);

  const handleRenameCancel = useCallback(() => {
    setRenameDialogOpen(false);
    setRenameItem(null);
    setNewItemName('');
    setRenameError(null);
  }, []);

  // Handle paste event for files from clipboard
  const handlePasteEvent = useCallback(async (event: ClipboardEvent) => {
    event.preventDefault();

    if (event.clipboardData && event.clipboardData.files.length > 0) {
      const files = Array.from(event.clipboardData.files) as File[];
      if (files.length > 0) {
        console.log('DEBUG: Pasting files from clipboard:', files.length);
        setSnackbarMessage(`Uploading ${files.length} file(s) from clipboard...`);
        setSnackbarOpen(true);
        await handleFiles(files);
      }
    }
  }, [handleFiles]);

  // Add keyboard and paste event listeners
  useEffect(() => {
    const handleGlobalKeyDown = (event: KeyboardEvent) => {
      // Only handle keyboard shortcuts if the file explorer is focused or has selection
      const container = containerRef.current;
      const hasSelection = selectedFiles.size > 0;
      const isFocused = container && document.activeElement === container;
      const isInFileExplorer = container && container.contains(document.activeElement);
      
      // Handle keyboard shortcuts if file explorer is active
      if (hasSelection || isFocused || isInFileExplorer) {
        handleKeyDown(event);
      }
    };

    const handleGlobalPaste = (event: ClipboardEvent) => {
      // Only handle paste if the file explorer is focused
      const container = containerRef.current;
      const isFocused = container && document.activeElement === container;
      const isInFileExplorer = container && container.contains(document.activeElement);
      
      if (isFocused || isInFileExplorer) {
        handlePasteEvent(event);
      }
    };

    // Attach to document to catch all keyboard events
    document.addEventListener('keydown', handleGlobalKeyDown);
    document.addEventListener('paste', handleGlobalPaste);
    
    return () => {
      document.removeEventListener('keydown', handleGlobalKeyDown);
      document.removeEventListener('paste', handleGlobalPaste);
    };
  }, [handleKeyDown, handlePasteEvent, selectedFiles]);

  // Focus container when component mounts
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.focus();
    }
  }, []);

  // Focus container when navigating to a different folder
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.focus();
    }
  }, [folderId]);

  // Handle clicks outside the file explorer to clear selection
  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setSelectedFiles(new Set());
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, []);

  // Notify parent component of selection changes
  useEffect(() => {
    if (onSelectionChange) {
      onSelectionChange(selectedFiles.size);
    }
  }, [selectedFiles.size, onSelectionChange]);

  // Memoized toggle sort direction handler
  const handleToggleSortDirection = useCallback(() => {
    setFileSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
  }, []);

  // Determine if drag and drop should be enabled
  const isDragDropEnabled = !isTrashMode && !isStarredMode && (allItems.length > 0 || uploads.length > 0 || !searchQuery);

  // Memoized toolbar props to prevent unnecessary re-renders
  const normalToolbarProps = useMemo(() => {
    const canPasteValue = cutItems.size > 0 || copiedItems.size > 0;
    const hasSelection = selectedFiles.size > 0;
    const selectedItems = allItems.filter(item => selectedFiles.has(item.id));
    const hasFiles = selectedItems.some(item => isFile(item));

    return {
      searchQuery,
      sortBy: fileSortBy,
      sortDirection: fileSortOrder,
      onSearchChange: setSearchQuery,
      onSortChange: setFileSortBy,
      onToggleSortDirection: handleToggleSortDirection,
      onCut: handleCut,
      onPaste: handlePasteKey,
      onDelete: handleDeleteSelected,
      onStar: handleStarSelected,
      canCut: hasSelection,
      canPaste: canPasteValue,
      canDelete: hasSelection,
      canStar: hasSelection && hasFiles,
      cutItemsCount: selectedFiles.size,
    };
  }, [searchQuery, fileSortBy, fileSortOrder, setSearchQuery, setFileSortBy, handleToggleSortDirection, handleCut, handlePasteKey, handleDeleteSelected, handleStarSelected, cutItems.size, copiedItems.size, selectedFiles.size, allItems, selectedFiles]);

  const trashToolbarProps = useMemo(() => {
    const hasSelection = selectedFiles.size > 0;
    const selectedItems = allItems.filter(item => selectedFiles.has(item.id));
    const hasFiles = selectedItems.some(item => isFile(item));

    return {
      searchQuery,
      sortBy: fileSortBy,
      sortDirection: fileSortOrder,
      onSearchChange: setSearchQuery,
      onSortChange: setFileSortBy,
      onToggleSortDirection: handleToggleSortDirection,
      onDelete: handleDeleteSelected,
      onRestore: handleRestoreSelected,
      canDelete: hasSelection,
      canRestore: hasSelection && hasFiles,
      cutItemsCount: selectedFiles.size,
    };
  }, [searchQuery, fileSortBy, fileSortOrder, setSearchQuery, setFileSortBy, handleToggleSortDirection, handleDeleteSelected, handleRestoreSelected, selectedFiles.size, allItems, selectedFiles]);





  if (queryError) {
    return (
      <Alert severity="error">
        Failed to load files: {queryError.message}
      </Alert>
    );
  }

  const files = filteredFiles;

  // Determine default title if not provided
  const defaultTitle = folderId ? 'Folder Files' : 'My Files';
  const displayTitle = title || defaultTitle;
  const displayDescription = description || (folderId ? 'Files in selected folder' : 'Manage your secure encrypted files');

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header Section */}
      {showHeader && (
        <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 600, color: '#1f2937' }}>
              {displayTitle}
            </Typography>
            <Typography variant="body2" color="#6b7280">
              {displayDescription}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            {isTrashMode && allItems.length > 0 && (
              <Button
                variant="outlined"
                color="error"
                size="small"
                onClick={() => setEmptyTrashDialogOpen(true)}
                startIcon={<DeleteForeverIcon />}
              >
                Empty Trash
              </Button>
            )}
            {selectedFiles.size > 0 && (
              <Typography variant="body2" sx={{ color: '#3b82f6', fontWeight: 500 }}>
                {selectedFiles.size} item{selectedFiles.size !== 1 ? 's' : ''} selected
              </Typography>
            )}
            <ToggleButtonGroup
              value={viewMode}
              exclusive
              onChange={(_, newMode) => {
                if (newMode && onViewModeChange) {
                  onViewModeChange(newMode);
                }
              }}
              size="small"
            >
              <ToggleButton value="list">
                <ListIcon fontSize="small" />
              </ToggleButton>
              <ToggleButton value="tile">
                <GridIcon fontSize="small" />
              </ToggleButton>
            </ToggleButtonGroup>
          </Box>
        </Box>
      )}

      {/* Navigation and Actions Row */}
      {(showBreadcrumbs && folderPath.length > 0) || showNewFolderButton ? (
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          {/* Back Navigation and Breadcrumbs */}
          {showBreadcrumbs && folderPath.length > 0 ? (
            <>
              {canNavigateBack && onNavigateBack && (
                <IconButton
                  onClick={onNavigateBack}
                  disabled={!canNavigateBack}
                  sx={{ mr: 1 }}
                  size="small"
                >
                  <ArrowBackIcon />
                </IconButton>
              )}
              <Breadcrumbs
                separator={<ChevronRightIcon fontSize="small" />}
                sx={{ flexGrow: 1 }}
              >
                {folderPath.map((pathItem, index) => (
                  <Link
                    key={pathItem.id || 'root'}
                    color={index === folderPath.length - 1 ? 'text.primary' : 'primary'}
                    component="button"
                    variant="body2"
                    onClick={() => onBreadcrumbClick?.(index)}
                    sx={{
                      textDecoration: 'none',
                      '&:hover': {
                        textDecoration: index === folderPath.length - 1 ? 'none' : 'underline',
                      },
                      cursor: index === folderPath.length - 1 ? 'default' : 'pointer',
                      border: 'none',
                      background: 'none',
                      padding: 0,
                      font: 'inherit',
                    }}
                  >
                    {pathItem.name}
                  </Link>
                ))}
              </Breadcrumbs>
            </>
          ) : (
            showBreadcrumbs && (
              <Breadcrumbs sx={{ flexGrow: 1 }}>
                <Typography
                  color="primary"
                  variant="body1"
                  sx={{
                    fontWeight: 500,
                  }}
                >
                  Home
                </Typography>
              </Breadcrumbs>
            )
          )}
          {showNewFolderButton && onCreateFolder && !isTrashMode && !isStarredMode && (
            <Button
              variant="contained"
              startIcon={<CreateNewFolderIcon />}
              onClick={onCreateFolder}
              size="small"
              sx={{ ml: 2 }}
            >
              New Folder
            </Button>
          )}
        </Box>
      ) : null}

      {/* Toolbar */}
      {isTrashMode ? (
        <FileToolbar {...trashToolbarProps} />
      ) : (
        <FileToolbar {...normalToolbarProps} />
      )}


      {/* File Explorer Area */}
      <Paper
        ref={containerRef}
        tabIndex={0}
        className="file-explorer-container"
        sx={{
          flex: 1,
          p: 2,
          border: isDragDropEnabled ? '2px dashed' : 'none',
          borderColor: isDragOver ? 'primary.main' : 'transparent',
          backgroundColor: isDragOver ? 'action.hover' : 'background.paper',
          cursor: isBoxSelecting ? 'crosshair' : 'default',
          transition: 'all 0.2s ease-in-out',
          minHeight: 400,
          position: 'relative',
          overflow: 'hidden',
          '&:focus': {
            outline: 'none',
          },
          userSelect: 'none', // Prevent text selection during box selection
        }}
        onClick={(e) => {
          // Focus the container when clicked
          if (containerRef.current) {
            containerRef.current.focus();
          }
          
          // Only clear selection if clicking on empty space
          const hasFileItem = (e.target as HTMLElement).closest('[data-file-item]');
          const hasButton = (e.target as HTMLElement).closest('button');
          const hasIconButton = (e.target as HTMLElement).closest('.MuiIconButton-root');

          if (!hasFileItem && !hasButton && !hasIconButton) {
            setSelectedFiles(new Set());
            // Trigger file selection if available
            if (onFileSelect && fileInputRef.current) {
              fileInputRef.current.click();
            }
          }
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        {...(isDragDropEnabled && {
          onDragOver: handleDragOver,
          onDragLeave: handleDragLeave,
          onDrop: handleDrop,
        })}
      >
        {allItems.length === 0 && uploads.length === 0 ? (
          searchQuery ? (
            // No search results
            <Box
              display="flex"
              flexDirection="column"
              alignItems="center"
              justifyContent="center"
              sx={{ height: '100%', minHeight: 300 }}
            >
              <SearchIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
              <Typography variant="h6" gutterBottom>
                No files found
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Try adjusting your search terms
              </Typography>
            </Box>
          ) : isStarredMode ? (
            // Starred empty state
            <Box
              display="flex"
              flexDirection="column"
              alignItems="center"
              justifyContent="center"
              sx={{ height: '100%', minHeight: 300 }}
            >
              <StarIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
              <Typography variant="h6" gutterBottom>
                No starred files
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Your starred files and folders will appear here
              </Typography>
            </Box>
          ) : isTrashMode ? (
            // Trash empty state
            <Box
              display="flex"
              flexDirection="column"
              alignItems="center"
              justifyContent="center"
              sx={{ height: '100%', minHeight: 300 }}
            >
              <DeleteForeverIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
              <Typography variant="h6" gutterBottom>
                Trash is empty
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Deleted files will appear here
              </Typography>
            </Box>
          ) : (
            // Normal empty state with drag and drop
            <Box
              className="file-explorer-empty-space"
              display="flex"
              flexDirection="column"
              alignItems="center"
              justifyContent="center"
              sx={{ height: '100%', minHeight: 300 }}
            >
              <CloudUploadIcon sx={{ fontSize: 64, color: 'primary.main', mb: 2 }} />
              <Typography variant="h6" gutterBottom>
                Drop files here to upload
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Your files will appear here once uploaded
              </Typography>
            </Box>
          )
        ) : (
          <div className="file-explorer-grid-container" style={{ 
            width: '100%', 
            height: '100%', 
            minHeight: '400px',
            display: 'flex',
            flexDirection: 'column'
          }}>
            {viewMode === 'tile' ? (
              <FileGrid
                files={allItems}
                selectedFiles={selectedFiles}
                downloadingFile={downloadingFile}
                focusedIndex={focusedIndex}
                onFileClick={handleFileClick}
                onContextMenu={handleContextMenu}
                onDownload={handleDownload}
                onDelete={handleDeleteClick}
                onRestore={isTrashMode ? handleRestoreClick : undefined}
                onFolderClick={onFolderClick}
                onFileMove={handleFileMove}
                onItemSelect={handleItemSelect}
              />
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {allItems.map((item, index) => (
                  <FileListItem
                    key={`${isFile(item) ? 'file' : 'folder'}-${item.id}`}
                    item={item}
                    isSelected={selectedFiles.has(item.id)}
                    isDownloading={downloadingFile === item.id}
                    selectedFileIds={Array.from(selectedFiles)}
                    onClick={(e) => handleFileClick(item.id, e)}
                    onContextMenu={(e) => handleContextMenu(e, item.id)}
                    onDownload={() => isFile(item) ? handleDownload(item) : undefined}
                    onDelete={() => isFile(item) ? handleDeleteClick(item) : undefined}
                    onRestore={() => isTrashMode ? handleRestoreClick(item) : undefined}
                    onFolderClick={() => isFolder(item) ? onFolderClick?.(item.id, item.name) : undefined}
                    onStarToggle={() => handleStarToggle(item)}
                    onFileMove={handleFileMove}
                    onItemSelect={handleItemSelect}
                  />
                ))}
              </Box>
            )}
          </div>
        )}
        {boxSelectionStart && boxSelectionEnd && (
          <Box
            sx={{
              position: 'absolute',
              border: '1px solid #90caf9',
              backgroundColor: 'rgba(144, 202, 249, 0.2)',
              left: Math.min(boxSelectionStart.x, boxSelectionEnd.x),
              top: Math.min(boxSelectionStart.y, boxSelectionEnd.y),
              width: Math.abs(boxSelectionStart.x - boxSelectionEnd.x),
              height: Math.abs(boxSelectionStart.y - boxSelectionEnd.y),
              pointerEvents: 'none',
            }}
          />
        )}
      </Paper>

      {/* Hidden file input */}
      {onFileSelect && (
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileInputChange}
          multiple
          style={{ display: 'none' }}
          accept="*/*"
        />
      )}

      {/* Upload Progress */}
      {uploads.length > 0 && (
        <UploadProgress uploads={uploads} onRemoveUpload={removeUpload} onClearCompleted={clearCompleted} />
      )}

      {/* Context Menu */}
      <Menu
        open={contextMenu !== null}
        onClose={() => setContextMenu(null)}
        anchorReference="anchorPosition"
        anchorPosition={
          contextMenu !== null
            ? { top: contextMenu.mouseY, left: contextMenu.mouseX }
            : undefined
        }
      >
        {isTrashMode ? (
          // Trash-specific context menu
          <>
            <MenuItem onClick={() => {
              const item = allItems.find(i => i.id === contextMenu?.fileId);
              if (item) handleRestoreClick(item);
              setContextMenu(null);
            }}>
              <RestoreIcon sx={{ mr: 1 }} /> Restore
            </MenuItem>
            <MenuItem onClick={() => {
              const item = allItems.find(i => i.id === contextMenu?.fileId);
              if (item) handlePermanentDeleteClick(item);
              setContextMenu(null);
            }}>
              <DeleteForeverIcon sx={{ mr: 1 }} /> Delete Permanently
            </MenuItem>
          </>
        ) : (
          // Normal context menu
          <>
            <MenuItem onClick={() => {
              const file = files.find((f: UserFile) => f.id === contextMenu?.fileId);
              if (file) handleDownload(file);
              setContextMenu(null);
            }}>
              <DownloadIcon sx={{ mr: 1 }} /> Download
            </MenuItem>
            <MenuItem onClick={() => {
              const item = allItems.find(i => i.id === contextMenu?.fileId);
              if (item) {
                setRenameItem(item);
                setNewItemName(isFolder(item) ? item.name : (item as UserFile).filename);
                setRenameError(null);
                setRenameDialogOpen(true);
              }
              setContextMenu(null);
            }}>
              <EditIcon sx={{ mr: 1 }} /> Rename
            </MenuItem>
            <MenuItem onClick={() => {
              const file = files.find((f: UserFile) => f.id === contextMenu?.fileId);
              if (file) {
                setFileToShare(file);
                setShareDialogOpen(true);
              }
              setContextMenu(null);
            }}>
              <ShareIcon sx={{ mr: 1 }} /> Share
            </MenuItem>
            <MenuItem onClick={() => {
              const item = allItems.find(i => i.id === contextMenu?.fileId);
              if (item) handleStarToggle(item);
              setContextMenu(null);
            }}>
              {allItems.find(i => i.id === contextMenu?.fileId)?.is_starred ? <StarBorderIcon sx={{ mr: 1 }} /> : <StarIcon sx={{ mr: 1 }} />}
              {allItems.find(i => i.id === contextMenu?.fileId)?.is_starred ? 'Unstar' : 'Star'}
            </MenuItem>
            <MenuItem onClick={() => {
              if (contextMenu?.fileId) {
                setSelectedFiles(new Set([contextMenu.fileId]));
                handleCutKey();
              }
              setContextMenu(null);
            }}>
              <CutIcon sx={{ mr: 1 }} /> Cut
            </MenuItem>
            <MenuItem onClick={() => {
              const file = files.find((f: UserFile) => f.id === contextMenu?.fileId);
              if (file) handleDeleteClick(file);
              setContextMenu(null);
            }}>
              <DeleteIcon sx={{ mr: 1 }} /> Delete
            </MenuItem>
          </>
        )}
      </Menu>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
      >
        <DialogTitle>Confirm Deletion</DialogTitle>
        <DialogContent>
          Are you sure you want to {isTrashMode ? 'permanently delete' : 'delete'} "{fileToDelete?.filename}"?
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button onClick={isTrashMode ? handlePermanentDeleteConfirm : handleDeleteConfirm} color="error">
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Bulk Delete Confirmation Dialog */}
      <Dialog
        open={bulkDeleteDialogOpen}
        onClose={() => setBulkDeleteDialogOpen(false)}
      >
        <DialogTitle>Confirm Bulk Deletion</DialogTitle>
        <DialogContent>
          Are you sure you want to delete {itemsToDelete.length} selected item(s)?
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBulkDeleteDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleBulkDeleteConfirm} color="error">
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Folder Delete Confirmation Dialog */}
      <Dialog
        open={folderDeleteDialogOpen}
        onClose={() => setFolderDeleteDialogOpen(false)}
      >
        <DialogTitle>Confirm Folder Deletion</DialogTitle>
        <DialogContent>
          Are you sure you want to {isTrashMode ? 'permanently delete' : 'delete'} the folder "{folderToDelete?.name}"?
          {!isTrashMode && ' All its contents will be moved to trash.'}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setFolderDeleteDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleDeleteFolderConfirm} color="error">
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Create Folder Dialog */}
      <Dialog
        open={createFolderDialogOpen}
        onClose={handleCreateFolderCancel}
      >
        <DialogTitle>Create New Folder</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Folder Name"
            type="text"
            fullWidth
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            error={!!folderCreationError}
            helperText={folderCreationError}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleCreateFolderConfirm();
              }
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCreateFolderCancel}>Cancel</Button>
          <Button onClick={handleCreateFolderConfirm}>Create</Button>
        </DialogActions>
      </Dialog>

      {/* Rename Dialog */}
      <Dialog
        open={renameDialogOpen}
        onClose={handleRenameCancel}
      >
        <DialogTitle>Rename Item</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="New Name"
            type="text"
            fullWidth
            value={newItemName}
            onChange={(e) => setNewItemName(e.target.value)}
            error={!!renameError}
            helperText={renameError}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleRenameConfirm();
              }
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleRenameCancel}>Cancel</Button>
          <Button onClick={handleRenameConfirm}>Rename</Button>
        </DialogActions>
      </Dialog>

      {/* Share Dialog */}
      {fileToShare && (
        <ShareLinkManager
          open={shareDialogOpen}
          onClose={() => setShareDialogOpen(false)}
          userFileId={fileToShare.id}
          filename={fileToShare.filename}
        />
      )}

      {/* Restore Confirmation Dialog */}
      <Dialog
        open={restoreDialogOpen}
        onClose={() => setRestoreDialogOpen(false)}
      >
        <DialogTitle>Confirm Restore</DialogTitle>
        <DialogContent>
          Are you sure you want to restore "{fileToRestore?.filename}"?
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRestoreDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleRestoreConfirm} color="primary">
            Restore
          </Button>
        </DialogActions>
      </Dialog>

      {/* Folder Restore Confirmation Dialog */}
      <Dialog
        open={folderRestoreDialogOpen}
        onClose={() => setFolderRestoreDialogOpen(false)}
      >
        <DialogTitle>Confirm Folder Restore</DialogTitle>
        <DialogContent>
          Are you sure you want to restore the folder "{folderToRestore?.name}"?
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setFolderRestoreDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleFolderRestoreConfirm} color="primary">
            Restore
          </Button>
        </DialogActions>
      </Dialog>

      {/* Empty Trash Confirmation Dialog */}
      <Dialog
        open={emptyTrashDialogOpen}
        onClose={() => setEmptyTrashDialogOpen(false)}
      >
        <DialogTitle>Confirm Empty Trash</DialogTitle>
        <DialogContent>
          Are you sure you want to permanently delete all items in the trash? This action cannot be undone.
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEmptyTrashDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleEmptyTrashConfirm} color="error">
            Empty Trash
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={6000}
        onClose={() => setSnackbarOpen(false)}
        message={snackbarMessage}
      />
    </Box>
  );
};

export default memo(FileExplorer);
