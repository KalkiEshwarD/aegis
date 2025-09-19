import { useState, useCallback } from 'react';

interface FolderPath {
  id: string | null;
  name: string;
}

export const useDashboardNavigation = () => {
  const [selectedNav, setSelectedNav] = useState('home');
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [folderPath, setFolderPath] = useState<FolderPath[]>([{ id: null, name: 'Home' }]);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleNavChange = (navId: string) => {
    setSelectedNav(navId);
    // Reset folder selection when changing navigation
    if (navId !== 'home') {
      setSelectedFolderId(null);
      setFolderPath([{ id: null, name: 'Home' }]);
    }
  };

  const handleFolderSelect = useCallback((folderId: string | null, folderName?: string) => {
    setSelectedFolderId(folderId);
    
    if (folderId === null) {
      // Going to root
      setFolderPath([{ id: null, name: 'Home' }]);
    } else if (folderName) {
      // Navigate into folder - add to path
      setFolderPath(prev => [...prev, { id: folderId, name: folderName }]);
    }
  }, []);

  const handleNavigateBack = useCallback(() => {
    if (folderPath.length > 1) {
      const newPath = folderPath.slice(0, -1);
      setFolderPath(newPath);
      const parentFolder = newPath[newPath.length - 1];
      setSelectedFolderId(parentFolder.id);
    }
  }, [folderPath]);

  const handleBreadcrumbClick = useCallback((index: number) => {
    if (index < folderPath.length - 1) {
      const newPath = folderPath.slice(0, index + 1);
      setFolderPath(newPath);
      const targetFolder = newPath[newPath.length - 1];
      setSelectedFolderId(targetFolder.id);
    }
  }, [folderPath]);

  const triggerRefresh = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  const canNavigateBack = folderPath.length > 1;

  return {
    selectedNav,
    selectedFolderId,
    folderPath,
    canNavigateBack,
    refreshTrigger,
    handleNavChange,
    handleFolderSelect,
    handleNavigateBack,
    handleBreadcrumbClick,
    triggerRefresh,
  };
};