import { useState, useCallback, useRef, useEffect } from 'react';
import { useMutation } from '@apollo/client';
import { UPLOAD_FILE_FROM_MAP_MUTATION, GET_MY_STATS } from '../apollo/queries';
import {
  generateEncryptionKey,
  encryptFile,
} from '../utils/cryptoManager';
import { 
  calculateFileHash,
  fileToUint8Array,
  uint8ArrayToBase64,
} from '../utils/crypto';
import { getMimeTypeFromExtension, formatFileSize } from '../utils/fileUtils';
import { FileUploadProgress } from '../types';
import { getErrorMessage, getErrorCode, ERROR_CODES } from '../utils/errorHandling';

export const useFileUpload = (onUploadComplete?: () => void) => {
  const [uploads, setUploads] = useState<FileUploadProgress[]>([]);
  const [trashedFileToRestore, setTrashedFileToRestore] = useState<File | null>(null);
  const [uploadFileMutation] = useMutation(UPLOAD_FILE_FROM_MAP_MUTATION);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
    };
  }, []);

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

  const safeSetUploads = useCallback((updater: (prev: FileUploadProgress[]) => FileUploadProgress[]) => {
    if (isMountedRef.current) {
      setUploads(updater);
    }
  }, []);

  const processFile = useCallback(async (file: File, folderId?: string): Promise<void> => {
    // Check if this file is already being uploaded
    const isAlreadyUploading = uploads.some(u =>
      u.file.name === file.name &&
      u.file.size === file.size &&
      u.file.lastModified === file.lastModified &&
      (u.status === 'pending' || u.status === 'uploading' || u.status === 'encrypting')
    );

    if (isAlreadyUploading) {
      // Skip this file as it's already being processed
      return;
    }

    const validationError = validateFile(file);
    if (validationError) {
      safeSetUploads(prev => [...prev, {
        file,
        progress: 0,
        status: 'error',
        error: validationError,
      }]);
      return;
    }

    safeSetUploads(prev => [...prev, {
      file,
      progress: 0,
      status: 'pending',
    }]);

    try {
      safeSetUploads(prev => prev.map(u =>
        u.file === file ? { ...u, status: 'uploading', progress: 10 } : u
      ));

      const contentHash = await calculateFileHash(file);
      safeSetUploads(prev => prev.map(u =>
        u.file === file ? { ...u, progress: 30 } : u
      ));

      const encryptionKey = generateEncryptionKey();
      safeSetUploads(prev => prev.map(u =>
        u.file === file ? { ...u, progress: 40 } : u
      ));

      const fileData = await fileToUint8Array(file);
      safeSetUploads(prev => prev.map(u =>
        u.file === file ? { ...u, status: 'encrypting', progress: 50 } : u
      ));

      const { encryptedData, nonce } = encryptFile(fileData, encryptionKey.key);

      const encryptedDataWithNonce = new Uint8Array(nonce.length + encryptedData.length);
      encryptedDataWithNonce.set(nonce, 0);
      encryptedDataWithNonce.set(encryptedData, nonce.length);

      safeSetUploads(prev => prev.map(u =>
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
        ...(folderId && { folder_id: folderId }),
      };

      // Create a new AbortController for this specific upload
      const uploadAbortController = new AbortController();

      const result = await uploadFileMutation({
        variables: {
          input: {
            data: JSON.stringify(uploadData),
          },
        },
        refetchQueries: [{ query: GET_MY_STATS }],
        context: {
          fetchOptions: {
            signal: uploadAbortController.signal,
          },
        },
      });

      safeSetUploads(prev => prev.map(u =>
        u.file === file ? { ...u, status: 'completed', progress: 100 } : u
      ));

      if (onUploadComplete) {
        onUploadComplete();
      }

    } catch (err: any) {
      // Don't update state if the error is due to abort
      if (err.name === 'AbortError') {
        return;
      }

      console.error('Upload error:', err);
      const errorMessage = getErrorMessage(err) || 'Upload failed';
      const errorCode = getErrorCode(err);

      // Special handling for files that exist in trash
      if (errorCode === ERROR_CODES.FILE_EXISTS_IN_TRASH || 
          errorMessage.includes('File exists in trash')) {
        safeSetUploads(prev => prev.map(u =>
          u.file === file ? { ...u, status: 'pending' } : u
        ));
        setTrashedFileToRestore(file);
        return;
      }

      safeSetUploads(prev => prev.map(u =>
        u.file === file ? { ...u, status: 'error', error: errorMessage } : u
      ));
    }
  }, [uploadFileMutation, onUploadComplete, validateFile, safeSetUploads, uploads]);

  const handleFiles = useCallback(async (files: File[], folderId?: string) => {
    if (!files || files.length === 0) return;
    for (const file of files) {
      await processFile(file, folderId);
    }
  }, [processFile]);

  const removeUpload = useCallback((file: File) => {
    setUploads(prev => prev.filter(u => u.file !== file));
  }, []);

  const clearCompleted = useCallback(() => {
    setUploads(prev => prev.filter(u => u.status !== 'completed'));
  }, []);

  const markUploadCompleted = useCallback((file: File) => {
    safeSetUploads(prev => prev.map(u =>
      u.file === file ? { ...u, status: 'completed', progress: 100 } : u
    ));
  }, [safeSetUploads]);

  const clearTrashedFileToRestore = useCallback(() => {
    setTrashedFileToRestore(null);
  }, []);

  return {
    uploads,
    handleFiles,
    processFile,
    removeUpload,
    clearCompleted,
    trashedFileToRestore,
    clearTrashedFileToRestore,
    markUploadCompleted,
  };
};