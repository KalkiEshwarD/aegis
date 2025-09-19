import { useState } from 'react';

export const useDashboardNavigation = () => {
  const [selectedNav, setSelectedNav] = useState('home');
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleNavChange = (navId: string) => {
    setSelectedNav(navId);
    // Reset folder selection when changing navigation
    if (navId !== 'home') {
      setSelectedFolderId(null);
    }
  };

  const handleFolderSelect = (folderId: string | null) => {
    setSelectedFolderId(folderId);
  };

  const triggerRefresh = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  return {
    selectedNav,
    selectedFolderId,
    refreshTrigger,
    handleNavChange,
    handleFolderSelect,
    triggerRefresh,
  };
};