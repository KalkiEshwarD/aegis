import React, { memo, useState } from 'react';
import FileExplorer from '../common/FileExplorer';

const StarredView: React.FC = () => {
  const [viewMode, setViewMode] = useState<'list' | 'tile'>('tile');

  return (
    <FileExplorer
      isStarredMode={true}
      externalViewMode={viewMode}
      onViewModeChange={setViewMode}
    />
  );
};

export default memo(StarredView);
