import React, { memo, useState } from 'react';
import FileExplorer from '../common/FileExplorer';

interface TrashViewProps {
  onFileRestored?: () => void;
  onFileDeleted?: () => void;
}

const TrashView: React.FC<TrashViewProps> = ({ onFileRestored, onFileDeleted }) => {
  const [viewMode, setViewMode] = useState<'list' | 'tile'>('tile');
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [folderPath, setFolderPath] = useState<Array<{id: string, name: string}>>([]);

  const handleFolderClick = (folderId: string, folderName: string) => {
    // Add the current folder to the path
    const newPath = [...folderPath, { id: folderId, name: folderName }];
    setFolderPath(newPath);
    setSelectedFolderId(folderId);
  };

  const handleBreadcrumbClick = (index: number) => {
    if (index === -1) {
      // Root trash
      setFolderPath([]);
      setSelectedFolderId(null);
    } else {
      // Navigate to specific folder in path
      const newPath = folderPath.slice(0, index + 1);
      setFolderPath(newPath);
      setSelectedFolderId(newPath[newPath.length - 1]?.id || null);
    }
  };

  const handleNavigateBack = () => {
    if (folderPath.length > 0) {
      const newPath = folderPath.slice(0, -1);
      setFolderPath(newPath);
      setSelectedFolderId(newPath.length > 0 ? newPath[newPath.length - 1].id : null);
    }
  };

  const canNavigateBack = folderPath.length > 0;

  return (
    <FileExplorer
      folderId={selectedFolderId}
      isTrashMode={true}
      onFileRestored={onFileRestored}
      onFileDeleted={onFileDeleted}
      onFolderClick={handleFolderClick}
      showHeader={true}
      title={selectedFolderId ? 'Trash - Folder Contents' : 'Trash'}
      description={selectedFolderId ? 'Files from deleted folder' : 'Manage your deleted files'}
      showBreadcrumbs={true}
      folderPath={folderPath}
      onBreadcrumbClick={handleBreadcrumbClick}
      canNavigateBack={canNavigateBack}
      onNavigateBack={handleNavigateBack}
      showNewFolderButton={false}
      externalViewMode={viewMode}
      onViewModeChange={setViewMode}
    />
  );
};

export default memo(TrashView);