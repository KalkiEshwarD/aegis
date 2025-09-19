/**
 * Sorting and filtering utilities for cross-stack consistency
 */

import { UserFile } from '../types';

// Sort direction type (mirrors Go SortDirection)
export type SortDirection = 'asc' | 'desc';

// File info interface for sorting/filtering (mirrors Go FileInfo)
export interface FileInfo {
  id: string;
  filename: string;
  size_bytes: number;
  created_at: string;
  updated_at: string;
  mime_type: string;
}

// Filter criteria interface (mirrors Go FilterCriteria)
export interface FilterCriteria {
  filename?: string;
  mime_type?: string;
  min_size?: number;
  max_size?: number;
  date_from?: string;
  date_to?: string;
  mime_type_like?: string;
}

// Sort files by specified field and direction (mirrors Go SortFiles)
export const sortFiles = (files: FileInfo[], sortBy: string, direction: SortDirection): FileInfo[] => {
  if (files.length <= 1) return files;

  const sorted = [...files];

  sorted.sort((a, b) => {
    let aValue: any, bValue: any;

    switch (sortBy.toLowerCase()) {
      case 'name':
      case 'filename':
        aValue = a.filename.toLowerCase();
        bValue = b.filename.toLowerCase();
        break;
      case 'date':
      case 'created_at':
        aValue = new Date(a.created_at).getTime();
        bValue = new Date(b.created_at).getTime();
        break;
      case 'size':
      case 'size_bytes':
        aValue = a.size_bytes;
        bValue = b.size_bytes;
        break;
      case 'updated_at':
        aValue = new Date(a.updated_at).getTime();
        bValue = new Date(b.updated_at).getTime();
        break;
      default:
        // Default to name sorting
        aValue = a.filename.toLowerCase();
        bValue = b.filename.toLowerCase();
    }

    if (direction === 'asc') {
      return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
    } else {
      return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
    }
  });

  return sorted;
};

// Filter files based on criteria (mirrors Go FilterFiles)
export const filterFiles = (files: FileInfo[], criteria: FilterCriteria): FileInfo[] => {
  if (files.length === 0) return files;

  return files.filter(file => matchesCriteria(file, criteria));
};

// Check if file matches filter criteria (mirrors Go matchesCriteria)
const matchesCriteria = (file: FileInfo, criteria: FilterCriteria): boolean => {
  // Filename filter
  if (criteria.filename && criteria.filename.trim() !== '') {
    if (!file.filename.toLowerCase().includes(criteria.filename.toLowerCase())) {
      return false;
    }
  }

  // MIME type exact match
  if (criteria.mime_type && criteria.mime_type.trim() !== '') {
    if (file.mime_type !== criteria.mime_type) {
      return false;
    }
  }

  // MIME type like match
  if (criteria.mime_type_like && criteria.mime_type_like.trim() !== '') {
    if (!file.mime_type.includes(criteria.mime_type_like)) {
      return false;
    }
  }

  // Size filters
  if (criteria.min_size !== undefined && file.size_bytes < criteria.min_size) {
    return false;
  }
  if (criteria.max_size !== undefined && file.size_bytes > criteria.max_size) {
    return false;
  }

  // Date filters
  if (criteria.date_from) {
    const fileDate = new Date(file.created_at);
    const fromDate = new Date(criteria.date_from);
    if (fileDate < fromDate) {
      return false;
    }
  }
  if (criteria.date_to) {
    const fileDate = new Date(file.created_at);
    const toDate = new Date(criteria.date_to);
    if (fileDate > toDate) {
      return false;
    }
  }

  return true;
};

// Paginate files (mirrors Go PaginateFiles)
export const paginateFiles = (files: FileInfo[], page: number, pageSize: number): { items: FileInfo[], total: number } => {
  const safePageSize = pageSize > 0 ? pageSize : 10;
  const safePage = page > 0 ? page : 1;

  const total = files.length;
  const start = (safePage - 1) * safePageSize;
  const end = start + safePageSize;

  if (start >= total) {
    return { items: [], total };
  }

  return {
    items: files.slice(start, Math.min(end, total)),
    total
  };
};

// Search files with text query (mirrors Go SearchFiles)
export const searchFiles = (files: FileInfo[], query: string): FileInfo[] => {
  if (!query || query.trim() === '') {
    return files;
  }

  const lowerQuery = query.toLowerCase();
  return files.filter(file =>
    file.filename.toLowerCase().includes(lowerQuery) ||
    file.mime_type.toLowerCase().includes(lowerQuery)
  );
};

// Combine sorting and filtering (mirrors Go SortAndFilterFiles)
export const sortAndFilterFiles = (
  files: FileInfo[],
  criteria: FilterCriteria,
  sortBy: string,
  direction: SortDirection
): FileInfo[] => {
  // First filter
  const filtered = filterFiles(files, criteria);

  // Then sort
  return sortFiles(filtered, sortBy, direction);
};

// Group files by MIME type (mirrors Go GroupFilesByMimeType)
export const groupFilesByMimeType = (files: FileInfo[]): Record<string, FileInfo[]> => {
  const groups: Record<string, FileInfo[]> = {};

  files.forEach(file => {
    const mimeType = file.mime_type || 'unknown';
    if (!groups[mimeType]) {
      groups[mimeType] = [];
    }
    groups[mimeType].push(file);
  });

  return groups;
};

// Group files by date (mirrors Go GroupFilesByDate)
export const groupFilesByDate = (files: FileInfo[]): Record<string, FileInfo[]> => {
  const groups: Record<string, FileInfo[]> = {};

  files.forEach(file => {
    const date = new Date(file.created_at);
    const dateKey = date.toISOString().split('T')[0]; // YYYY-MM-DD format
    if (!groups[dateKey]) {
      groups[dateKey] = [];
    }
    groups[dateKey].push(file);
  });

  return groups;
};

// File statistics interface (mirrors Go FileStats)
export interface FileStats {
  total_files: number;
  total_size: number;
  average_size: number;
  largest_file?: FileInfo;
  smallest_file?: FileInfo;
  mime_type_count: Record<string, number>;
}

// Calculate file statistics (mirrors Go GetFileStats)
export const getFileStats = (files: FileInfo[]): FileStats => {
  if (files.length === 0) {
    return {
      total_files: 0,
      total_size: 0,
      average_size: 0,
      mime_type_count: {}
    };
  }

  let totalSize = 0;
  let largestFile = files[0];
  let smallestFile = files[0];
  const mimeTypeCount: Record<string, number> = {};

  files.forEach(file => {
    totalSize += file.size_bytes;

    if (file.size_bytes > largestFile.size_bytes) {
      largestFile = file;
    }
    if (file.size_bytes < smallestFile.size_bytes) {
      smallestFile = file;
    }

    mimeTypeCount[file.mime_type] = (mimeTypeCount[file.mime_type] || 0) + 1;
  });

  return {
    total_files: files.length,
    total_size: totalSize,
    average_size: Math.round(totalSize / files.length),
    largest_file: largestFile,
    smallest_file: smallestFile,
    mime_type_count: mimeTypeCount
  };
};

// Convert UserFile to FileInfo for sorting/filtering
export const userFileToFileInfo = (userFile: UserFile): FileInfo => ({
  id: userFile.id,
  filename: userFile.filename,
  size_bytes: userFile.file?.size_bytes || 0,
  created_at: userFile.created_at,
  updated_at: userFile.updated_at,
  mime_type: userFile.mime_type
});

// Convert array of UserFile to FileInfo array
export const userFilesToFileInfo = (userFiles: UserFile[]): FileInfo[] => {
  return userFiles.map(userFileToFileInfo);
};