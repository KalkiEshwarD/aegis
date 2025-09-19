import { useState, useCallback } from 'react';
import { useMutation } from '@apollo/client';
import { UPLOAD_FILE_FROM_MAP_MUTATION } from '../apollo/queries';
import {
  generateEncryptionKey,
  encryptFile,
  calculateFileHash,
  fileToUint8Array,
  uint8ArrayToBase64,
  getMimeTypeFromExtension,
  formatFileSize,
} from '../utils/crypto';
import { FileUploadProgress } from '../types';

export const useFileUpload = (onUploadComplete?: () => void) => {
  const [uploads, setUploads] = useState<FileUploadProgress[]>([]);
  const [uploadFileMutation] = useMutation(UPLOAD_FILE_FROM_MAP_MUTATION);

  const validateFile = useCallback((file: File): string | null => {
    const maxFileSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxFileSize) {
      return `File size exceeds maximum limit of ${formatFileSize(maxFileSize)}`;
    }
    if (file.size === 0) {
      return 'Empty files are not allowed';
    }
    return null;
  }, []);

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
  }, [uploadFileMutation, onUploadComplete, validateFile]);

  const handleFiles = useCallback(async (files: File[]) => {
    if (!files || files.length === 0) return;
    for (const file of files) {
      await processFile(file);
    }
  }, [processFile]);

  const removeUpload = useCallback((file: File) => {
    setUploads(prev => prev.filter(u => u.file !== file));
  }, []);

  const clearCompleted = useCallback(() => {
    setUploads(prev => prev.filter(u => u.status !== 'completed'));
  }, []);

  return {
    uploads,
    handleFiles,
    removeUpload,
    clearCompleted,
  };
};