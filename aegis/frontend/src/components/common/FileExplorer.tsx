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
  InputAdornment,
  Select,
  FormControl,
  InputLabel,
} from '@mui/material';
import {
  Download as DownloadIcon,
  Delete as DeleteIcon,
  CloudUpload as CloudUploadIcon,
  Folder as FolderIcon,
  Edit as EditIcon,
  ContentCut as CutIcon,
  Share as ShareIcon,
  Star as StarIcon,
  StarBorder as StarBorderIcon,
  ViewList as ListIcon,
  ViewModule as GridIcon,
  Search as SearchIcon,
  Sort as SortIcon,
} from '@mui/icons-material';
import { useQuery, useMutation } from '@apollo/client';
import { GET_MY_FILES, MOVE_FILE_MUTATION } from '../../apollo/files';
import { GET_MY_FOLDERS, CREATE_FOLDER_MUTATION, RENAME_FOLDER_MUTATION, MOVE_FOLDER_MUTATION, DELETE_FOLDER_MUTATION } from '../../apollo/folders';
import { STAR_FILE_MUTATION, UNSTAR_FILE_MUTATION } from '../../apollo/queries';
import { UserFile, Folder, FileExplorerItem, isFolder, isFile } from '../../types';
import { useFileOperations } from '../../hooks/useFileOperations';
import { useFileUpload } from '../../hooks/useFileUpload';
import { useFileSorting } from '../../hooks/useFileSorting';
import FileGrid from './FileGrid';
import FileToolbar from './FileToolbar';
import { FileListItem } from './FileListItem';
import UploadProgress from './UploadProgress';
import { ShareLinkManager } from './ShareLinkManager';

interface FileExplorerProps {
  folderId?: string | null;
  onFileDeleted?: () => void;
  onUploadComplete?: () => void;
  onFolderClick?: (folderId: string, folderName: string) => void;
  externalSearchTerm?: string;
  externalViewMode?: 'list' | 'tile';
  onSelectionChange?: (count: number) => void;
}

