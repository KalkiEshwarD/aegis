import React, { memo, useState } from 'react';
import FileExplorer from '../common/FileExplorer';
import { useDashboardNavigation } from '../../hooks/useDashboardNavigation';

const StarredView: React.FC = () => {
  const [viewMode, setViewMode] = useState<'list' | 'tile'>('tile');

  const {
    selectedFolderId,
    folderPath,
    canNavigateBack,
    handleFolderSelect,
    handleNavigateBack,
    handleBreadcrumbClick,
  } = useDashboardNavigation();

  return (
    <FileExplorer
      isStarredMode={true}
      folderId={selectedFolderId}
      onFolderClick={handleFolderSelect}
      folderPath={folderPath}
      onBreadcrumbClick={handleBreadcrumbClick}
      canNavigateBack={canNavigateBack}
      onNavigateBack={handleNavigateBack}
      externalViewMode={viewMode}
      onViewModeChange={setViewMode}
    />
  );
};

export default memo(StarredView);
