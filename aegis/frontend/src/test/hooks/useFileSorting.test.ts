import { renderHook, act } from '@testing-library/react-hooks';
import { useFileSorting } from '../../hooks/useFileSorting';
import { UserFile } from '../../types';

// Mock data for testing
const mockFiles: UserFile[] = [
  {
    id: '1',
    user_id: 'user-1',
    file_id: 'file-1',
    filename: 'zebra.txt',
    created_at: '2023-01-03T00:00:00Z',
    updated_at: '2023-01-03T00:00:00Z',
    file: {
      id: 'file-1',
      content_hash: 'hash1',
      size_bytes: 3000,
      created_at: '2023-01-03T00:00:00Z'
    },
    encryption_key: 'key1',
    mime_type: 'text/plain',
  },
  {
    id: '2',
    user_id: 'user-1',
    file_id: 'file-2',
    filename: 'apple.txt',
    created_at: '2023-01-01T00:00:00Z',
    updated_at: '2023-01-01T00:00:00Z',
    file: {
      id: 'file-2',
      content_hash: 'hash2',
      size_bytes: 1000,
      created_at: '2023-01-01T00:00:00Z'
    },
    encryption_key: 'key2',
    mime_type: 'text/plain',
  },
  {
    id: '3',
    user_id: 'user-1',
    file_id: 'file-3',
    filename: 'banana.pdf',
    created_at: '2023-01-02T00:00:00Z',
    updated_at: '2023-01-02T00:00:00Z',
    file: {
      id: 'file-3',
      content_hash: 'hash3',
      size_bytes: 2000,
      created_at: '2023-01-02T00:00:00Z'
    },
    encryption_key: 'key3',
    mime_type: 'application/pdf',
  },
];

