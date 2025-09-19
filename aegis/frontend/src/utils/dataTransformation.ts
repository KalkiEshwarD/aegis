/**
 * Data transformation utilities for cross-stack consistency
 */

// Format file size in human readable format (mirrors Go FormatFileSize)
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// Get MIME type from file extension (mirrors Go GetMimeTypeFromExtension)
export const getMimeTypeFromExtension = (filename: string): string => {
  const extension = filename.split('.').pop()?.toLowerCase();

  const mimeTypes: { [key: string]: string } = {
    'txt': 'text/plain',
    'html': 'text/html',
    'css': 'text/css',
    'js': 'application/javascript',
    'json': 'application/json',
    'xml': 'application/xml',
    'pdf': 'application/pdf',
    'doc': 'application/msword',
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'xls': 'application/vnd.ms-excel',
    'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'ppt': 'application/vnd.ms-powerpoint',
    'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'bmp': 'image/bmp',
    'svg': 'image/svg+xml',
    'mp4': 'video/mp4',
    'avi': 'video/x-msvideo',
    'mov': 'video/quicktime',
    'wmv': 'video/x-ms-wmv',
    'mp3': 'audio/mpeg',
    'wav': 'audio/wav',
    'flac': 'audio/flac',
    'zip': 'application/zip',
    'rar': 'application/x-rar-compressed',
    '7z': 'application/x-7z-compressed',
    'tar': 'application/x-tar',
    'gz': 'application/gzip',
  };

  return mimeTypes[extension || ''] || 'application/octet-stream';
};

// Check if MIME type is an image (mirrors Go IsImageMimeType)
export const isImageMimeType = (mimeType: string): boolean => {
  return mimeType.startsWith('image/');
};

// Check if MIME type is a video (mirrors Go IsVideoMimeType)
export const isVideoMimeType = (mimeType: string): boolean => {
  return mimeType.startsWith('video/');
};

// Check if MIME type is an audio (mirrors Go IsAudioMimeType)
export const isAudioMimeType = (mimeType: string): boolean => {
  return mimeType.startsWith('audio/');
};

// Check if MIME type is an archive (mirrors Go IsArchiveMimeType)
export const isArchiveMimeType = (mimeType: string): boolean => {
  const archiveTypes = ['zip', 'rar', '7z', 'tar', 'gzip', 'x-tar', 'x-rar-compressed', 'x-7z-compressed'];
  return archiveTypes.some(type => mimeType.includes(type));
};

// Check if file is a code file (mirrors Go IsCodeFile)
export const isCodeFile = (filename: string): boolean => {
  const extension = filename.split('.').pop()?.toLowerCase();
  if (!extension) return false;

  const codeExtensions = ['js', 'ts', 'jsx', 'tsx', 'html', 'css', 'scss', 'json', 'xml', 'py', 'java', 'cpp', 'c', 'php', 'rb', 'go', 'rs'];
  return codeExtensions.includes(extension);
};

// Check if file is a document (mirrors Go IsDocumentFile)
export const isDocumentFile = (filename: string): boolean => {
  const extension = filename.split('.').pop()?.toLowerCase();
  if (!extension) return false;

  const docExtensions = ['doc', 'docx', 'txt', 'rtf', 'odt'];
  return docExtensions.includes(extension);
};

// Safe parsing functions (mirrors Go ParseInt64, ParseFloat64)
export const parseInt64 = (s: string): number => {
  if (!s || s.trim() === '') return 0;
  const parsed = parseInt(s, 10);
  return isNaN(parsed) ? 0 : parsed;
};

export const parseFloat64 = (s: string): number => {
  if (!s || s.trim() === '') return 0.0;
  const parsed = parseFloat(s);
  return isNaN(parsed) ? 0.0 : parsed;
};

// Timestamp formatting (mirrors Go FormatTimestamp, ParseTimestamp)
export const formatTimestamp = (date: Date): string => {
  return date.toISOString();
};

export const parseTimestamp = (s: string): Date | null => {
  if (!s || s.trim() === '') return null;
  const date = new Date(s);
  return isNaN(date.getTime()) ? null : date;
};

// String manipulation utilities (mirrors Go functions)
export const truncateString = (s: string, maxLength: number): string => {
  if (s.length <= maxLength) return s;
  if (maxLength <= 3) return s.substring(0, maxLength);
  return s.substring(0, maxLength - 3) + '...';
};

export const slugify = (s: string): string => {
  return s
    .toLowerCase()
    .replace(/[^\w\s-]/g, '') // Remove non-word chars except spaces and hyphens
    .replace(/[\s_-]+/g, '-') // Replace spaces, underscores and multiple hyphens with single hyphen
    .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
};

export const capitalizeFirst = (s: string): string => {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
};

export const camelToSnake = (s: string): string => {
  return s.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
};

export const snakeToCamel = (s: string): string => {
  return s.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
};

// Deep clone utility for objects
export const deepClone = <T>(obj: T): T => {
  if (obj === null || typeof obj !== 'object') return obj;
  if (obj instanceof Date) return new Date(obj.getTime()) as unknown as T;
  if (Array.isArray(obj)) return obj.map(item => deepClone(item)) as unknown as T;

  const clonedObj = {} as T;
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      clonedObj[key] = deepClone(obj[key]);
    }
  }
  return clonedObj;
};

// Safe JSON parsing with fallback
export const safeJsonParse = <T>(jsonString: string, fallback: T): T => {
  try {
    return JSON.parse(jsonString);
  } catch {
    return fallback;
  }
};

// Safe JSON stringify with error handling
export const safeJsonStringify = (obj: any, fallback: string = '{}'): string => {
  try {
    return JSON.stringify(obj);
  } catch {
    return fallback;
  }
};