import { useState, useMemo, useCallback } from 'react';
import { UserFile, FileFilterInput } from '../types';

type SortOption = 'name' | 'date' | 'size';
type SortDirection = 'asc' | 'desc';

export const useFileSorting = (files: UserFile[] | undefined) => {
  const [filter, setFilter] = useState<FileFilterInput>({});
  const [sortBy, setSortBy] = useState<SortOption>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const sortedFiles = useMemo(() => {
    if (!files) return [];

    // Filter out null/undefined items to prevent map errors
    const validFiles = files.filter(file => file != null);

    return [...validFiles].sort((a, b) => {
      let aValue: any, bValue: any;

      switch (sortBy) {
        case 'name':
          aValue = a.filename.toLowerCase();
          bValue = b.filename.toLowerCase();
          break;
        case 'date':
          aValue = new Date(a.created_at).getTime();
          bValue = new Date(b.created_at).getTime();
          break;
        case 'size':
          aValue = a.file?.size_bytes || 0;
          bValue = b.file?.size_bytes || 0;
          break;
        default:
          return 0;
      }

      if (sortDirection === 'asc') {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      }
    });
  }, [files, sortBy, sortDirection]);

  const handleFilterChange = useCallback((field: keyof FileFilterInput, value: string) => {
    setFilter(prev => ({
      ...prev,
      [field]: value || undefined,
    }));
  }, []);

  const handleSortChange = useCallback((value: SortOption) => {
    setSortBy(value);
  }, []);

  const toggleSortDirection = useCallback(() => {
    setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
  }, []);

  return {
    filter,
    sortBy,
    sortDirection,
    sortedFiles,
    handleFilterChange,
    handleSortChange,
    toggleSortDirection,
  };
};