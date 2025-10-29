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
    console.log('[DEBUG] processFile called for:', {
      name: file.name,
      size: file.size,
      type: file.type,
      webkitRelativePath: (file as any).webkitRelativePath,
      lastModified: file.lastModified
    });

    // Check if this file is already being uploaded
    const isAlreadyUploading = uploads.some(u =>
      u.file.name === file.name &&
      u.file.size === file.size &&
      u.file.lastModified === file.lastModified &&
      (u.status === 'pending' || u.status === 'uploading' || u.status === 'encrypting')
    );

    if (isAlreadyUploading) {
      console.log('[DEBUG] File already uploading, skipping:', file.name);
      // Skip this file as it's already being processed
      return;
    }

    // Early check: Try to read a small portion of the file to detect directories/unreadable files
    // before adding to the uploads list
    console.log('[DEBUG] Performing early detection check for:', file.name);
    console.log('[DEBUG] File properties:', {
      size: file.size,
      type: file.type,
      typeIsEmpty: !file.type,
      webkitRelativePath: (file as any).webkitRelativePath,
      webkitRelativePathIsEmpty: !(file as any).webkitRelativePath
    });

    // First check: If this looks like a folder being treated as a file
    const looksLikeFolder = file.size < 1024 && !file.type && !(file as any).webkitRelativePath;
    console.log('[DEBUG] looksLikeFolder check result:', looksLikeFolder, '(size < 1024:', file.size < 1024, '!file.type:', !file.type, '!(webkitRelativePath):', !(file as any).webkitRelativePath, ')');

    if (looksLikeFolder) {
      console.warn('[DEBUG] Detected folder being treated as file, skipping:', file.name, '(size:', file.size, 'type:', file.type, ')');
      return; // Don't add to uploads list at all
    }

    try {
      const testBlob = file.slice(0, 1);
      await testBlob.arrayBuffer();
      console.log('[DEBUG] Early detection passed for:', file.name);
    } catch (testError: any) {
      console.warn('[DEBUG] Skipping unreadable file (likely directory):', file.name, testError);
      return; // Don't add to uploads list at all
    }

    const validationError = validateFile(file);
    if (validationError) {
      console.log('[DEBUG] File validation failed for', file.name, ':', validationError);
      safeSetUploads(prev => [...prev, {
        file,
        progress: 0,
        status: 'error',
        error: validationError,
      }]);
      return;
    }

    console.log('[DEBUG] Adding file to uploads list:', file.name);
    safeSetUploads(prev => [...prev, {
      file,
      progress: 0,
      status: 'pending',
    }]);

    console.log('[DEBUG] Starting upload process for:', file.name);
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

      console.log('[DEBUG] Attempting to read file data for:', file.name);
      let fileData: Uint8Array;
      try {
        fileData = await fileToUint8Array(file);
        console.log('[DEBUG] Successfully read file data for:', file.name, 'size:', fileData.length);
      } catch (fileReadError: any) {
        // Special handling for unreadable files (directories, invalid files from drag-and-drop)
        const errorMessage = fileReadError.message || '';
        console.error('[DEBUG] File read error for', file.name, ':', fileReadError);
        if (errorMessage.includes('could not be found') || 
            errorMessage.includes('File not found') ||
            fileReadError.name === 'NotFoundError' ||
            fileReadError.code === 8) { // NotFoundError code
          console.warn('[DEBUG] Removing unreadable file from uploads:', file.name);
          // Remove from uploads list without showing error
          safeSetUploads(prev => prev.filter(u => u.file !== file));
          return;
        }
        // Re-throw other file reading errors
        throw fileReadError;
      }

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

      console.log('[DEBUG] Upload completed successfully for:', file.name);

      if (onUploadComplete) {
        onUploadComplete();
      }

    } catch (err: any) {
      // Don't update state if the error is due to abort
      if (err.name === 'AbortError') {
        console.log('[DEBUG] Upload aborted for:', file.name);
        return;
      }

      console.error('[DEBUG] Upload error for', file.name, ':', err);
      const errorMessage = getErrorMessage(err) || 'Upload failed';
      const errorCode = getErrorCode(err);

      // Special handling for files that exist in trash
      if (errorCode === ERROR_CODES.FILE_EXISTS_IN_TRASH || 
          errorMessage.includes('File exists in trash')) {
        console.log('[DEBUG] File exists in trash, marking as pending:', file.name);
        safeSetUploads(prev => prev.map(u =>
          u.file === file ? { ...u, status: 'pending' } : u
        ));
        setTrashedFileToRestore(file);
        return;
      }

      console.log('[DEBUG] Setting upload error for:', file.name, 'error:', errorMessage);
      safeSetUploads(prev => prev.map(u =>
        u.file === file ? { ...u, status: 'error', error: errorMessage } : u
      ));
    }
  }, [uploadFileMutation, onUploadComplete, validateFile, safeSetUploads, uploads]);

  const handleFiles = useCallback(async (files: File[], folderId?: string) => {
    if (!files || files.length === 0) return;

    console.log('[DEBUG] handleFiles called with', files.length, 'files:', files.map(f => ({ name: f.name, size: f.size, type: f.type, webkitRelativePath: (f as any).webkitRelativePath })));

    // Deduplicate files based on name, size, and lastModified to avoid showing duplicates in upload pane
    const uniqueFiles = files.filter((file, index, self) =>
      index === self.findIndex(f => f.name === file.name && f.size === file.size && f.lastModified === file.lastModified)
    );

    console.log('[DEBUG] After deduplication:', uniqueFiles.length, 'unique files');

    for (const file of uniqueFiles) {
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