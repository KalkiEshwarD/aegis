import {
  sortFiles,
  filterFiles,
  paginateFiles,
  searchFiles,
  sortAndFilterFiles,
  groupFilesByMimeType,
  groupFilesByDate,
  getFileStats,
  userFileToFileInfo,
  userFilesToFileInfo,
  type FileInfo,
  type FilterCriteria,
  type SortDirection,
} from '../../utils/sortingFiltering';
import { UserFile } from '../../types';

// Mock data for testing
const mockFiles: FileInfo[] = [
  {
    id: '1',
    filename: 'document.pdf',
    size_bytes: 1024000,
    created_at: '2023-01-15T10:00:00Z',
    updated_at: '2023-01-15T10:00:00Z',
    mime_type: 'application/pdf',
  },
  {
    id: '2',
    filename: 'image.jpg',
    size_bytes: 2048000,
    created_at: '2023-01-10T10:00:00Z',
    updated_at: '2023-01-10T10:00:00Z',
    mime_type: 'image/jpeg',
  },
  {
    id: '3',
    filename: 'text.txt',
    size_bytes: 512000,
    created_at: '2023-01-20T10:00:00Z',
    updated_at: '2023-01-20T10:00:00Z',
    mime_type: 'text/plain',
  },
  {
    id: '4',
    filename: 'spreadsheet.xlsx',
    size_bytes: 3072000,
    created_at: '2023-01-05T10:00:00Z',
    updated_at: '2023-01-05T10:00:00Z',
    mime_type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  },
];

describe('sortFiles', () => {
  it('should sort files by name ascending', () => {
    const result = sortFiles(mockFiles, 'name', 'asc');
    expect(result[0].filename).toBe('document.pdf');
    expect(result[1].filename).toBe('image.jpg');
    expect(result[2].filename).toBe('spreadsheet.xlsx');
    expect(result[3].filename).toBe('text.txt');
  });

  it('should sort files by name descending', () => {
    const result = sortFiles(mockFiles, 'name', 'desc');
    expect(result[0].filename).toBe('text.txt');
    expect(result[1].filename).toBe('spreadsheet.xlsx');
    expect(result[2].filename).toBe('image.jpg');
    expect(result[3].filename).toBe('document.pdf');
  });

  it('should sort files by size ascending', () => {
    const result = sortFiles(mockFiles, 'size', 'asc');
    expect(result[0].size_bytes).toBe(512000);
    expect(result[1].size_bytes).toBe(1024000);
    expect(result[2].size_bytes).toBe(2048000);
    expect(result[3].size_bytes).toBe(3072000);
  });

  it('should sort files by date ascending', () => {
    const result = sortFiles(mockFiles, 'date', 'asc');
    expect(result[0].created_at).toBe('2023-01-05T10:00:00Z');
    expect(result[1].created_at).toBe('2023-01-10T10:00:00Z');
    expect(result[2].created_at).toBe('2023-01-15T10:00:00Z');
    expect(result[3].created_at).toBe('2023-01-20T10:00:00Z');
  });

  it('should sort files by updated_at', () => {
    const result = sortFiles(mockFiles, 'updated_at', 'desc');
    expect(result[0].updated_at).toBe('2023-01-20T10:00:00Z');
    expect(result[1].updated_at).toBe('2023-01-15T10:00:00Z');
    expect(result[2].updated_at).toBe('2023-01-10T10:00:00Z');
    expect(result[3].updated_at).toBe('2023-01-05T10:00:00Z');
  });

  it('should return original array for single file', () => {
    const singleFile = [mockFiles[0]];
    const result = sortFiles(singleFile, 'name', 'asc');
    expect(result).toEqual(singleFile);
  });

  it('should return original array for empty array', () => {
    const result = sortFiles([], 'name', 'asc');
    expect(result).toEqual([]);
  });

  it('should default to name sorting for unknown sortBy', () => {
    const result = sortFiles(mockFiles, 'unknown', 'asc');
    expect(result[0].filename).toBe('document.pdf');
  });
});

