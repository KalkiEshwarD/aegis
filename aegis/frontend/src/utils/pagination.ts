/**
 * Pagination utilities for cross-stack consistency
 */

// Pagination parameters interface (mirrors Go PaginationParams)
export interface PaginationParams {
  page: number;
  page_size: number;
}

// Pagination result interface (mirrors Go PaginationResult)
export interface PaginationResult<T = any> {
  items: T[];
  current_page: number;
  page_size: number;
  total_items: number;
  total_pages: number;
  has_next: boolean;
  has_prev: boolean;
}

// Default pagination parameters (mirrors Go DefaultPaginationParams)
export const defaultPaginationParams = (): PaginationParams => ({
  page: 1,
  page_size: 10
});

// Validate pagination parameters (mirrors Go ValidatePaginationParams)
export const validatePaginationParams = (params: PaginationParams): PaginationParams => {
  return {
    page: Math.max(1, params.page),
    page_size: Math.max(1, Math.min(100, params.page_size)) // Max 100 items per page
  };
};

// Paginate array (mirrors Go PaginateSlice)
export const paginateArray = <T>(
  items: T[],
  params: PaginationParams
): PaginationResult<T> => {
  const validatedParams = validatePaginationParams(params);

  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / validatedParams.page_size));

  // Calculate slice bounds
  const start = (validatedParams.page - 1) * validatedParams.page_size;
  const end = start + validatedParams.page_size;

  let paginatedItems: T[] = [];
  if (start < totalItems) {
    paginatedItems = items.slice(start, Math.min(end, totalItems));
  }

  return {
    items: paginatedItems,
    current_page: validatedParams.page,
    page_size: validatedParams.page_size,
    total_items: totalItems,
    total_pages: totalPages,
    has_next: validatedParams.page < totalPages,
    has_prev: validatedParams.page > 1
  };
};

// Calculate offset for database queries (mirrors Go CalculateOffset)
export const calculateOffset = (page: number, pageSize: number): number => {
  const safePage = Math.max(1, page);
  const safePageSize = Math.max(1, pageSize);
  return (safePage - 1) * safePageSize;
};

// Calculate total pages (mirrors Go CalculateTotalPages)
export const calculateTotalPages = (totalItems: number, pageSize: number): number => {
  const safePageSize = Math.max(1, pageSize);
  if (totalItems <= 0) return 1;
  return Math.ceil(totalItems / safePageSize);
};

// Page info interface (mirrors Go PageInfo)
export interface PageInfo {
  start_item: number;
  end_item: number;
  has_next: boolean;
  has_prev: boolean;
}

// Get page information (mirrors Go GetPageInfo)
export const getPageInfo = (page: number, pageSize: number, totalItems: number): PageInfo => {
  const safePage = Math.max(1, page);
  const safePageSize = Math.max(1, pageSize);

  const startItem = (safePage - 1) * safePageSize + 1;
  let endItem = safePage * safePageSize;

  if (endItem > totalItems) {
    endItem = totalItems;
  }

  const totalPages = calculateTotalPages(totalItems, safePageSize);

  return {
    start_item: startItem,
    end_item: endItem,
    has_next: safePage < totalPages,
    has_prev: safePage > 1
  };
};

// Pagination metadata interface (mirrors Go PaginationMeta)
export interface PaginationMeta {
  current_page: number;
  page_size: number;
  total_items: number;
  total_pages: number;
  has_next: boolean;
  has_prev: boolean;
  start_item: number;
  end_item: number;
}

// Create pagination metadata (mirrors Go CreatePaginationMeta)
export const createPaginationMeta = (
  page: number,
  pageSize: number,
  totalItems: number
): PaginationMeta => {
  const pageInfo = getPageInfo(page, pageSize, totalItems);
  const totalPages = calculateTotalPages(totalItems, pageSize);

  return {
    current_page: page,
    page_size: pageSize,
    total_items: totalItems,
    total_pages: totalPages,
    has_next: pageInfo.has_next,
    has_prev: pageInfo.has_prev,
    start_item: pageInfo.start_item,
    end_item: pageInfo.end_item
  };
};

// Cursor-based pagination parameters (mirrors Go CursorPaginationParams)
export interface CursorPaginationParams {
  cursor?: string;
  limit: number;
  backward?: boolean;
}

// Cursor-based pagination result (mirrors Go CursorPaginationResult)
export interface CursorPaginationResult<T = any> {
  items: T[];
  next_cursor?: string;
  prev_cursor?: string;
  has_next: boolean;
  has_prev: boolean;
}

// Simple cursor encoding/decoding (mirrors Go EncodeCursor/DecodeCursor)
export const encodeCursor = (id: string | number): string => {
  // Simple base64 encoding for demonstration
  return btoa(String(id));
};

export const decodeCursor = (cursor: string): string | null => {
  try {
    return atob(cursor);
  } catch {
    return null;
  }
};

// Validate page size with bounds (mirrors Go ValidatePageSize)
export const validatePageSize = (pageSize: number, minSize = 1, maxSize = 100): number => {
  return Math.max(minSize, Math.min(maxSize, pageSize));
};

// Default page size (mirrors Go GetDefaultPageSize)
export const getDefaultPageSize = (): number => 10;

// Maximum page size (mirrors Go GetMaxPageSize)
export const getMaxPageSize = (): number => 100;

// Validation functions (mirrors Go IsValidPage/IsValidPageSize)
export const isValidPage = (page: number): boolean => page >= 1;

export const isValidPageSize = (pageSize: number): boolean =>
  pageSize >= 1 && pageSize <= getMaxPageSize();

// Generate page numbers for pagination UI
export const generatePageNumbers = (
  currentPage: number,
  totalPages: number,
  maxVisible = 5
): (number | string)[] => {
  if (totalPages <= maxVisible) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const pages: (number | string)[] = [];
  const half = Math.floor(maxVisible / 2);

  let start = Math.max(1, currentPage - half);
  let end = Math.min(totalPages, start + maxVisible - 1);

  if (end - start + 1 < maxVisible) {
    start = Math.max(1, end - maxVisible + 1);
  }

  // Add first page and ellipsis if needed
  if (start > 1) {
    pages.push(1);
    if (start > 2) {
      pages.push('...');
    }
  }

  // Add visible pages
  for (let i = start; i <= end; i++) {
    pages.push(i);
  }

  // Add last page and ellipsis if needed
  if (end < totalPages) {
    if (end < totalPages - 1) {
      pages.push('...');
    }
    pages.push(totalPages);
  }

  return pages;
};

// Calculate items per page options
export const getPageSizeOptions = (): number[] => [5, 10, 20, 50, 100];

// Check if pagination is needed
export const needsPagination = (totalItems: number, pageSize: number): boolean => {
  return totalItems > pageSize;
};

// Get pagination summary text
export const getPaginationSummary = (meta: PaginationMeta): string => {
  if (meta.total_items === 0) {
    return 'No items';
  }

  return `Showing ${meta.start_item} to ${meta.end_item} of ${meta.total_items} items`;
};