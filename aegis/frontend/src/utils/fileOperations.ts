/**
 * File operation utilities for cross-stack consistency
 */

import { formatFileSize } from './fileUtils';

// File operation result interface (mirrors Go FileOperationResult)
export interface FileOperationResult<T = any> {
  success: boolean;
  message: string;
  data?: T;
}

// File metadata interface (mirrors Go FileMetadata)
export interface FileMetadata {
  filename: string;
  size: number;
  mime_type: string;
  extension: string;
  hash?: string;
  created_at: Date;
  modified_at: Date;
}

// Calculate file hash (SHA-256) (mirrors Go CalculateFileHash)
export const calculateFileHash = async (file: File): Promise<string> => {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

// Calculate MD5 hash (mirrors Go CalculateMD5Hash)
export const calculateMD5Hash = async (file: File): Promise<string> => {
  // Note: MD5 is not available in Web Crypto API for security reasons
  // This is a simple implementation for demonstration
  const buffer = await file.arrayBuffer();
  let hash = 0;
  const data = new Uint8Array(buffer);

  for (let i = 0; i < data.length; i++) {
    const char = data[i];
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }

  return Math.abs(hash).toString(16);
};

// Detect MIME type from file (mirrors Go DetectMimeType)
export const detectMimeType = (file: File): string => {
  return file.type || 'application/octet-stream';
};

// Get file extension (mirrors Go GetFileExtension)
export const getFileExtension = (filename: string): string => {
  const lastDot = filename.lastIndexOf('.');
  return lastDot === -1 ? '' : filename.substring(lastDot).toLowerCase();
};

// Check if file extension is valid (mirrors Go IsValidFileExtension)
export const isValidFileExtension = (filename: string, allowedExtensions: string[]): boolean => {
  const ext = getFileExtension(filename);
  if (!ext) return false;

  const extWithoutDot = ext.substring(1);
  return allowedExtensions.some(allowed =>
    allowed.replace('.', '').toLowerCase() === extWithoutDot
  );
};

// Check if MIME type is valid (mirrors Go IsValidMimeType)
export const isValidMimeType = (mimeType: string, allowedTypes: string[]): boolean => {
  return allowedTypes.some(allowed => mimeType.startsWith(allowed));
};

// Generate unique filename (mirrors Go GenerateUniqueFilename)
export const generateUniqueFilename = (originalFilename: string): string => {
  const ext = getFileExtension(originalFilename);
  const name = originalFilename.replace(ext, '');
  const timestamp = Date.now();
  return `${name}_${timestamp}${ext}`;
};

// Validate file size (mirrors Go ValidateFileSize)
export const validateFileSize = (size: number, minSize: number, maxSize: number): boolean => {
  return size >= minSize && size <= maxSize;
};

// Get file category (mirrors Go GetFileCategory)
export const getFileCategory = (mimeType: string): string => {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  if (mimeType.startsWith('text/')) return 'document';
  if (mimeType.includes('pdf')) return 'document';
  if (mimeType.includes('zip') || mimeType.includes('rar') || mimeType.includes('7z')) return 'archive';
  if (mimeType.includes('json') || mimeType.includes('xml')) return 'data';
  return 'other';
};

// Type checking functions (mirror Go functions)
export const isTextFile = (mimeType: string): boolean => {
  return mimeType.startsWith('text/') ||
         mimeType === 'application/json' ||
         mimeType === 'application/xml' ||
         mimeType === 'application/javascript';
};

export const isImageFile = (mimeType: string): boolean => {
  return mimeType.startsWith('image/');
};

export const isVideoFile = (mimeType: string): boolean => {
  return mimeType.startsWith('video/');
};

export const isAudioFile = (mimeType: string): boolean => {
  return mimeType.startsWith('audio/');
};

export const isArchiveFile = (mimeType: string): boolean => {
  return mimeType.includes('zip') ||
         mimeType.includes('rar') ||
         mimeType.includes('7z') ||
         mimeType.includes('tar') ||
         mimeType.includes('gzip');
};

// Get file icon type (mirrors Go GetFileIconType)
export const getFileIconType = (mimeType: string, filename: string): string => {
  const category = getFileCategory(mimeType);

  switch (category) {
    case 'image': return 'image';
    case 'video': return 'video';
    case 'audio': return 'audio';
    case 'document':
      if (mimeType.includes('pdf')) return 'pdf';
      return 'document';
    case 'archive': return 'archive';
    case 'data': return 'data';
    default:
      // Check by extension for code files
      const ext = getFileExtension(filename);
      if (ext) {
        const codeExtensions = ['.js', '.ts', '.jsx', '.tsx', '.html', '.css', '.scss', '.json', '.xml', '.py', '.java', '.cpp', '.c', '.php', '.rb', '.go', '.rs'];
        if (codeExtensions.includes(ext)) {
          return 'code';
        }
      }
      return 'file';
  }
};

// Format file size (mirrors Go FormatFileSizeBytes)
export const formatFileSizeBytes = (size: number): string => {
  return formatFileSize(size);
};

// Get file info (mirrors Go GetFileInfo)
export const getFileInfo = (file: File): FileMetadata => {
  return {
    filename: file.name,
    size: file.size,
    mime_type: file.type,
    extension: getFileExtension(file.name),
    created_at: new Date(),
    modified_at: new Date(file.lastModified)
  };
};

// Validate filename (mirrors Go ValidateFilename)
export const validateFilename = (filename: string): { valid: boolean; error?: string } => {
  if (!filename || filename.trim() === '') {
    return { valid: false, error: 'Filename cannot be empty' };
  }

  if (filename.length > 255) {
    return { valid: false, error: 'Filename too long (max 255 characters)' };
  }

  // Check for dangerous characters
  const dangerousChars = ['<', '>', ':', '"', '|', '?', '*', '\x00'];
  for (const char of dangerousChars) {
    if (filename.includes(char)) {
      return { valid: false, error: `Filename contains dangerous character: ${char}` };
    }
  }

  // Check for reserved names (Windows)
  const reservedNames = ['CON', 'PRN', 'AUX', 'NUL', 'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9', 'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'];
  const name = filename.split('.')[0].toUpperCase();
  if (reservedNames.includes(name)) {
    return { valid: false, error: `Filename uses reserved name: ${name}` };
  }

  return { valid: true };
};

// Sanitize path (mirrors Go SanitizePath)
export const sanitizePath = (path: string): string => {
  // Remove dangerous path traversal
  let sanitized = path.replace(/\.\./g, '').replace(/\\/g, '/');

  // Remove leading/trailing slashes
  sanitized = sanitized.replace(/^\/+|\/+$/g, '');

  return sanitized;
};

// Check if path is safe (mirrors Go IsPathSafe)
export const isPathSafe = (path: string): boolean => {
  // Check for path traversal attempts
  if (path.includes('..')) return false;

  // Check for absolute paths
  if (path.startsWith('/') || path.startsWith('\\')) return false;

  // Check for Windows drive letters
  if (path.length >= 3 && path.charAt(1) === ':' && (path.charAt(2) === '\\' || path.charAt(2) === '/')) {
    return false;
  }

  return true;
};

// Read file as text
export const readFileAsText = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
};