describe('filterFiles', () => {
  it('should filter by filename', () => {
    const criteria: FilterCriteria = { filename: 'doc' };
    const result = filterFiles(mockFiles, criteria);
    expect(result).toHaveLength(1);
    expect(result[0].filename).toBe('document.pdf');
  });

  it('should filter by exact MIME type', () => {
    const criteria: FilterCriteria = { mime_type: 'image/jpeg' };
    const result = filterFiles(mockFiles, criteria);
    expect(result).toHaveLength(1);
    expect(result[0].mime_type).toBe('image/jpeg');
  });

  it('should filter by MIME type like', () => {
    const criteria: FilterCriteria = { mime_type_like: 'application' };
    const result = filterFiles(mockFiles, criteria);
    expect(result).toHaveLength(2);
    expect(result.every(f => f.mime_type.includes('application'))).toBe(true);
  });

  it('should filter by size range', () => {
    const criteria: FilterCriteria = { min_size: 1000000, max_size: 3000000 };
    const result = filterFiles(mockFiles, criteria);
    expect(result).toHaveLength(2);
    expect(result.every(f => f.size_bytes >= 1000000 && f.size_bytes <= 3000000)).toBe(true);
  });

  it('should filter by date range', () => {
    const criteria: FilterCriteria = {
      date_from: '2023-01-12T00:00:00Z',
      date_to: '2023-01-18T00:00:00Z'
    };
    const result = filterFiles(mockFiles, criteria);
    expect(result).toHaveLength(1);
    expect(result[0].filename).toBe('document.pdf');
  });

  it('should return all files for empty criteria', () => {
    const result = filterFiles(mockFiles, {});
    expect(result).toEqual(mockFiles);
  });

  it('should return empty array for empty input', () => {
    const result = filterFiles([], { filename: 'test' });
    expect(result).toEqual([]);
  });

  it('should handle case-insensitive filename search', () => {
    const criteria: FilterCriteria = { filename: 'DOC' };
    const result = filterFiles(mockFiles, criteria);
    expect(result).toHaveLength(1);
    expect(result[0].filename).toBe('document.pdf');
  });
});

describe('paginateFiles', () => {
  it('should paginate files correctly', () => {
    const result = paginateFiles(mockFiles, 1, 2);
    expect(result.items).toHaveLength(2);
    expect(result.total).toBe(4);
    expect(result.items[0].filename).toBe('document.pdf');
    expect(result.items[1].filename).toBe('image.jpg');
  });

  it('should handle second page', () => {
    const result = paginateFiles(mockFiles, 2, 2);
    expect(result.items).toHaveLength(2);
    expect(result.total).toBe(4);
    expect(result.items[0].filename).toBe('text.txt');
    expect(result.items[1].filename).toBe('spreadsheet.xlsx');
  });

  it('should handle page beyond available data', () => {
    const result = paginateFiles(mockFiles, 10, 2);
    expect(result.items).toHaveLength(0);
    expect(result.total).toBe(4);
  });

  it('should default to page 1 for invalid page', () => {
    const result = paginateFiles(mockFiles, 0, 2);
    expect(result.items).toHaveLength(2);
    expect(result.items[0].filename).toBe('document.pdf');
  });

  it('should default to page size 10 for invalid pageSize', () => {
    const result = paginateFiles(mockFiles, 1, 0);
    expect(result.items).toHaveLength(4);
    expect(result.total).toBe(4);
  });
});

describe('searchFiles', () => {
  it('should search by filename', () => {
    const result = searchFiles(mockFiles, 'doc');
    expect(result).toHaveLength(1);
    expect(result[0].filename).toBe('document.pdf');
  });

  it('should search by MIME type', () => {
    const result = searchFiles(mockFiles, 'jpeg');
    expect(result).toHaveLength(1);
    expect(result[0].mime_type).toBe('image/jpeg');
  });

  it('should be case-insensitive', () => {
    const result = searchFiles(mockFiles, 'PDF');
    expect(result).toHaveLength(1);
    expect(result[0].filename).toBe('document.pdf');
  });

  it('should return all files for empty query', () => {
    const result = searchFiles(mockFiles, '');
    expect(result).toEqual(mockFiles);
  });

  it('should return all files for whitespace query', () => {
    const result = searchFiles(mockFiles, '   ');
    expect(result).toEqual(mockFiles);
  });

  it('should return empty array for no matches', () => {
    const result = searchFiles(mockFiles, 'nonexistent');
    expect(result).toHaveLength(0);
  });
});

