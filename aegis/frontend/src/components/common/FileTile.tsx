import React from 'react';
import { UserFile } from '../../types/index';

interface FileTileProps {
  file: UserFile;
  onFileClick: (file: UserFile) => void;
  onContextMenu: (event: React.MouseEvent, file: UserFile) => void;
}

export const FileTile: React.FC<FileTileProps> = ({ file, onFileClick, onContextMenu }) => {
  const getFileIcon = (fileName: string) => {
    const extension = fileName.split('.').pop()?.toLowerCase();
    switch (extension) {
      case 'pdf': return '📄';
      case 'doc':
      case 'docx': return '📝';
      case 'jpg':
      case 'jpeg':
      case 'png':
      case 'gif': return '🖼️';
      case 'mp4':
      case 'avi':
      case 'mov': return '🎥';
      case 'mp3':
      case 'wav': return '🎵';
      case 'zip':
      case 'rar': return '📦';
      default: return '📄';
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div
      className="bg-white p-4 rounded-lg shadow hover:shadow-md cursor-pointer transition-shadow"
      onClick={() => onFileClick(file)}
      onContextMenu={(e) => onContextMenu(e, file)}
    >
      <div className="text-4xl mb-2 text-center">{getFileIcon(file.filename)}</div>
      <p className="text-sm font-medium truncate text-center" title={file.filename}>
        {file.filename}
      </p>
      <p className="text-xs text-gray-500 text-center">
        {formatFileSize(file.file?.size_bytes || 0)}
      </p>
      {file.is_starred && (
        <div className="text-yellow-500 text-center mt-1">⭐</div>
      )}
    </div>
  );
};