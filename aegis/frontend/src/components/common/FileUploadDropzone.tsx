import React, { useState, useCallback, useRef } from 'react';
import {
  Box,
  Typography,
  Paper,
  LinearProgress,
  Chip,
  IconButton,
  Alert,
} from '@mui/material';
import {
  CloudUpload as CloudUploadIcon,
  InsertDriveFile as FileIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import { useMutation } from '@apollo/client';
import { UPLOAD_FILE_MUTATION } from '../../apollo/queries';
import {
  generateEncryptionKey,
  encryptFile,
  calculateFileHash,
  fileToUint8Array,
  formatFileSize,
  getMimeTypeFromExtension,
} from '../../utils/crypto';
import { FileUploadProgress } from '../../types';

interface FileUploadDropzoneProps {
  onUploadComplete?: () => void;
  maxFileSize?: number; // in bytes, default 10MB
}

const FileUploadDropzone: React.FC<FileUploadDropzoneProps> = ({
  onUploadComplete,
  maxFileSize = 10 * 1024 * 1024, // 10MB default
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploads, setUploads] = useState<FileUploadProgress[]>([]);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [uploadFileMutation] = useMutation(UPLOAD_FILE_MUTATION);

  const validateFile = (file: File): string | null => {
    if (file.size > maxFileSize) {
      return `File size exceeds maximum limit of ${formatFileSize(maxFileSize)}`;
    }
    if (file.size === 0) {
      return 'Empty files are not allowed';
    }
    return null;
  };

  const processFile = async (file: File): Promise<void> => {
    const uploadId = `${file.name}-${Date.now()}`;
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

    // Add file to upload queue
    setUploads(prev => [...prev, {
      file,
      progress: 0,
      status: 'pending',
    }]);

    try {
      // Update status to uploading
      setUploads(prev => prev.map(u =>
        u.file === file ? { ...u, status: 'uploading', progress: 10 } : u
      ));

      // Calculate file hash
      const contentHash = await calculateFileHash(file);
      setUploads(prev => prev.map(u =>
        u.file === file ? { ...u, progress: 30 } : u
      ));

      // Generate encryption key
      const encryptionKey = generateEncryptionKey();
      setUploads(prev => prev.map(u =>
        u.file === file ? { ...u, progress: 40 } : u
      ));

      // Convert file to Uint8Array and encrypt
      const fileData = await fileToUint8Array(file);
      const { encryptedData, nonce } = encryptFile(fileData, encryptionKey.key);
      setUploads(prev => prev.map(u =>
        u.file === file ? { ...u, progress: 70 } : u
      ));

      // Create encrypted file blob for upload
      const encryptedBlob = new Blob([encryptedData]);

      // Determine MIME type
      const mimeType = file.type || getMimeTypeFromExtension(file.name);

      // Prepare encrypted key for storage (we'll store it encrypted with user's key in a real implementation)
      // For now, we'll store it as base64 (in production, this should be encrypted with user's master key)
      const encryptedKeyBase64 = btoa(String.fromCharCode(...Array.from(encryptionKey.key)));

      // Upload file
      const result = await uploadFileMutation({
        variables: {
          input: {
            filename: file.name,
            content_hash: contentHash,
            size_bytes: file.size,
            mime_type: mimeType,
            encrypted_key: encryptedKeyBase64,
            file_data: encryptedBlob,
          },
        },
      });

      setUploads(prev => prev.map(u =>
        u.file === file ? { ...u, status: 'completed', progress: 100 } : u
      ));

      // Call completion callback
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
  };

  const handleFiles = useCallback(async (files: FileList | null) => {
    if (!files) return;

    setError(null);
    const fileArray = Array.from(files);

    // Process files sequentially to avoid overwhelming the server
    for (const file of fileArray) {
      await processFile(file);
    }
  }, [uploadFileMutation, onUploadComplete]);

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
    // Reset input value to allow re-uploading the same file
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

  return (
    <Box>
      <Paper
        sx={{
          p: 3,
          border: '2px dashed',
          borderColor: isDragOver ? 'primary.main' : 'grey.300',
          backgroundColor: isDragOver ? 'action.hover' : 'background.paper',
          cursor: 'pointer',
          transition: 'all 0.2s ease-in-out',
          '&:hover': {
            borderColor: 'primary.main',
            backgroundColor: 'action.hover',
          },
        }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClick}
      >
        <Box
          display="flex"
          flexDirection="column"
          alignItems="center"
          justifyContent="center"
          minHeight={200}
        >
          <CloudUploadIcon sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />
          <Typography variant="h6" gutterBottom>
            Drag & drop files here
          </Typography>
          <Typography variant="body2" color="textSecondary" align="center">
            or click to browse files
          </Typography>
          <Typography variant="caption" color="textSecondary" sx={{ mt: 1 }}>
            Maximum file size: {formatFileSize(maxFileSize)}
          </Typography>
        </Box>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          style={{ display: 'none' }}
          onChange={handleFileInputChange}
        />
      </Paper>

      {/* Upload Progress */}
      {uploads.length > 0 && (
        <Box sx={{ mt: 2 }}>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
            <Typography variant="h6">Upload Progress</Typography>
            <IconButton size="small" onClick={clearCompleted} title="Clear completed">
              <CloseIcon />
            </IconButton>
          </Box>

          {uploads.map((upload, index) => (
            <Box key={`${upload.file.name}-${index}`} sx={{ mb: 2 }}>
              <Box display="flex" alignItems="center" mb={1}>
                <FileIcon sx={{ mr: 1, color: 'action.active' }} />
                <Typography variant="body2" sx={{ flexGrow: 1 }}>
                  {upload.file.name} ({formatFileSize(upload.file.size)})
                </Typography>
                <Chip
                  size="small"
                  label={upload.status}
                  color={
                    upload.status === 'completed' ? 'success' :
                    upload.status === 'error' ? 'error' :
                    upload.status === 'uploading' ? 'primary' : 'default'
                  }
                />
                <IconButton size="small" onClick={() => removeUpload(upload.file)}>
                  <CloseIcon />
                </IconButton>
              </Box>

              <LinearProgress
                variant="determinate"
                value={upload.progress}
                color={upload.status === 'error' ? 'error' : 'primary'}
                sx={{ mb: 1 }}
              />

              {upload.error && (
                <Alert severity="error" sx={{ mt: 1 }}>
                  {upload.error}
                </Alert>
              )}
            </Box>
          ))}
        </Box>
      )}

      {/* Global Error */}
      {error && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {error}
        </Alert>
      )}
    </Box>
  );
};

export default FileUploadDropzone;