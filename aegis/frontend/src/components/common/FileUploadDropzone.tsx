import React, { useState, useCallback, useRef, memo } from 'react';
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
import { UPLOAD_FILE_FROM_MAP_MUTATION } from '../../apollo/files';
import {
  generateEncryptionKey,
  encryptFile,
  calculateFileHash,
  fileToUint8Array,
  uint8ArrayToBase64,
} from '../../utils/crypto';
import { formatFileSize, getMimeTypeFromExtension } from '../../utils/fileUtils';
import { FileUploadProgress } from '../../types';
import { getErrorMessage, getErrorCode } from '../../utils/errorHandling';
import withErrorBoundary from '../hocs/withErrorBoundary';
import withAuth from '../hocs/withAuth';

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

  const [uploadFileMutation] = useMutation(UPLOAD_FILE_FROM_MAP_MUTATION);

  const validateFile = (file: File): string | null => {
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
      console.log(`DEBUG upload: Original file data length: ${fileData.length}`);
      
      const { encryptedData, nonce } = encryptFile(fileData, encryptionKey.key);
      console.log(`DEBUG upload: Encrypted data length: ${encryptedData.length}, Nonce length: ${nonce.length}`);
      
      // Prepend nonce to encrypted data for storage
      const encryptedDataWithNonce = new Uint8Array(nonce.length + encryptedData.length);
      encryptedDataWithNonce.set(nonce, 0);
      encryptedDataWithNonce.set(encryptedData, nonce.length);
      console.log(`DEBUG upload: Combined data length (nonce + encrypted): ${encryptedDataWithNonce.length}`);
      console.log(`DEBUG upload: First 10 bytes of combined data: [${Array.from(encryptedDataWithNonce.slice(0, 10)).join(', ')}]`);
      
      setUploads(prev => prev.map(u =>
        u.file === file ? { ...u, progress: 70 } : u
      ));

      // Convert encrypted data to base64 for JSON transmission

      // Check if encrypted data is too large for base64 conversion
      if (encryptedDataWithNonce.length > 100 * 1024 * 1024) { // 100MB threshold
        throw new Error(`Encrypted data too large for base64 conversion: ${encryptedDataWithNonce.length} bytes`);
      }

      // Use chunked base64 conversion to avoid stack overflow
      const encryptedDataBase64 = uint8ArrayToBase64(encryptedDataWithNonce);

      // Determine MIME type
      const mimeType = file.type || getMimeTypeFromExtension(file.name);

      // Prepare encrypted key for storage (we'll store it encrypted with user's key in a real implementation)
      // For now, we'll store it as base64 (in production, this should be encrypted with user's master key)
      const encryptedKeyBase64 = uint8ArrayToBase64(encryptionKey.key);

      // Prepare upload data as JSON string for uploadFileFromMap mutation
      const uploadData = {
        filename: file.name,
        content_hash: contentHash,
        size_bytes: encryptedDataWithNonce.length, // Use encrypted data size, not original file size
        mime_type: mimeType,
        encrypted_key: encryptedKeyBase64,
        file_data: encryptedDataBase64,
      };
      
      console.log(`DEBUG upload: Upload data prepared:`);
      console.log(`DEBUG upload: - filename: ${uploadData.filename}`);
      console.log(`DEBUG upload: - size_bytes: ${uploadData.size_bytes} (encrypted data size)`);
      console.log(`DEBUG upload: - original file size: ${file.size}`);
      console.log(`DEBUG upload: - encrypted_key length: ${uploadData.encrypted_key.length}`);
      console.log(`DEBUG upload: - file_data length: ${uploadData.file_data.length}`);

      const mutationVars = {
        input: {
          data: JSON.stringify(uploadData),
        },
      };

      // Upload file using the new uploadFileFromMap mutation
      const result = await uploadFileMutation({
        variables: mutationVars,
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
      const errorMessage = getErrorMessage(err) || 'Upload failed';
      const errorCode = getErrorCode(err);

      // Provide more specific error messages based on error code
      let displayMessage = errorMessage;
      if (errorCode === 'storage_quota_exceeded') {
        displayMessage = 'Storage quota exceeded. Please free up space or contact administrator.';
      } else if (errorCode === 'validation_error') {
        displayMessage = 'File validation failed. Please check file format and size.';
      } else if (errorCode === 'authentication_error') {
        displayMessage = 'Authentication required. Please log in again.';
      } else if (errorCode === 'permission_error') {
        displayMessage = 'Permission denied. You may not have access to upload files.';
      }

      setUploads(prev => prev.map(u =>
        u.file === file ? { ...u, status: 'error', error: displayMessage } : u
      ));
    }
  }, [uploadFileMutation, onUploadComplete, validateFile]);

  const handleFiles = useCallback(async (files: File[]) => {
    if (!files || files.length === 0) {
      return;
    }

    setError(null);
    const fileArray = files;

    // Process files sequentially to avoid overwhelming the server
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
    handleFiles(Array.from(e.dataTransfer.files));
  }, [handleFiles]);

  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFiles(Array.from(e.target.files));
    }
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

// Create enhanced component with HOCs
const FileUploadDropzoneWithAuth = withAuth(FileUploadDropzone);
const FileUploadDropzoneWithErrorBoundary = withErrorBoundary(FileUploadDropzoneWithAuth);

export default memo(FileUploadDropzoneWithErrorBoundary);