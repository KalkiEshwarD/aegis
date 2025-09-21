package utils

import (
	"math"
)

// PaginationParams represents pagination parameters
type PaginationParams struct {
	Page     int `json:"page"`
	PageSize int `json:"page_size"`
}

// PaginationResult represents pagination result
type PaginationResult struct {
	Items       interface{} `json:"items"`
	CurrentPage int         `json:"current_page"`
	PageSize    int         `json:"page_size"`
	TotalItems  int         `json:"total_items"`
	TotalPages  int         `json:"total_pages"`
	HasNext     bool        `json:"has_next"`
	HasPrev     bool        `json:"has_prev"`
}

// DefaultPaginationParams returns default pagination parameters
func DefaultPaginationParams() PaginationParams {
	return PaginationParams{
		Page:     1,
		PageSize: 10,
	}
}

// ValidatePaginationParams validates and normalizes pagination parameters
func ValidatePaginationParams(params PaginationParams) PaginationParams {
	if params.Page < 1 {
		params.Page = 1
	}
	if params.PageSize < 1 {
		params.PageSize = 10
	}
	if params.PageSize > 100 {
		params.PageSize = 100 // Maximum page size
	}
	return params
}

// PaginateSlice paginates any slice
func PaginateSlice(items interface{}, params PaginationParams) PaginationResult {
	params = ValidatePaginationParams(params)

	// Use reflection to work with any slice type
	itemsSlice := items.([]interface{})
	totalItems := len(itemsSlice)

	totalPages := int(math.Ceil(float64(totalItems) / float64(params.PageSize)))
	if totalPages < 1 {
		totalPages = 1
	}

	// Calculate slice bounds
	start := (params.Page - 1) * params.PageSize
	end := start + params.PageSize

	if start >= totalItems {
		start = totalItems
		end = totalItems
	} else if end > totalItems {
		end = totalItems
	}

	var paginatedItems []interface{}
	if start < totalItems {
		paginatedItems = itemsSlice[start:end]
	}

	return PaginationResult{
		Items:       paginatedItems,
		CurrentPage: params.Page,
		PageSize:    params.PageSize,
		TotalItems:  totalItems,
		TotalPages:  totalPages,
		HasNext:     params.Page < totalPages,
		HasPrev:     params.Page > 1,
	}
}

// CalculateOffset calculates database offset from page and page size
func CalculateOffset(page, pageSize int) int {
	if page < 1 {
		page = 1
	}
	if pageSize < 1 {
		pageSize = 10
	}
	return (page - 1) * pageSize
}

// CalculateTotalPages calculates total pages from total items and page size
func CalculateTotalPages(totalItems, pageSize int) int {
	if pageSize < 1 {
		pageSize = 10
	}
	if totalItems <= 0 {
		return 1
	}
	return int(math.Ceil(float64(totalItems) / float64(pageSize)))
}

// GetPageInfo returns page information
type PageInfo struct {
	StartItem int
	EndItem   int
	HasNext   bool
	HasPrev   bool
}

// GetPageInfo calculates page information
func GetPageInfo(page, pageSize, totalItems int) PageInfo {
	if page < 1 {
		page = 1
	}
	if pageSize < 1 {
		pageSize = 10
	}

	startItem := (page-1)*pageSize + 1
	endItem := page * pageSize

	if endItem > totalItems {
		endItem = totalItems
	}

	totalPages := CalculateTotalPages(totalItems, pageSize)

	return PageInfo{
		StartItem: startItem,
		EndItem:   endItem,
		HasNext:   page < totalPages,
		HasPrev:   page > 1,
	}
}

// PaginationMeta represents pagination metadata for API responses
type PaginationMeta struct {
	CurrentPage int  `json:"current_page"`
	PageSize    int  `json:"page_size"`
	TotalItems  int  `json:"total_items"`
	TotalPages  int  `json:"total_pages"`
	HasNext     bool `json:"has_next"`
	HasPrev     bool `json:"has_prev"`
	StartItem   int  `json:"start_item"`
	EndItem     int  `json:"end_item"`
}

// CreatePaginationMeta creates pagination metadata
func CreatePaginationMeta(page, pageSize, totalItems int) PaginationMeta {
	pageInfo := GetPageInfo(page, pageSize, totalItems)
	totalPages := CalculateTotalPages(totalItems, pageSize)

	return PaginationMeta{
		CurrentPage: page,
		PageSize:    pageSize,
		TotalItems:  totalItems,
		TotalPages:  totalPages,
		HasNext:     pageInfo.HasNext,
		HasPrev:     pageInfo.HasPrev,
		StartItem:   pageInfo.StartItem,
		EndItem:     pageInfo.EndItem,
	}
}

// CursorPaginationParams represents cursor-based pagination parameters
type CursorPaginationParams struct {
	Cursor   string `json:"cursor"`
	Limit    int    `json:"limit"`
	Backward bool   `json:"backward"`
}

// CursorPaginationResult represents cursor-based pagination result
type CursorPaginationResult struct {
	Items      interface{} `json:"items"`
	NextCursor string      `json:"next_cursor,omitempty"`
	PrevCursor string      `json:"prev_cursor,omitempty"`
	HasNext    bool        `json:"has_next"`
	HasPrev    bool        `json:"has_prev"`
}

// EncodeCursor encodes an ID into a cursor string
func EncodeCursor(id uint) string {
	// Simple base64 encoding for demonstration
	// In production, use proper encoding and consider encryption
	return string(rune(id))
}

// DecodeCursor decodes a cursor string into an ID
func DecodeCursor(cursor string) (uint, error) {
	if cursor == "" {
		return 0, nil
	}
	// Simple decoding for demonstration
	if len(cursor) > 0 {
		return uint(cursor[0]), nil
	}
	return 0, nil
}

// ValidatePageSize validates page size with bounds
func ValidatePageSize(pageSize, minSize, maxSize int) int {
	if pageSize < minSize {
		return minSize
	}
	if pageSize > maxSize {
		return maxSize
	}
	return pageSize
}

// GetDefaultPageSize returns default page size
func GetDefaultPageSize() int {
	return 10
}

// GetMaxPageSize returns maximum allowed page size
func GetMaxPageSize() int {
	return 100
}

// IsValidPage checks if page number is valid
func IsValidPage(page int) bool {
	return page >= 1
}

// IsValidPageSize checks if page size is valid
func IsValidPageSize(pageSize int) bool {
	return pageSize >= 1 && pageSize <= GetMaxPageSize()
}
