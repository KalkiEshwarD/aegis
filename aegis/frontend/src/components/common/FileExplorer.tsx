import React, { useState, useCallback, useRef, useMemo } from 'react';
import {
  Box,
  Typography,
  Paper,
  IconButton,
  Menu,
  MenuItem,
  Chip,
  LinearProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  InputAdornment,
  Select,
  FormControl,
  InputLabel,
  SelectChangeEvent,
} from '@mui/material';
import {
  InsertDriveFile as FileIcon,
  Image as ImageIcon,
  VideoFile as VideoIcon,
  AudioFile as AudioIcon,
  PictureAsPdf as PdfIcon,
  Description as DocumentIcon,
  Archive as ArchiveIcon,
  Code as CodeIcon,
  Download as DownloadIcon,
  Delete as DeleteIcon,
  MoreVert as MoreVertIcon,
  Sort as SortIcon,
  Search as SearchIcon,
  CloudUpload as CloudUploadIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import { useQuery, useMutation } from '@apollo/client';
import { GET_MY_FILES, DELETE_FILE_MUTATION, DOWNLOAD_FILE_MUTATION, UPLOAD_FILE_FROM_MAP_MUTATION } from '../../apollo/queries';
import {
  decryptFile,
  base64ToEncryptionKey,
  createDownloadBlob,
  downloadFile,
  formatFileSize,
  extractNonceAndData,
  generateEncryptionKey,
  encryptFile,
  calculateFileHash,
  fileToUint8Array,
  getMimeTypeFromExtension,
  uint8ArrayToBase64,
} from '../../utils/crypto';
import { UserFile, FileFilterInput, FileUploadProgress } from '../../types';

interface FileExplorerProps {
  folderId?: string | null;
  onFileDeleted?: () => void;
  onUploadComplete?: () => void;
}

type SortOption = 'name' | 'date' | 'size';
type SortDirection = 'asc' | 'desc';

const FileExplorer: React.FC<FileExplorerProps> = ({
  folderId,
  onFileDeleted,
  onUploadComplete
}) => {
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [contextMenu, setContextMenu] = useState<{
    mouseX: number;
    mouseY: number;
    fileId: string;
  } | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [fileToDelete, setFileToDelete] = useState<UserFile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FileFilterInput>({});
  const [sortBy, setSortBy] = useState<SortOption>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploads, setUploads] = useState<FileUploadProgress[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data, error: queryError, refetch } = useQuery(GET_MY_FILES, {
    variables: {
      filter: {
        ...filter,
        folder_id: folderId || undefined
      }
    },
    fetchPolicy: 'cache-and-network',
  });

  const [deleteFileMutation] = useMutation(DELETE_FILE_MUTATION);
  const [downloadFileMutation] = useMutation(DOWNLOAD_FILE_MUTATION);
  const [uploadFileMutation] = useMutation(UPLOAD_FILE_FROM_MAP_MUTATION);

  // File type icons
  const getFileIcon = (mimeType: string, filename: string) => {
    if (mimeType.startsWith('image/')) return <ImageIcon sx={{ fontSize: 48, color: '#10b981' }} />;
    if (mimeType.startsWith('video/')) return <VideoIcon sx={{ fontSize: 48, color: '#f59e0b' }} />;
    if (mimeType.startsWith('audio/')) return <AudioIcon sx={{ fontSize: 48, color: '#8b5cf6' }} />;
    if (mimeType.includes('pdf')) return <PdfIcon sx={{ fontSize: 48, color: '#ef4444' }} />;
    if (mimeType.includes('zip') || mimeType.includes('rar') || mimeType.includes('7z')) {
      return <ArchiveIcon sx={{ fontSize: 48, color: '#6b7280' }} />;
    }
    if (mimeType.includes('javascript') || mimeType.includes('typescript') ||
        mimeType.includes('json') || filename.endsWith('.js') || filename.endsWith('.ts') ||
        filename.endsWith('.jsx') || filename.endsWith('.tsx')) {
      return <CodeIcon sx={{ fontSize: 48, color: '#3b82f6' }} />;
    }
    if (mimeType.includes('text') || mimeType.includes('document')) {
      return <DocumentIcon sx={{ fontSize: 48, color: '#6b7280' }} />;
    }
    return <FileIcon sx={{ fontSize: 48, color: '#6b7280' }} />;
  };

  // Sort files
  const sortedFiles = useMemo(() => {
    if (!data?.myFiles) return [];

    return [...data.myFiles].sort((a, b) => {
      let aValue: any, bValue: any;

      switch (sortBy) {
        case 'name':
          aValue = a.filename.toLowerCase();
          bValue = b.filename.toLowerCase();
          break;
        case 'date':
          aValue = new Date(a.created_at).getTime();
          bValue = new Date(b.created_at).getTime();
          break;
        case 'size':
          aValue = a.file?.size_bytes || 0;
          bValue = b.file?.size_bytes || 0;
          break;
        default:
          return 0;
      }

      if (sortDirection === 'asc') {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      }
    });
  }, [data?.myFiles, sortBy, sortDirection]);

  // Handle file selection
  const handleFileClick = (fileId: string, event: React.MouseEvent) => {
    if (event.ctrlKey || event.metaKey) {
      setSelectedFiles(prev => {
        const newSet = new Set(prev);
        if (newSet.has(fileId)) {
          newSet.delete(fileId);
        } else {
          newSet.add(fileId);
        }
        return newSet;
      });
    } else {
      setSelectedFiles(new Set([fileId]));
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

  // File operations
  const handleDownload = async (file: UserFile) => {
    setError(null);

    try {
      if (!file.encryption_key) {
        throw new Error('No encryption key available for this file');
      }

      const token = localStorage.getItem('aegis_token');
      const result = await downloadFileMutation({
        variables: { id: file.id },
      });

      const downloadUrl = result.data.downloadFile;
      if (!downloadUrl) {
        throw new Error('No download URL received');
      }

      const response = await fetch(downloadUrl, {
        headers: {
          'Authorization': token ? `Bearer ${token}` : '',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to download file');
      }

      const encryptedDataWithNonce = new Uint8Array(await response.arrayBuffer());
      const { nonce, encryptedData } = extractNonceAndData(encryptedDataWithNonce);
      const encryptionKey = base64ToEncryptionKey(file.encryption_key);
      const decryptedData = decryptFile(encryptedData, nonce, encryptionKey);

      if (!decryptedData) {
        throw new Error('Failed to decrypt file - invalid key or corrupted data');
      }

      const blob = createDownloadBlob(decryptedData, file.mime_type);
      downloadFile(blob, file.filename);

    } catch (err: any) {
      console.error('Download error:', err);
      setError(err.message || 'Download failed');
    }
  };

  const handleDeleteClick = (file: UserFile) => {
    setFileToDelete(file);
    setDeleteDialogOpen(true);
    handleContextMenuClose();
  };

  const handleDeleteConfirm = async () => {
    if (!fileToDelete) return;

    try {
      await deleteFileMutation({
        variables: { id: fileToDelete.id },
      });

      setDeleteDialogOpen(false);
      setFileToDelete(null);
      setSelectedFiles(prev => {
        const newSet = new Set(prev);
        newSet.delete(fileToDelete.id);
        return newSet;
      });

      refetch();
      if (onFileDeleted) {
        onFileDeleted();
      }
    } catch (err: any) {
      console.error('Delete error:', err);
      setError(err.graphQLErrors?.[0]?.message || err.message || 'Delete failed');
    }
  };

  // Upload functionality
  const validateFile = (file: File): string | null => {
    const maxFileSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxFileSize) {
      return `File size exceeds maximum limit of ${formatFileSize(maxFileSize)}`;
    }
    if (file.size === 0) {
      return 'Empty files are not allowed';
    }
    return null;
  };

  const processFile = useCallback(async (file: File): Promise<void> => {
    const validationError = validateFile(file);
    if (validationError) {
      setUploads(prev => [...prev, {
        file,
        progress: 0,
        status: 'error',
        error: validationError,
      }]);
      return;
    }

    setUploads(prev => [...prev, {
      file,
      progress: 0,
      status: 'pending',
    }]);

    try {
      setUploads(prev => prev.map(u =>
        u.file === file ? { ...u, status: 'uploading', progress: 10 } : u
      ));

      const contentHash = await calculateFileHash(file);
      setUploads(prev => prev.map(u =>
        u.file === file ? { ...u, progress: 30 } : u
      ));

      const encryptionKey = generateEncryptionKey();
      setUploads(prev => prev.map(u =>
        u.file === file ? { ...u, progress: 40 } : u
      ));

      const fileData = await fileToUint8Array(file);
      const { encryptedData, nonce } = encryptFile(fileData, encryptionKey.key);

      const encryptedDataWithNonce = new Uint8Array(nonce.length + encryptedData.length);
      encryptedDataWithNonce.set(nonce, 0);
      encryptedDataWithNonce.set(encryptedData, nonce.length);

      setUploads(prev => prev.map(u =>
        u.file === file ? { ...u, progress: 70 } : u
      ));

      const encryptedDataBase64 = uint8ArrayToBase64(encryptedDataWithNonce);
      const mimeType = file.type || getMimeTypeFromExtension(file.name);
      const encryptedKeyBase64 = uint8ArrayToBase64(encryptionKey.key);

      const uploadData = {
        filename: file.name,
        content_hash: contentHash,
        size_bytes: encryptedDataWithNonce.length,
        mime_type: mimeType,
        encrypted_key: encryptedKeyBase64,
        file_data: encryptedDataBase64,
      };

      const result = await uploadFileMutation({
        variables: {
          input: {
            data: JSON.stringify(uploadData),
          },
        },
      });

      setUploads(prev => prev.map(u =>
        u.file === file ? { ...u, status: 'completed', progress: 100 } : u
      ));

      if (onUploadComplete) {
        onUploadComplete();
      }

    } catch (err: any) {
      console.error('Upload error:', err);
      const errorMessage = err.graphQLErrors?.[0]?.message || err.message || 'Upload failed';
      setUploads(prev => prev.map(u =>
        u.file === file ? { ...u, status: 'error', error: errorMessage } : u
      ));
    }
  }, [uploadFileMutation, onUploadComplete]);

  const handleFiles = useCallback(async (files: FileList | null) => {
    if (!files) return;
    setError(null);
    const fileArray = Array.from(files);
    for (const file of fileArray) {
      await processFile(file);
    }
  }, [processFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    handleFiles(e.target.files);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [handleFiles]);

  const handleClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const removeUpload = useCallback((file: File) => {
    setUploads(prev => prev.filter(u => u.file !== file));
  }, []);

  const clearCompleted = useCallback(() => {
    setUploads(prev => prev.filter(u => u.status !== 'completed'));
  }, []);

  // Filter and sort handlers
  const handleFilterChange = (field: keyof FileFilterInput, value: string) => {
    setFilter(prev => ({
      ...prev,
      [field]: value || undefined,
    }));
  };

  const handleSortChange = (event: SelectChangeEvent) => {
    setSortBy(event.target.value as SortOption);
  };

  const toggleSortDirection = () => {
    setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
  };

  if (queryError) {
    return (
      <Alert severity="error">
        Failed to load files: {queryError.message}
      </Alert>
    );
  }

  const files = sortedFiles;

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Toolbar */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2, flexWrap: 'wrap' }}>
        {/* Search */}
        <TextField
          size="small"
          placeholder="Search files..."
          value={filter.filename || ''}
          onChange={(e) => handleFilterChange('filename', e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
          sx={{ minWidth: 200 }}
        />

        {/* Sort */}
        <FormControl size="small" sx={{ minWidth: 120 }}>
          <InputLabel>Sort by</InputLabel>
          <Select value={sortBy} label="Sort by" onChange={handleSortChange}>
            <MenuItem value="name">Name</MenuItem>
            <MenuItem value="date">Date</MenuItem>
            <MenuItem value="size">Size</MenuItem>
          </Select>
        </FormControl>

        <IconButton onClick={toggleSortDirection} size="small">
          <SortIcon sx={{
            transform: sortDirection === 'desc' ? 'rotate(180deg)' : 'none',
            transition: 'transform 0.2s'
          }} />
        </IconButton>
      </Box>

      {/* File Explorer Area */}
      <Paper
        sx={{
          flex: 1,
          p: 2,
          border: '2px dashed',
          borderColor: isDragOver ? 'primary.main' : 'transparent',
          backgroundColor: isDragOver ? 'action.hover' : 'background.paper',
          cursor: 'pointer',
          transition: 'all 0.2s ease-in-out',
          minHeight: 400,
          position: 'relative',
        }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClick}
      >
        {files.length === 0 && uploads.length === 0 ? (
          <Box
            display="flex"
            flexDirection="column"
            alignItems="center"
            justifyContent="center"
            sx={{ height: '100%', minHeight: 300 }}
          >
            <CloudUploadIcon sx={{ fontSize: 64, color: 'primary.main', mb: 2 }} />
            <Typography variant="h6" gutterBottom>
              Drop files here or click to upload
            </Typography>
            <Typography variant="body2" color="textSecondary">
              Your files will appear here once uploaded
            </Typography>
          </Box>
        ) : (
          <Box sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
            gap: 2,
            height: '100%'
          }}>
            {/* Existing Files */}
            {files.map((file: UserFile) => (
              <Paper
                key={file.id}
                sx={{
                  p: 2,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  cursor: 'pointer',
                  border: selectedFiles.has(file.id) ? '2px solid #3b82f6' : '1px solid #e5e7eb',
                  backgroundColor: selectedFiles.has(file.id) ? '#eff6ff' : 'background.paper',
                  '&:hover': {
                    backgroundColor: selectedFiles.has(file.id) ? '#dbeafe' : '#f9fafb',
                  },
                  position: 'relative',
                }}
                onClick={(e) => handleFileClick(file.id, e)}
                onContextMenu={(e) => handleContextMenu(e, file.id)}
              >
                {getFileIcon(file.mime_type, file.filename)}
                <Typography
                  variant="body2"
                  sx={{
                    mt: 1,
                    textAlign: 'center',
                    wordBreak: 'break-word',
                    maxWidth: '100%',
                    fontWeight: selectedFiles.has(file.id) ? 600 : 400,
                  }}
                  noWrap
                >
                  {file.filename}
                </Typography>
                <Typography variant="caption" color="textSecondary">
                  {file.file ? formatFileSize(file.file.size_bytes) : 'Unknown'}
                </Typography>

                {/* Context menu button */}
                <IconButton
                  size="small"
                  sx={{ position: 'absolute', top: 4, right: 4 }}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleContextMenu(e, file.id);
                  }}
                >
                  <MoreVertIcon fontSize="small" />
                </IconButton>
              </Paper>
            ))}

            {/* Upload Progress Items */}
            {uploads.map((upload, index) => (
              <Paper
                key={`${upload.file.name}-${index}`}
                sx={{
                  p: 2,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  border: '1px solid #e5e7eb',
                  opacity: 0.7,
                }}
              >
                <CloudUploadIcon sx={{ fontSize: 48, color: 'primary.main' }} />
                <Typography variant="body2" sx={{ mt: 1, textAlign: 'center' }} noWrap>
                  {upload.file.name}
                </Typography>
                <LinearProgress
                  variant="determinate"
                  value={upload.progress}
                  color={upload.status === 'error' ? 'error' : 'primary'}
                  sx={{ width: '100%', mt: 1 }}
                />
                <Chip
                  size="small"
                  label={upload.status}
                  color={
                    upload.status === 'completed' ? 'success' :
                    upload.status === 'error' ? 'error' :
                    upload.status === 'uploading' ? 'primary' : 'default'
                  }
                  sx={{ mt: 1 }}
                />
                {upload.error && (
                  <Typography variant="caption" color="error" sx={{ mt: 1, textAlign: 'center' }}>
                    {upload.error}
                  </Typography>
                )}
              </Paper>
            ))}
          </Box>
        )}

        <input
          ref={fileInputRef}
          type="file"
          multiple
          style={{ display: 'none' }}
          onChange={handleFileInputChange}
        />
      </Paper>

      {/* Upload Progress Summary */}
      {uploads.length > 0 && (
        <Box sx={{ mt: 2 }}>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
            <Typography variant="h6">Upload Progress</Typography>
            <IconButton size="small" onClick={clearCompleted} title="Clear completed">
              <CloseIcon />
            </IconButton>
          </Box>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {uploads.map((upload, index) => (
              <Chip
                key={`${upload.file.name}-${index}`}
                label={`${upload.file.name} (${upload.status})`}
                color={
                  upload.status === 'completed' ? 'success' :
                  upload.status === 'error' ? 'error' :
                  upload.status === 'uploading' ? 'primary' : 'default'
                }
                size="small"
                onDelete={() => removeUpload(upload.file)}
              />
            ))}
          </Box>
        </Box>
      )}

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
        <MenuItem onClick={() => {
          const file = files.find(f => f.id === contextMenu?.fileId);
          if (file) handleDownload(file);
          handleContextMenuClose();
        }}>
          <DownloadIcon sx={{ mr: 1 }} />
          Download
        </MenuItem>
        <MenuItem onClick={() => {
          const file = files.find(f => f.id === contextMenu?.fileId);
          if (file) handleDeleteClick(file);
        }}>
          <DeleteIcon sx={{ mr: 1 }} />
          Delete
        </MenuItem>
      </Menu>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Delete File</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete "{fileToDelete?.filename}"?
            This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleDeleteConfirm} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Error Display */}
      {error && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {error}
        </Alert>
      )}
    </Box>
  );
};

export default FileExplorer;