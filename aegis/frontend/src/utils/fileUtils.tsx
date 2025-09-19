import React from 'react';
import {
  InsertDriveFile as FileIcon,
  Image as ImageIcon,
  VideoFile as VideoIcon,
  AudioFile as AudioIcon,
  PictureAsPdf as PdfIcon,
  Archive as ArchiveIcon,
  Code as CodeIcon,
  Description as DocumentIcon,
} from '@mui/icons-material';

export const getFileIcon = (mimeType: string, filename: string): React.ReactElement => {
  const extension = filename.split('.').pop()?.toLowerCase();

  if (mimeType.startsWith('image/')) {
    return <ImageIcon sx={{ fontSize: 48, color: 'primary.main' }} />;
  }

  if (mimeType.startsWith('video/')) {
    return <VideoIcon sx={{ fontSize: 48, color: 'primary.main' }} />;
  }

  if (mimeType.startsWith('audio/')) {
    return <AudioIcon sx={{ fontSize: 48, color: 'primary.main' }} />;
  }

  if (mimeType === 'application/pdf') {
    return <PdfIcon sx={{ fontSize: 48, color: 'primary.main' }} />;
  }

  if (mimeType.includes('zip') || mimeType.includes('rar') || mimeType.includes('7z')) {
    return <ArchiveIcon sx={{ fontSize: 48, color: 'primary.main' }} />;
  }

  if (extension && ['js', 'ts', 'jsx', 'tsx', 'html', 'css', 'scss', 'json', 'xml', 'py', 'java', 'cpp', 'c', 'php', 'rb', 'go', 'rs'].includes(extension)) {
    return <CodeIcon sx={{ fontSize: 48, color: 'primary.main' }} />;
  }

  if (extension && ['doc', 'docx', 'txt', 'rtf', 'odt'].includes(extension)) {
    return <DocumentIcon sx={{ fontSize: 48, color: 'primary.main' }} />;
  }

  return <FileIcon sx={{ fontSize: 48, color: 'primary.main' }} />;
};

export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

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