describe('sortAndFilterFiles', () => {
  it('should combine filtering and sorting', () => {
    const criteria: FilterCriteria = { mime_type_like: 'application' };
    const result = sortAndFilterFiles(mockFiles, criteria, 'size', 'desc');
    expect(result).toHaveLength(2);
    expect(result[0].filename).toBe('spreadsheet.xlsx'); // larger file first
    expect(result[1].filename).toBe('document.pdf');
  });

  it('should handle empty results after filtering', () => {
    const criteria: FilterCriteria = { filename: 'nonexistent' };
    const result = sortAndFilterFiles(mockFiles, criteria, 'name', 'asc');
    expect(result).toHaveLength(0);
  });
});

describe('groupFilesByMimeType', () => {
  it('should group files by MIME type', () => {
    const result = groupFilesByMimeType(mockFiles);
    expect(Object.keys(result)).toHaveLength(4);
    expect(result['application/pdf']).toHaveLength(1);
    expect(result['image/jpeg']).toHaveLength(1);
    expect(result['text/plain']).toHaveLength(1);
    expect(result['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']).toHaveLength(1);
  });

  it('should handle files with unknown MIME type', () => {
    const filesWithUnknown = [...mockFiles, {
      id: '5',
      filename: 'unknown',
      size_bytes: 1000,
      created_at: '2023-01-01T00:00:00Z',
      updated_at: '2023-01-01T00:00:00Z',
      mime_type: '',
    }];
    const result = groupFilesByMimeType(filesWithUnknown);
    expect(result['unknown']).toHaveLength(1);
  });

  it('should return empty object for empty array', () => {
    const result = groupFilesByMimeType([]);
    expect(result).toEqual({});
  });
});

describe('groupFilesByDate', () => {
  it('should group files by date', () => {
    const result = groupFilesByDate(mockFiles);
    expect(Object.keys(result)).toHaveLength(4);
    expect(result['2023-01-15']).toHaveLength(1);
    expect(result['2023-01-10']).toHaveLength(1);
    expect(result['2023-01-20']).toHaveLength(1);
    expect(result['2023-01-05']).toHaveLength(1);
  });

  it('should handle multiple files on same date', () => {
    const filesSameDate = [...mockFiles, {
      ...mockFiles[0],
      id: '5',
    }];
    const result = groupFilesByDate(filesSameDate);
    expect(result['2023-01-15']).toHaveLength(2);
  });

  it('should return empty object for empty array', () => {
    const result = groupFilesByDate([]);
    expect(result).toEqual({});
  });
});

describe('getFileStats', () => {
  it('should calculate correct statistics', () => {
    const result = getFileStats(mockFiles);
    expect(result.total_files).toBe(4);
    expect(result.total_size).toBe(6635000);
    expect(result.average_size).toBe(1658750);
    expect(result.largest_file?.filename).toBe('spreadsheet.xlsx');
    expect(result.smallest_file?.filename).toBe('text.txt');
    expect(result.mime_type_count['application/pdf']).toBe(1);
    expect(result.mime_type_count['image/jpeg']).toBe(1);
    expect(result.mime_type_count['text/plain']).toBe(1);
    expect(result.mime_type_count['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']).toBe(1);
  });

  it('should handle empty array', () => {
    const result = getFileStats([]);
    expect(result.total_files).toBe(0);
    expect(result.total_size).toBe(0);
    expect(result.average_size).toBe(0);
    expect(result.largest_file).toBeUndefined();
    expect(result.smallest_file).toBeUndefined();
    expect(result.mime_type_count).toEqual({});
  });

  it('should handle single file', () => {
    const result = getFileStats([mockFiles[0]]);
    expect(result.total_files).toBe(1);
    expect(result.total_size).toBe(1024000);
    expect(result.average_size).toBe(1024000);
    expect(result.largest_file?.filename).toBe('document.pdf');
    expect(result.smallest_file?.filename).toBe('document.pdf');
  });
});

