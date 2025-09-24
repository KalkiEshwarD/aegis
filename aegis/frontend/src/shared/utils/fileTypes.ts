/**
 * Centralized file type detection and categorization utilities
 */

export type FileCategory = 'image' | 'video' | 'audio' | 'document' | 'archive' | 'code' | 'other';

// Get file extension from filename
export const getFileExtension = (filename: string): string => {
  const lastDot = filename.lastIndexOf('.');
  if (lastDot === -1 || lastDot === filename.length - 1) {
    return '';
  }
  return filename.substring(lastDot + 1).toLowerCase();
};

// Get file category based on extension
export const getFileCategory = (filename: string): FileCategory => {

  if (isImageFile(filename)) return 'image';
  if (isVideoFile(filename)) return 'video';
  if (isAudioFile(filename)) return 'audio';
  if (isDocumentFile(filename)) return 'document';
  if (isArchiveFile(filename)) return 'archive';
  if (isCodeFile(filename)) return 'code';

  return 'other';
};

// Check if file is an image
export const isImageFile = (filename: string): boolean => {
  const ext = getFileExtension(filename);
  const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg', 'ico'];
  return imageExtensions.includes(ext);
};

// Check if file is a video
export const isVideoFile = (filename: string): boolean => {
  const ext = getFileExtension(filename);
  const videoExtensions = ['mp4', 'avi', 'mov', 'wmv', 'flv', 'webm', 'mkv', 'm4v'];
  return videoExtensions.includes(ext);
};

// Check if file is an audio file
export const isAudioFile = (filename: string): boolean => {
  const ext = getFileExtension(filename);
  const audioExtensions = ['mp3', 'wav', 'flac', 'aac', 'ogg', 'wma', 'm4a'];
  return audioExtensions.includes(ext);
};

// Check if file is a document
export const isDocumentFile = (filename: string): boolean => {
  const ext = getFileExtension(filename);
  const documentExtensions = ['pdf', 'doc', 'docx', 'txt', 'rtf', 'odt'];
  return documentExtensions.includes(ext);
};

// Check if file is an archive
export const isArchiveFile = (filename: string): boolean => {
  const ext = getFileExtension(filename);
  const archiveExtensions = ['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz'];
  return archiveExtensions.includes(ext);
};

// Check if file is a code file
export const isCodeFile = (filename: string): boolean => {
  const ext = getFileExtension(filename);
  const codeExtensions = ['js', 'ts', 'jsx', 'tsx', 'py', 'java', 'c', 'cpp', 'h', 'cs', 'php', 'rb', 'go', 'rs', 'swift', 'kt', 'scala', 'html', 'css', 'scss', 'sass', 'less', 'json', 'xml', 'yaml', 'yml', 'md', 'sql'];
  return codeExtensions.includes(ext);
};

// Get MIME type category
export const getMimeTypeCategory = (mimeType: string): FileCategory => {
  if (!mimeType) return 'other';

  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  if (mimeType === 'application/pdf' || mimeType.startsWith('text/')) return 'document';
  if (mimeType.includes('zip') || mimeType.includes('rar') || mimeType.includes('tar')) return 'archive';

  return 'other';
};

// Get file icon name based on category
export const getFileIconName = (filename: string): string => {
  const category = getFileCategory(filename);

  switch (category) {
    case 'image': return 'image';
    case 'video': return 'video';
    case 'audio': return 'audio';
    case 'document': return 'document';
    case 'archive': return 'archive';
    case 'code': return 'code';
    default: return 'file';
  }
};

// Get display name for file category
export const getCategoryDisplayName = (category: FileCategory): string => {
  switch (category) {
    case 'image': return 'Image';
    case 'video': return 'Video';
    case 'audio': return 'Audio';
    case 'document': return 'Document';
    case 'archive': return 'Archive';
    case 'code': return 'Code';
    default: return 'File';
  }
};