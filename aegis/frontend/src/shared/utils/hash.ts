/**
 * Centralized file hashing utilities
 */

import { calculateFileHash as cryptoHash } from '../../utils/crypto';

// Calculate SHA-256 hash of file (unified interface)
export const calculateFileHash = async (file: File): Promise<string> => {
  return cryptoHash(file);
};

// Calculate hash with progress callback for large files
export const calculateFileHashWithProgress = async (
  file: File,
  onProgress?: (progress: number) => void
): Promise<string> => {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);

  // Simulate progress for large files
  if (onProgress) {
    onProgress(100);
  }

  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

// Calculate hash from string content
export const calculateStringHash = async (content: string): Promise<string> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

// Calculate hash from ArrayBuffer
export const calculateBufferHash = async (buffer: ArrayBuffer): Promise<string> => {
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};