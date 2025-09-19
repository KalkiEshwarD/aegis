import { useState, useCallback } from 'react';
import { useMutation } from '@apollo/client';
import { DELETE_FILE_MUTATION, DOWNLOAD_FILE_MUTATION } from '../apollo/queries';
import {
  decryptFile,
  base64ToEncryptionKey,
  createDownloadBlob,
  downloadFile,
  extractNonceAndData,
} from '../utils/crypto';
import { UserFile } from '../types';

export const useFileOperations = () => {
  const [downloadingFile, setDownloadingFile] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [deleteFileMutation] = useMutation(DELETE_FILE_MUTATION);
  const [downloadFileMutation] = useMutation(DOWNLOAD_FILE_MUTATION);

  const downloadFileHandler = useCallback(async (file: UserFile) => {
    setDownloadingFile(file.id);
    setError(null);

    try {
      // Validate that we have the encryption key
      if (!file.encryption_key) {
        throw new Error('No encryption key available for this file');
      }

      // Get download URL from server
      const result = await downloadFileMutation({
        variables: { id: file.id },
      });

      const downloadUrl = result.data.downloadFile;

      if (!downloadUrl) {
        throw new Error('No download URL received');
      }

      // Fetch the encrypted file with authentication headers
      const response = await fetch(downloadUrl, {
        credentials: 'include', // Include HttpOnly cookies for authentication
      });

      if (!response.ok) {
        throw new Error('Failed to download file');
      }

      const encryptedDataWithNonce = new Uint8Array(await response.arrayBuffer());

      // Extract nonce and encrypted data
      const { nonce, encryptedData } = extractNonceAndData(encryptedDataWithNonce);

      // Convert base64 encryption key back to Uint8Array
      const encryptionKey = base64ToEncryptionKey(file.encryption_key);

      // Decrypt the file
      const decryptedData = decryptFile(encryptedData, nonce, encryptionKey);

      if (!decryptedData) {
        throw new Error('Failed to decrypt file - invalid key or corrupted data');
      }

      // Create download blob from decrypted data and trigger download
      const blob = createDownloadBlob(decryptedData, file.mime_type);
      downloadFile(blob, file.filename);

    } catch (err: any) {
      console.error('Download error:', err);
      setError(err.message || 'Download failed');
    } finally {
      setDownloadingFile(null);
    }
  }, [downloadFileMutation]);

  const deleteFileHandler = useCallback(async (file: UserFile) => {
    try {
      await deleteFileMutation({
        variables: { id: file.id },
      });
      return true;
    } catch (err: any) {
      console.error('Delete error:', err);
      setError(err.graphQLErrors?.[0]?.message || err.message || 'Delete failed');
      return false;
    }
  }, [deleteFileMutation]);

  return {
    downloadingFile,
    error,
    downloadFile: downloadFileHandler,
    deleteFile: deleteFileHandler,
    clearError: () => setError(null),
  };
};