const FileExplorer: React.FC<FileExplorerProps> = ({
  folderId,
  onFileDeleted,
  onUploadComplete,
  onFolderClick,
  externalSearchTerm = '',
  externalViewMode,
  onSelectionChange,
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
  const containerRef = useRef<HTMLDivElement>(null);

  // New state for view mode, search, and sorting
  const viewMode = externalViewMode || 'tile';
  const [searchQuery, setSearchQuery] = useState(externalSearchTerm);
  const [fileSortBy, setFileSortBy] = useState<'name' | 'date' | 'size' | 'type'>('name');
  const [fileSortOrder, setFileSortOrder] = useState<'asc' | 'desc'>('asc');

  // Sync external search term with internal state
  useEffect(() => {
    setSearchQuery(externalSearchTerm);
  }, [externalSearchTerm]);

  const { data, error: queryError, refetch } = useQuery(GET_MY_FILES, {
    variables: {
      filter: {
        // Temporarily disable folder_id filtering due to GraphQL schema issues
        // folder_id: folderId || undefined,
        includeTrashed: false // Explicitly exclude trashed files
      }
    },
    fetchPolicy: 'cache-and-network',
  });

  const { data: foldersData, refetch: refetchFolders } = useQuery(GET_MY_FOLDERS, {
    fetchPolicy: 'cache-and-network',
  });

  // Get all available files and folders for paste operations
  const allAvailableItems = useMemo(() => {
    const allFiles = data?.myFiles || [];
    const allFolders = foldersData?.myFolders || [];
    return [...allFiles, ...allFolders];
  }, [data?.myFiles, foldersData?.myFolders]);

  const [moveFileMutation] = useMutation(MOVE_FILE_MUTATION);
  const [createFolderMutation] = useMutation(CREATE_FOLDER_MUTATION);
  const [renameFolderMutation] = useMutation(RENAME_FOLDER_MUTATION);
  const [moveFolderMutation] = useMutation(MOVE_FOLDER_MUTATION);
  const [deleteFolderMutation] = useMutation(DELETE_FOLDER_MUTATION);
  const [starFileMutation] = useMutation(STAR_FILE_MUTATION);
  const [unstarFileMutation] = useMutation(UNSTAR_FILE_MUTATION);

  // Filter and sort folders based on current folderId and search query
  const currentFolders = useMemo(() => {
    let filtered = foldersData?.myFolders?.filter((folder: Folder) => {
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

    // Sort folders using the same logic as files
    filtered.sort((a: Folder, b: Folder) => {
      let comparison = 0;

      switch (fileSortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
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
  }, [foldersData?.myFolders, folderId, searchQuery, fileSortBy, fileSortOrder]);

  // Client-side filter files by folder_id and search query
  const filteredFiles = useMemo(() => {
    if (!data?.myFiles) return [];

    let filtered = data.myFiles.filter((file: UserFile) => {
      // Filter out null/undefined items for data integrity
      if (!file || !file.id) return false;

      // Folder filter
      if (folderId) {
        if (file.folder_id !== folderId) return false;
      } else {
        if (file.folder_id) return false;
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
  }, [data?.myFiles, folderId, searchQuery]);

  // Use custom hooks
  const { downloadingFile, error, downloadFile, deleteFile } = useFileOperations();
  const { uploads, handleFiles, removeUpload, clearCompleted } = useFileUpload(onUploadComplete);

  // Helper function to calculate folder size recursively
  const calculateFolderSize = useCallback((folder: Folder): number => {
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
  }, []);

  // Combine folders and files for display and sort them together
  const allItems: FileExplorerItem[] = useMemo(() => {
    const combined = [...currentFolders, ...filteredFiles];

    // Sort the combined array
    combined.sort((a: FileExplorerItem, b: FileExplorerItem) => {
      let comparison = 0;

      switch (fileSortBy) {
        case 'name':
          const aName = isFolder(a) ? a.name : a.filename;
          const bName = isFolder(b) ? b.name : b.filename;
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
            comparison = a.name.localeCompare(b.name);
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
  }, [currentFolders, filteredFiles, fileSortBy, fileSortOrder, calculateFolderSize]);

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

    try {
      for (const file of filesToStar) {
        if (!file.is_starred) {
          await starFileMutation({
            variables: { id: file.id },
          });
        }
      }
      refetch();
      setSnackbarMessage(`Starred ${filesToStar.length} item(s)`);
      setSnackbarOpen(true);
    } catch (error) {
      console.error('Error starring files:', error);
      setSnackbarMessage('Failed to star files');
      setSnackbarOpen(true);
    }
  }, [selectedFiles, allItems, starFileMutation, refetch]);

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

  const handleContextMenuClose = () => {
    setContextMenu(null);
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
      for (const folder of foldersToDelete) {
        // Note: Folder deletion might need separate handling
        // For now, skip folders or handle them differently
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

    const files = Array.from(event.dataTransfer.files);
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
    try {
      const allItems = [...(data?.myFiles || []), ...(foldersData?.myFolders || [])];
      const itemsToMove = allItems.filter((item) => itemIds.includes(item.id));

      // Filter out items that are already in the target folder
      const itemsToActuallyMove = itemsToMove.filter((item) => {
        if (isFile(item)) {
          return item.folder_id !== targetFolderId;
        } else if (isFolder(item)) {
          return item.parent_id !== targetFolderId;
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
    const { key, ctrlKey, metaKey, shiftKey } = event;
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const cmdOrCtrl = isMac ? metaKey : ctrlKey;

    // Prevent default browser shortcuts
    if (cmdOrCtrl && (key === 'n' || key === 'x' || key === 'v')) {
      event.preventDefault();
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
          handleCutKey();
        }
        break;
      case 'c':
      case 'C':
        if (cmdOrCtrl) {
          event.preventDefault();
          handleCopyKey();
        }
        break;
      case 'v':
      case 'V':
        if (cmdOrCtrl) {
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
    }
  }, [focusedIndex, selectedFiles, cutItems]);

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
    if (selectedItemIds.length === 1) {
      const item = allItems.find(i => i.id === selectedItemIds[0]);
      if (item) {
        if (isFile(item)) {
          handleDeleteClick(item as UserFile);
        } else if (isFolder(item)) {
          // Handle folder deletion
          handleDeleteFolder(item as Folder);
        }
      }
    }
  }, [selectedFiles, allItems]);

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
      await deleteFolderMutation({
        variables: { id: folderToDelete.id },
      });
      refetch();
      refetchFolders();
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
  }, [folderToDelete, deleteFolderMutation, refetch, refetchFolders, onFileDeleted]);

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
      const files = Array.from(event.clipboardData.files);
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
    const container = containerRef.current;
    if (container) {
      container.addEventListener('keydown', handleKeyDown);
      container.addEventListener('paste', handlePasteEvent);
      return () => {
        container.removeEventListener('keydown', handleKeyDown);
        container.removeEventListener('paste', handlePasteEvent);
      };
    }
  }, [handleKeyDown, handlePasteEvent]);

  // Focus container when component mounts
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.focus();
    }
  }, []);

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

  // Determine if drag and drop should be enabled
  const isDragDropEnabled = allItems.length > 0 || uploads.length > 0 || !searchQuery;





  if (queryError) {
    return (
      <Alert severity="error">
        Failed to load files: {queryError.message}
      </Alert>
    );
  }

  const files = filteredFiles;

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Toolbar */}
      {(() => {
        const canPasteValue = cutItems.size > 0 || copiedItems.size > 0;
        const hasSelection = selectedFiles.size > 0;
        const selectedItems = allItems.filter(item => selectedFiles.has(item.id));
        const hasFiles = selectedItems.some(item => isFile(item));
        console.log('DEBUG: Toolbar render - cutItems.size:', cutItems.size, 'copiedItems.size:', copiedItems.size, 'canPaste:', canPasteValue, 'hasSelection:', hasSelection, 'hasFiles:', hasFiles);
        return (
          <FileToolbar
            searchQuery={searchQuery}
            sortBy={fileSortBy}
            sortDirection={fileSortOrder}
            onSearchChange={setSearchQuery}
            onSortChange={setFileSortBy}
            onToggleSortDirection={() => setFileSortOrder(fileSortOrder === 'asc' ? 'desc' : 'asc')}
            onCut={handleCut}
            onPaste={handlePasteKey}
            onDelete={handleDeleteSelected}
            onStar={handleStarSelected}
            canCut={hasSelection}
            canPaste={canPasteValue}
            canDelete={hasSelection}
            canStar={hasSelection && hasFiles}
            cutItemsCount={selectedFiles.size}
          />
        );
      })()}


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
          '&:focus': {
            outline: 'none',
          },
          userSelect: 'none', // Prevent text selection during box selection
        }}
        onClick={(e) => {
          // Only clear selection if clicking on empty space
          const hasFileItem = (e.target as HTMLElement).closest('[data-file-item]');
          const hasButton = (e.target as HTMLElement).closest('button');
          const hasIconButton = (e.target as HTMLElement).closest('.MuiIconButton-root');

          if (!hasFileItem && !hasButton && !hasIconButton) {
            setSelectedFiles(new Set());
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
          <div className="file-explorer-grid-container">
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
                onFolderClick={onFolderClick}
                onFileMove={handleFileMove}
                onItemSelect={handleItemSelect}
              />
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {allItems.map((item, index) => (
                  <FileListItem
                    key={item.id}
                    item={item}
                    isSelected={selectedFiles.has(item.id)}
                    isDownloading={downloadingFile === item.id}
                    selectedFileIds={Array.from(selectedFiles)}
                    onClick={(e) => handleFileClick(item.id, e)}
                    onContextMenu={(e) => handleContextMenu(e, item.id)}
                    onDownload={() => isFile(item) ? handleDownload(item) : undefined}
                    onDelete={() => isFile(item) ? handleDeleteClick(item) : undefined}
                    onFolderClick={() => isFolder(item) ? onFolderClick?.(item.id, item.name) : undefined}
                    onStarToggle={() => {
                      if (isFile(item)) {
                        if (item.is_starred) {
                          handleUnstarFile(item);
                        } else {
                          handleStarFile(item);
                        }
                      }
                    }}
                    onFileMove={handleFileMove}
                    onItemSelect={handleItemSelect}
                  />
                ))}
              </Box>
            )}
          </div>
        )}

        {/* Box selection overlay */}
        {isBoxSelecting && boxSelectionStart && boxSelectionEnd && (
          <Box
            sx={{
              position: 'absolute',
              left: Math.min(boxSelectionStart.x, boxSelectionEnd.x),
              top: Math.min(boxSelectionStart.y, boxSelectionEnd.y),
              width: Math.abs(boxSelectionEnd.x - boxSelectionStart.x),
              height: Math.abs(boxSelectionEnd.y - boxSelectionStart.y),
              border: '2px solid #3b82f6',
              backgroundColor: 'rgba(59, 130, 246, 0.1)',
              pointerEvents: 'none',
              zIndex: 1000,
            }}
          />
        )}
      </Paper>

      {/* Upload Progress Summary */}
      <UploadProgress
        uploads={uploads}
        onRemoveUpload={removeUpload}
        onClearCompleted={clearCompleted}
      />

      {/* Context Menu */}
      <Menu
        open={contextMenu !== null}
        onClose={handleContextMenuClose}
        anchorReference="anchorPosition"
        anchorPosition={
          contextMenu !== null
            ? { top: contextMenu.mouseY, left: contextMenu.mouseX }
            : undefined
        }
      >
        {(() => {
          const item = allItems.find(item => item.id === contextMenu?.fileId);
          if (!item) return null;

          const isItemFolder = isFolder(item);
          const isItemFile = isFile(item);

          return (
            <>
              {/* File-specific options */}
              {isItemFile && (
                <>
                  <MenuItem onClick={() => {
                    handleDownload(item);
                    handleContextMenuClose();
                  }}>
                    <DownloadIcon sx={{ mr: 1 }} />
                    Download
                  </MenuItem>
                  <MenuItem onClick={() => {
                    setFileToShare(item);
                    setShareDialogOpen(true);
                    handleContextMenuClose();
                  }}>
                    <ShareIcon sx={{ mr: 1 }} />
                    Share
                  </MenuItem>
                  <MenuItem onClick={() => {
                    if (item.is_starred) {
                      handleUnstarFile(item);
                    } else {
                      handleStarFile(item);
                    }
                    handleContextMenuClose();
                  }}>
                    {item.is_starred ? (
                      <StarIcon sx={{ mr: 1, color: '#fbbf24' }} />
                    ) : (
                      <StarBorderIcon sx={{ mr: 1 }} />
                    )}
                    {item.is_starred ? 'Unstar' : 'Star'}
                  </MenuItem>
                  <MenuItem onClick={() => {
                    const itemIds = [item.id];
                    setCutItems(new Set(itemIds));
                    localStorage.setItem('fileExplorerCutItems', JSON.stringify(itemIds));
                    setCopiedItems(new Set());
                    localStorage.setItem('fileExplorerCopiedItems', JSON.stringify([]));
                    setSelectedFiles(new Set());
                    setSnackbarMessage(`1 item(s) cut`);
                    setSnackbarOpen(true);
                    handleContextMenuClose();
                  }}>
                    <CutIcon sx={{ mr: 1 }} />
                    Cut
                  </MenuItem>
                </>
              )}

              {/* Folder-specific options */}
              {isItemFolder && (
                <>
                  <MenuItem onClick={() => {
                    if (onFolderClick) onFolderClick(item.id, item.name);
                    handleContextMenuClose();
                  }}>
                    <FolderIcon sx={{ mr: 1 }} />
                    Open Folder
                  </MenuItem>
                  <MenuItem onClick={() => {
                    const itemIds = [item.id];
                    setCutItems(new Set(itemIds));
                    localStorage.setItem('fileExplorerCutItems', JSON.stringify(itemIds));
                    setCopiedItems(new Set());
                    localStorage.setItem('fileExplorerCopiedItems', JSON.stringify([]));
                    setSelectedFiles(new Set());
                    setSnackbarMessage(`1 item(s) cut`);
                    setSnackbarOpen(true);
                    handleContextMenuClose();
                  }}>
                    <CutIcon sx={{ mr: 1 }} />
                    Cut
                  </MenuItem>
                </>
              )}

              {/* Common options for both files and folders */}
              <MenuItem onClick={() => {
                setRenameItem(item);
                setNewItemName(isItemFolder ? item.name : item.filename);
                setRenameDialogOpen(true);
                handleContextMenuClose();
              }}>
                <EditIcon sx={{ mr: 1 }} />
                Rename
              </MenuItem>
              
              <MenuItem onClick={() => {
                if (isItemFile) {
                  handleDeleteClick(item);
                } else if (isItemFolder) {
                  handleDeleteFolder(item);
                }
                handleContextMenuClose();
              }}>
                <DeleteIcon sx={{ mr: 1 }} />
                Delete
              </MenuItem>
            </>
          );
        })()}
      </Menu>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Delete File</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete "{fileToDelete?.filename}"?
            Files can be restored from trash.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleDeleteConfirm} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Bulk Delete Confirmation Dialog */}
      <Dialog open={bulkDeleteDialogOpen} onClose={() => setBulkDeleteDialogOpen(false)}>
        <DialogTitle>Delete Selected Items</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete {itemsToDelete.length} selected item{itemsToDelete.length !== 1 ? 's' : ''}?
            Files can be restored from trash.
          </Typography>
          {itemsToDelete.length > 0 && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                Items to delete:
              </Typography>
              {itemsToDelete.slice(0, 5).map((item) => (
                <Typography key={item.id} variant="body2" sx={{ ml: 2 }}>
                  • {isFolder(item) ? item.name : (item as UserFile).filename}
                </Typography>
              ))}
              {itemsToDelete.length > 5 && (
                <Typography variant="body2" sx={{ ml: 2, fontStyle: 'italic' }}>
                  ... and {itemsToDelete.length - 5} more
                </Typography>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBulkDeleteDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleBulkDeleteConfirm} color="error" variant="contained">
            Delete {itemsToDelete.length} Item{itemsToDelete.length !== 1 ? 's' : ''}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Folder Delete Confirmation Dialog */}
      <Dialog open={folderDeleteDialogOpen} onClose={() => setFolderDeleteDialogOpen(false)}>
        <DialogTitle>Delete Folder</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete the folder "{folderToDelete?.name}" and all its contents?
            Files can be restored from trash.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setFolderDeleteDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleDeleteFolderConfirm} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Create Folder Dialog */}
      <Dialog open={createFolderDialogOpen} onClose={handleCreateFolderCancel}>
        <DialogTitle>Create New Folder</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Folder Name"
            fullWidth
            variant="outlined"
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
          <Button
            onClick={handleCreateFolderConfirm}
            variant="contained"
            disabled={!newFolderName.trim()}
          >
            Create
          </Button>
        </DialogActions>
      </Dialog>

      {/* Rename Dialog */}
      <Dialog open={renameDialogOpen} onClose={handleRenameCancel}>
        <DialogTitle>Rename {renameItem && isFolder(renameItem) ? 'Folder' : 'File'}</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="New Name"
            fullWidth
            variant="outlined"
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
          <Button
            onClick={handleRenameConfirm}
            variant="contained"
            disabled={!newItemName.trim()}
          >
            Rename
          </Button>
        </DialogActions>
      </Dialog>

      {/* Share Dialog */}
      <Dialog 
        open={shareDialogOpen} 
        onClose={() => setShareDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Share File</DialogTitle>
        <DialogContent>
          {fileToShare && (
            <ShareLinkManager 
              userFileId={fileToShare.id}
              onShareDeleted={() => {
                // Optionally refresh data or update UI
              }}
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShareDialogOpen(false)}>
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar for feedback */}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={3000}
        onClose={() => setSnackbarOpen(false)}
        message={snackbarMessage}
      />

      {/* Error Display */}
      {error && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {error}
        </Alert>
      )}
    </Box>
  );
};

export default memo(FileExplorer);