describe('userFileToFileInfo', () => {
  it('should convert UserFile to FileInfo', () => {
    const mockUserFile: UserFile = {
      id: '1',
      user_id: 'user1',
      file_id: 'file1',
      filename: 'test.pdf',
      mime_type: 'application/pdf',
      encryption_key: 'test-key',
      created_at: '2023-01-01T00:00:00Z',
      updated_at: '2023-01-01T00:00:00Z',
      file: {
        id: 'file1',
        size_bytes: 1024,
        content_hash: 'hash123',
        created_at: '2023-01-01T00:00:00Z',
      },
      user: {
        id: 'user1',
        username: 'testuser',
        email: 'testuser@example.com',
        storage_quota: 1000000000,
        used_storage: 1024,
        is_admin: false,
        created_at: '2023-01-01T00:00:00Z',
      },
    };

    const result = userFileToFileInfo(mockUserFile);
    expect(result.id).toBe('1');
    expect(result.filename).toBe('test.pdf');
    expect(result.size_bytes).toBe(1024);
    expect(result.created_at).toBe('2023-01-01T00:00:00Z');
    expect(result.updated_at).toBe('2023-01-01T00:00:00Z');
    expect(result.mime_type).toBe('application/pdf');
  });

  it('should handle UserFile without file property', () => {
    const mockUserFile: UserFile = {
      id: '1',
      user_id: 'user1',
      file_id: 'file1',
      filename: 'test.pdf',
      mime_type: 'application/pdf',
      encryption_key: 'test-key',
      created_at: '2023-01-01T00:00:00Z',
      updated_at: '2023-01-01T00:00:00Z',
      user: {
        id: 'user1',
        username: 'testuser',
        email: 'testuser@example.com',
        storage_quota: 1000000000,
        used_storage: 0,
        is_admin: false,
        created_at: '2023-01-01T00:00:00Z',
      },
    };

    const result = userFileToFileInfo(mockUserFile);
    expect(result.size_bytes).toBe(0);
  });
});

describe('userFilesToFileInfo', () => {
  it('should convert array of UserFile to FileInfo array', () => {
    const mockUserFiles: UserFile[] = [
      {
        id: '1',
        user_id: 'user1',
        file_id: 'file1',
        filename: 'test1.pdf',
        mime_type: 'application/pdf',
        encryption_key: 'test-key1',
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z',
        file: { id: 'file1', size_bytes: 1024, content_hash: 'hash1', created_at: '2023-01-01T00:00:00Z' },
        user: { 
          id: 'user1', 
          username: 'testuser',
          email: 'testuser@example.com',
          storage_quota: 1000000000,
          used_storage: 1024,
          is_admin: false,
          created_at: '2023-01-01T00:00:00Z',
        },
      },
      {
        id: '2',
        user_id: 'user1',
        file_id: 'file2',
        filename: 'test2.txt',
        mime_type: 'text/plain',
        encryption_key: 'test-key2',
        created_at: '2023-01-02T00:00:00Z',
        updated_at: '2023-01-02T00:00:00Z',
        file: { id: 'file2', size_bytes: 2048, content_hash: 'hash2', created_at: '2023-01-02T00:00:00Z' },
        user: { 
          id: 'user1', 
          username: 'testuser',
          email: 'testuser@example.com',
          storage_quota: 1000000000,
          used_storage: 3072,
          is_admin: false,
          created_at: '2023-01-01T00:00:00Z',
        },
      },
    ];

    const result = userFilesToFileInfo(mockUserFiles);
    expect(result).toHaveLength(2);
    expect(result[0].filename).toBe('test1.pdf');
    expect(result[1].filename).toBe('test2.txt');
  });

  it('should handle empty array', () => {
    const result = userFilesToFileInfo([]);
    expect(result).toEqual([]);
  });
});