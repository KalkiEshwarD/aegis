import { randomBytes, secretbox } from 'tweetnacl';
import { decodeUTF8, encodeUTF8, encodeBase64, decodeBase64 } from 'tweetnacl-util';
import { EncryptionKey, EncryptedFile } from '../types';

// Generate a random encryption key
export const generateEncryptionKey = (): EncryptionKey => {
  return {
    key: randomBytes(secretbox.keyLength),
    nonce: randomBytes(secretbox.nonceLength)
  };
};

// Encrypt file data
export const encryptFile = (fileData: Uint8Array, key: Uint8Array): { encryptedData: Uint8Array; nonce: Uint8Array } => {
  const nonce = randomBytes(secretbox.nonceLength);
  const encryptedData = secretbox(fileData, nonce, key);
  
  return {
    encryptedData,
    nonce
  };
};

// Decrypt file data
export const decryptFile = (encryptedData: Uint8Array, nonce: Uint8Array, key: Uint8Array): Uint8Array | null => {
  const decryptedData = secretbox.open(encryptedData, nonce, key);
  return decryptedData;
};

// Convert encryption key to base64 for storage
export const encryptionKeyToBase64 = (key: Uint8Array): string => {
  return encodeBase64(key);
};

// Convert base64 to encryption key
export const base64ToEncryptionKey = (base64Key: string): Uint8Array => {
  return decodeBase64(base64Key);
};

// Encrypt a string (for metadata)
export const encryptString = (text: string, key: Uint8Array): { encryptedText: string; nonce: string } => {
  const nonce = randomBytes(secretbox.nonceLength);
  const messageUint8 = decodeUTF8(text);
  const encrypted = secretbox(messageUint8, nonce, key);
  
  return {
    encryptedText: encodeBase64(encrypted),
    nonce: encodeBase64(nonce)
  };
};

// Decrypt a string
export const decryptString = (encryptedText: string, nonceBase64: string, key: Uint8Array): string | null => {
  try {
    const encrypted = decodeBase64(encryptedText);
    const nonce = decodeBase64(nonceBase64);
    const decrypted = secretbox.open(encrypted, nonce, key);
    
    if (!decrypted) return null;
    
    return encodeUTF8(decrypted);
  } catch (error) {
    console.error('Decryption error:', error);
    return null;
  }
};

// Calculate SHA-256 hash of file content
export const calculateFileHash = async (file: File): Promise<string> => {
  const arrayBuffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
};

// Convert file to Uint8Array
export const fileToUint8Array = (file: File): Promise<Uint8Array> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (reader.result instanceof ArrayBuffer) {
        resolve(new Uint8Array(reader.result));
      } else {
        reject(new Error('Failed to read file as ArrayBuffer'));
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file);
  });
};

// Create a downloadable blob from decrypted data
export const createDownloadBlob = (data: Uint8Array, mimeType: string): Blob => {
  return new Blob([data as BlobPart], { type: mimeType });
};

// Download file to user's device
export const downloadFile = (blob: Blob, filename: string): void => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

// Format file size for display
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// Get MIME type from file extension
export const getMimeTypeFromExtension = (filename: string): string => {
  const extension = filename.split('.').pop()?.toLowerCase();
  
  const mimeTypes: { [key: string]: string } = {
    // Images
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
    svg: 'image/svg+xml',
    
    // Documents
    pdf: 'application/pdf',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ppt: 'application/vnd.ms-powerpoint',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    
    // Text
    txt: 'text/plain',
    csv: 'text/csv',
    json: 'application/json',
    xml: 'application/xml',
    
    // Archives
    zip: 'application/zip',
    rar: 'application/x-rar-compressed',
    tar: 'application/x-tar',
    gz: 'application/gzip',
    
    // Media
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    mp4: 'video/mp4',
    avi: 'video/x-msvideo',
    mov: 'video/quicktime'
  };
  
  return mimeTypes[extension || ''] || 'application/octet-stream';
};