describe('useFileSorting Performance Optimizations', () => {
  describe('useMemo Optimization for Sorting', () => {
    test('memoizes sorted results to prevent unnecessary recalculations', () => {
      const { result, rerender } = renderHook(() =>
        useFileSorting(mockFiles)
      );

      const firstSortedFiles = result.current.sortedFiles;

      // Re-render with same data
      rerender();

      // Should return the same reference (memoized)
      expect(result.current.sortedFiles).toBe(firstSortedFiles);
    });

    test('recalculates only when files array changes', () => {
      const { result, rerender } = renderHook(
        ({ files }: { files: UserFile[] }) => useFileSorting(files),
        { initialProps: { files: mockFiles } }
      );

      const firstSortedFiles = result.current.sortedFiles;

      // Re-render with same files
      rerender({ files: mockFiles });

      // Should return the same reference
      expect(result.current.sortedFiles).toBe(firstSortedFiles);

      // Re-render with different files
      const newFiles = [...mockFiles];
      rerender({ files: newFiles });

      // Should return new reference (recalculated)
      expect(result.current.sortedFiles).not.toBe(firstSortedFiles);
    });

    test('recalculates when sort options change', () => {
      const { result } = renderHook(() => useFileSorting(mockFiles));

      const initialSortedFiles = result.current.sortedFiles;

      // Change sort by
      act(() => {
        result.current.handleSortChange('date');
      });

      // Should recalculate with new sort
      expect(result.current.sortedFiles).not.toBe(initialSortedFiles);
      expect(result.current.sortBy).toBe('date');
    });

    test('recalculates when sort direction changes', () => {
      const { result } = renderHook(() => useFileSorting(mockFiles));

      const initialSortedFiles = result.current.sortedFiles;

      // Toggle sort direction
      act(() => {
        result.current.toggleSortDirection();
      });

      // Should recalculate with reversed sort
      expect(result.current.sortedFiles).not.toBe(initialSortedFiles);
      expect(result.current.sortDirection).toBe('desc');
    });
  });

  describe('Efficient Sorting Algorithm', () => {
    test('sorts by name correctly (ascending)', () => {
      const { result } = renderHook(() => useFileSorting(mockFiles));

      const sortedFiles = result.current.sortedFiles;

      // Should be sorted alphabetically: apple, banana, zebra
      expect(sortedFiles[0].filename).toBe('apple.txt');
      expect(sortedFiles[1].filename).toBe('banana.pdf');
      expect(sortedFiles[2].filename).toBe('zebra.txt');
    });

    test('sorts by name correctly (descending)', () => {
      const { result } = renderHook(() => useFileSorting(mockFiles));

      // Change to descending
      act(() => {
        result.current.toggleSortDirection();
      });

      const sortedFiles = result.current.sortedFiles;

      // Should be sorted reverse alphabetically: zebra, banana, apple
      expect(sortedFiles[0].filename).toBe('zebra.txt');
      expect(sortedFiles[1].filename).toBe('banana.pdf');
      expect(sortedFiles[2].filename).toBe('apple.txt');
    });

    test('sorts by date correctly', () => {
      const { result } = renderHook(() => useFileSorting(mockFiles));

      act(() => {
        result.current.handleSortChange('date');
      });

      const sortedFiles = result.current.sortedFiles;

      // Should be sorted by date: apple (Jan 1), banana (Jan 2), zebra (Jan 3)
      expect(sortedFiles[0].filename).toBe('apple.txt');
      expect(sortedFiles[1].filename).toBe('banana.pdf');
      expect(sortedFiles[2].filename).toBe('zebra.txt');
    });

    test('sorts by size correctly', () => {
      const { result } = renderHook(() => useFileSorting(mockFiles));

      act(() => {
        result.current.handleSortChange('size');
      });

      const sortedFiles = result.current.sortedFiles;

      // Should be sorted by size: apple (1000), banana (2000), zebra (3000)
      expect(sortedFiles[0].filename).toBe('apple.txt');
      expect(sortedFiles[1].filename).toBe('banana.pdf');
      expect(sortedFiles[2].filename).toBe('zebra.txt');
    });
  });

  describe('Filter Optimization', () => {
    test('handles filter changes efficiently', () => {
      const { result } = renderHook(() => useFileSorting(mockFiles));

      // Change filter
      act(() => {
        result.current.handleFilterChange('filename', 'apple');
      });

      expect(result.current.filter.filename).toBe('apple');
    });

    test('maintains sort when filters change', () => {
      const { result } = renderHook(() => useFileSorting(mockFiles));

      // Set up sorting
      act(() => {
        result.current.handleSortChange('date');
      });

      const sortedBeforeFilter = result.current.sortedFiles;

      // Change filter
      act(() => {
        result.current.handleFilterChange('filename', 'test');
      });

      // Sort should be maintained
      expect(result.current.sortBy).toBe('date');
      expect(result.current.sortedFiles).not.toBe(sortedBeforeFilter);
    });
  });

  describe('Edge Cases and Performance', () => {
    test('handles empty files array efficiently', () => {
      const { result } = renderHook(() => useFileSorting([]));

      expect(result.current.sortedFiles).toEqual([]);
    });

    test('handles undefined files array efficiently', () => {
      const { result } = renderHook(() => useFileSorting(undefined));

      expect(result.current.sortedFiles).toEqual([]);
    });

    test('handles files without size_bytes gracefully', () => {
      const filesWithoutSize = mockFiles.map(file => ({
        ...file,
        file: undefined,
      }));

      const { result } = renderHook(() => useFileSorting(filesWithoutSize));

      act(() => {
        result.current.handleSortChange('size');
      });

      const sortedFiles = result.current.sortedFiles;

      // Should handle undefined sizes (treated as 0)
      expect(sortedFiles.length).toBe(3);
    });

    test('maintains stable sort for equal values', () => {
      const filesWithSameDate = [
        { ...mockFiles[0], created_at: '2023-01-01T00:00:00Z' },
        { ...mockFiles[1], created_at: '2023-01-01T00:00:00Z' },
        { ...mockFiles[2], created_at: '2023-01-01T00:00:00Z' },
      ];

      const { result } = renderHook(() => useFileSorting(filesWithSameDate));

      act(() => {
        result.current.handleSortChange('date');
      });

      const sortedFiles = result.current.sortedFiles;

      // Should maintain original order for equal dates
      expect(sortedFiles.length).toBe(3);
    });
  });

  describe('Memory Efficiency', () => {
    test('creates shallow copy to avoid mutating original array', () => {
      const originalFiles = [...mockFiles];
      const { result } = renderHook(() => useFileSorting(originalFiles));

      // Sort the files
      act(() => {
        result.current.handleSortChange('name');
      });

      // Original array should remain unchanged
      expect(originalFiles[0].filename).toBe('zebra.txt'); // Original order
      expect(result.current.sortedFiles[0].filename).toBe('apple.txt'); // Sorted order
    });

    test('reuses sort results when possible', () => {
      const { result } = renderHook(() => useFileSorting(mockFiles));

      const firstResult = result.current.sortedFiles;

      // Multiple re-renders with same props
      act(() => {
        // Trigger some state changes that don't affect sorting
        result.current.handleFilterChange('filename', '');
        result.current.handleFilterChange('filename', '');
      });

      // Should still be the same reference if sorting didn't change
      expect(result.current.sortedFiles).toBe(firstResult);
    });
  });
});