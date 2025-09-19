import {
  defaultPaginationParams,
  validatePaginationParams,
  paginateArray,
  calculateOffset,
  calculateTotalPages,
  getPageInfo,
  createPaginationMeta,
  encodeCursor,
  decodeCursor,
  validatePageSize,
  getDefaultPageSize,
  getMaxPageSize,
  isValidPage,
  isValidPageSize,
  generatePageNumbers,
  getPageSizeOptions,
  needsPagination,
  getPaginationSummary,
} from '../../utils/pagination';

describe('Pagination Utils', () => {
  describe('defaultPaginationParams', () => {
    it('should return default pagination parameters', () => {
      const params = defaultPaginationParams();
      expect(params.page).toBe(1);
      expect(params.page_size).toBe(10);
    });
  });

  describe('validatePaginationParams', () => {
    it('should validate correct parameters', () => {
      const params = { page: 2, page_size: 20 };
      const result = validatePaginationParams(params);
      expect(result.page).toBe(2);
      expect(result.page_size).toBe(20);
    });

    it('should fix negative page', () => {
      const params = { page: -1, page_size: 20 };
      const result = validatePaginationParams(params);
      expect(result.page).toBe(1);
    });

    it('should fix zero page', () => {
      const params = { page: 0, page_size: 20 };
      const result = validatePaginationParams(params);
      expect(result.page).toBe(1);
    });

    it('should fix negative page size', () => {
      const params = { page: 1, page_size: -5 };
      const result = validatePaginationParams(params);
      expect(result.page).toBe(1);
      expect(result.page_size).toBe(1);
    });

    it('should cap page size at 100', () => {
      const params = { page: 1, page_size: 200 };
      const result = validatePaginationParams(params);
      expect(result.page_size).toBe(100);
    });
  });

  describe('paginateArray', () => {
    const items = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];

    it('should paginate first page', () => {
      const result = paginateArray(items, { page: 1, page_size: 3 });
      expect(result.items).toEqual(['a', 'b', 'c']);
      expect(result.current_page).toBe(1);
      expect(result.total_items).toBe(7);
      expect(result.total_pages).toBe(3);
      expect(result.has_next).toBe(true);
      expect(result.has_prev).toBe(false);
    });

    it('should paginate last page', () => {
      const result = paginateArray(items, { page: 3, page_size: 3 });
      expect(result.items).toEqual(['g']);
      expect(result.has_next).toBe(false);
      expect(result.has_prev).toBe(true);
    });

    it('should handle page beyond total', () => {
      const result = paginateArray(items, { page: 10, page_size: 3 });
      expect(result.items).toEqual([]);
      expect(result.current_page).toBe(10);
    });

    it('should handle empty array', () => {
      const result = paginateArray([], { page: 1, page_size: 3 });
      expect(result.items).toEqual([]);
      expect(result.total_items).toBe(0);
      expect(result.total_pages).toBe(1);
    });
  });

  describe('calculateOffset', () => {
    it('should calculate correct offsets', () => {
      expect(calculateOffset(1, 10)).toBe(0);
      expect(calculateOffset(2, 10)).toBe(10);
      expect(calculateOffset(3, 5)).toBe(10);
    });

    it('should handle invalid inputs', () => {
      expect(calculateOffset(-1, 10)).toBe(0);
      expect(calculateOffset(1, 0)).toBe(0);
    });
  });

  describe('calculateTotalPages', () => {
    it('should calculate total pages', () => {
      expect(calculateTotalPages(25, 10)).toBe(3);
      expect(calculateTotalPages(20, 10)).toBe(2);
      expect(calculateTotalPages(10, 10)).toBe(1);
    });

    it('should handle edge cases', () => {
      expect(calculateTotalPages(0, 10)).toBe(1);
      expect(calculateTotalPages(-5, 10)).toBe(1);
      expect(calculateTotalPages(25, 0)).toBe(1);
    });
  });

  describe('getPageInfo', () => {
    it('should return correct page info', () => {
      const info = getPageInfo(2, 10, 25);
      expect(info.start_item).toBe(11);
      expect(info.end_item).toBe(20);
      expect(info.has_next).toBe(true);
      expect(info.has_prev).toBe(true);
    });

    it('should handle last page', () => {
      const info = getPageInfo(3, 10, 25);
      expect(info.start_item).toBe(21);
      expect(info.end_item).toBe(25);
      expect(info.has_next).toBe(false);
    });

    it('should handle invalid inputs', () => {
      const info = getPageInfo(-1, 0, 25);
      expect(info.start_item).toBe(1);
      expect(info.end_item).toBe(10);
    });
  });

  describe('createPaginationMeta', () => {
    it('should create pagination metadata', () => {
      const meta = createPaginationMeta(2, 10, 25);
      expect(meta.current_page).toBe(2);
      expect(meta.page_size).toBe(10);
      expect(meta.total_items).toBe(25);
      expect(meta.total_pages).toBe(3);
      expect(meta.start_item).toBe(11);
      expect(meta.end_item).toBe(20);
    });
  });

  describe('cursor functions', () => {
    describe('encodeCursor', () => {
      it('should encode string cursor', () => {
        const encoded = encodeCursor('test123');
        expect(typeof encoded).toBe('string');
        expect(encoded.length).toBeGreaterThan(0);
      });

      it('should encode number cursor', () => {
        const encoded = encodeCursor(123);
        expect(typeof encoded).toBe('string');
      });
    });

    describe('decodeCursor', () => {
      it('should decode valid cursor', () => {
        const original = 'test123';
        const encoded = encodeCursor(original);
        const decoded = decodeCursor(encoded);
        expect(decoded).toBe(original);
      });

      it('should return null for invalid cursor', () => {
        const decoded = decodeCursor('invalid-base64!');
        expect(decoded).toBeNull();
      });

      it('should handle empty cursor', () => {
        const decoded = decodeCursor('');
        expect(decoded).toBeNull();
      });
    });
  });

  describe('page size functions', () => {
    describe('validatePageSize', () => {
      it('should validate page size within bounds', () => {
        expect(validatePageSize(20)).toBe(20);
        expect(validatePageSize(50, 10, 100)).toBe(50);
      });

      it('should apply minimum bound', () => {
        expect(validatePageSize(0)).toBe(1);
        expect(validatePageSize(5, 10, 100)).toBe(10);
      });

      it('should apply maximum bound', () => {
        expect(validatePageSize(200)).toBe(100);
        expect(validatePageSize(150, 10, 100)).toBe(100);
      });
    });

    describe('getDefaultPageSize', () => {
      it('should return default page size', () => {
        expect(getDefaultPageSize()).toBe(10);
      });
    });

    describe('getMaxPageSize', () => {
      it('should return max page size', () => {
        expect(getMaxPageSize()).toBe(100);
      });
    });
  });

  describe('validation functions', () => {
    describe('isValidPage', () => {
      it('should validate page numbers', () => {
        expect(isValidPage(1)).toBe(true);
        expect(isValidPage(5)).toBe(true);
        expect(isValidPage(0)).toBe(false);
        expect(isValidPage(-1)).toBe(false);
      });
    });

    describe('isValidPageSize', () => {
      it('should validate page sizes', () => {
        expect(isValidPageSize(10)).toBe(true);
        expect(isValidPageSize(50)).toBe(true);
        expect(isValidPageSize(100)).toBe(true);
        expect(isValidPageSize(0)).toBe(false);
        expect(isValidPageSize(101)).toBe(false);
      });
    });
  });

  describe('generatePageNumbers', () => {
    it('should generate all pages when total is small', () => {
      const pages = generatePageNumbers(1, 3, 5);
      expect(pages).toEqual([1, 2, 3]);
    });

    it('should generate pages with ellipsis for large ranges', () => {
      const pages = generatePageNumbers(5, 10, 5);
      expect(pages).toEqual([1, '...', 3, 4, 5, 6, 7, '...', 10]);
    });

    it('should handle edge cases', () => {
      expect(generatePageNumbers(1, 1, 5)).toEqual([1]);
      expect(generatePageNumbers(1, 0, 5)).toEqual([]);
    });
  });

  describe('getPageSizeOptions', () => {
    it('should return page size options', () => {
      const options = getPageSizeOptions();
      expect(options).toEqual([5, 10, 20, 50, 100]);
    });
  });

  describe('needsPagination', () => {
    it('should determine if pagination is needed', () => {
      expect(needsPagination(50, 10)).toBe(true);
      expect(needsPagination(10, 10)).toBe(false);
      expect(needsPagination(5, 10)).toBe(false);
    });
  });

  describe('getPaginationSummary', () => {
    it('should generate pagination summary', () => {
      const meta = {
        current_page: 2,
        page_size: 10,
        total_items: 25,
        total_pages: 3,
        has_next: true,
        has_prev: true,
        start_item: 11,
        end_item: 20,
      };
      const summary = getPaginationSummary(meta);
      expect(summary).toBe('Showing 11 to 20 of 25 items');
    });

    it('should handle no items', () => {
      const meta = {
        current_page: 1,
        page_size: 10,
        total_items: 0,
        total_pages: 1,
        has_next: false,
        has_prev: false,
        start_item: 0,
        end_item: 0,
      };
      const summary = getPaginationSummary(meta);
      expect(summary).toBe('No items');
    });
  });
});