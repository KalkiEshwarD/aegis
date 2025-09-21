import { useState, useCallback } from 'react';
import { useMutation } from '@apollo/client';
import { DELETE_FILE_MUTATION, DOWNLOAD_FILE_MUTATION, GET_MY_STATS, GET_MY_FILES, GET_MY_TRASHED_FILES, CREATE_FILE_SHARE_MUTATION, ACCESS_SHARED_FILE_MUTATION } from '../apollo/queries';
import {
  decryptFile,
  base64ToEncryptionKey,
  createDownloadBlob,
  downloadFile,
  extractNonceAndData,
} from '../utils/crypto';
import { UserFile, CreateFileShareInput } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { getErrorMessage, getErrorCode } from '../utils/errorHandling';

export const useFileOperations = () => {
  const { token } = useAuth();
  const [downloadingFile, setDownloadingFile] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [deleteFileMutation] = useMutation(DELETE_FILE_MUTATION);
  const [downloadFileMutation] = useMutation(DOWNLOAD_FILE_MUTATION);
  const [createFileShareMutation] = useMutation(CREATE_FILE_SHARE_MUTATION);

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
        headers: {
          'Authorization': token ? `Bearer ${token}` : '',
        },
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
      const errorMessage = getErrorMessage(err) || 'Download failed';
      const errorCode = getErrorCode(err);

      // Provide more specific error messages based on error code
      let displayMessage = errorMessage;
      if (errorCode === 'authentication_error') {
        displayMessage = 'Authentication required. Please log in again.';
      } else if (errorCode === 'permission_error') {
        displayMessage = 'Permission denied. You may not have access to download this file.';
      } else if (errorCode === 'not_found') {
        displayMessage = 'File not found. It may have been deleted.';
      } else if (errorCode === 'network_error') {
        displayMessage = 'Network error. Please check your connection and try again.';
      }

      setError(displayMessage);
    } finally {
      setDownloadingFile(null);
    }
  }, [downloadFileMutation]);

  const deleteFileHandler = useCallback(async (file: UserFile) => {
    try {
      await deleteFileMutation({
        variables: { id: file.id },
        refetchQueries: [
          { query: GET_MY_STATS },
          { query: GET_MY_FILES },
          { query: GET_MY_TRASHED_FILES }
        ],
      });
      return true;
    } catch (err: any) {
      console.error('Delete error:', err);
      const errorMessage = getErrorMessage(err) || 'Delete failed';
      const errorCode = getErrorCode(err);

      // Provide more specific error messages based on error code
      let displayMessage = errorMessage;
      if (errorCode === 'authentication_error') {
        displayMessage = 'Authentication required. Please log in again.';
      } else if (errorCode === 'permission_error') {
        displayMessage = 'Permission denied. You may not have access to delete this file.';
      } else if (errorCode === 'not_found') {
        displayMessage = 'File not found. It may have already been deleted.';
      }

      setError(displayMessage);
      return false;
    }
  }, [deleteFileMutation]);

  const createShareHandler = useCallback(async (input: CreateFileShareInput) => {
    try {
      const result = await createFileShareMutation({
        variables: { input },
      });
      return result.data?.createFileShare;
    } catch (err: any) {
      console.error('Create share error:', err);
      const errorMessage = getErrorMessage(err) || 'Create share failed';
      setError(errorMessage);
      return null;
    }
  }, [createFileShareMutation]);

  return {
    downloadingFile,
    error,
    downloadFile: downloadFileHandler,
    deleteFile: deleteFileHandler,
    createShare: createShareHandler,
    clearError: () => setError(null),
  };
};