// Read file as array buffer
export const readFileAsArrayBuffer = (file: File): Promise<ArrayBuffer> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file);
  });
};

// Read file as data URL
export const readFileAsDataURL = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
};

// Get file preview (for images)
export const getFilePreview = (file: File): Promise<string | null> => {
  if (!isImageFile(file.type)) {
    return Promise.resolve(null);
  }

  return readFileAsDataURL(file);
};

// Check if file is valid for upload
export const validateFileForUpload = (
  file: File,
  options: {
    maxSize?: number;
    allowedTypes?: string[];
    allowedExtensions?: string[];
  } = {}
): { valid: boolean; error?: string } => {
  // Check file size
  if (options.maxSize && file.size > options.maxSize) {
    return {
      valid: false,
      error: `File size ${formatFileSize(file.size)} exceeds maximum size ${formatFileSize(options.maxSize)}`
    };
  }

  // Check MIME type
  if (options.allowedTypes && !isValidMimeType(file.type, options.allowedTypes)) {
    return {
      valid: false,
      error: `File type ${file.type} is not allowed`
    };
  }

  // Check file extension
  if (options.allowedExtensions && !isValidFileExtension(file.name, options.allowedExtensions)) {
    return {
      valid: false,
      error: `File extension is not allowed`
    };
  }

  // Validate filename
  const filenameValidation = validateFilename(file.name);
  if (!filenameValidation.valid) {
    return filenameValidation;
  }

  return { valid: true };
};