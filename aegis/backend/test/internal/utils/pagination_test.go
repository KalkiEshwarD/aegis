package utils_test

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/suite"

	"github.com/balkanid/aegis-backend/internal/utils"
)

type PaginationTestSuite struct {
	suite.Suite
}

func (suite *PaginationTestSuite) SetupTest() {
	// Setup code if needed
}

func (suite *PaginationTestSuite) TearDownTest() {
	// Cleanup code if needed
}

func TestPaginationTestSuite(t *testing.T) {
	suite.Run(t, new(PaginationTestSuite))
}

func (suite *PaginationTestSuite) TestDefaultPaginationParams() {
	params := utils.DefaultPaginationParams()

	assert.Equal(suite.T(), 1, params.Page)
	assert.Equal(suite.T(), 10, params.PageSize)
}

func (suite *PaginationTestSuite) TestValidatePaginationParams() {
	tests := []struct {
		name     string
		input    utils.PaginationParams
		expected utils.PaginationParams
	}{
		{
			name:     "valid params",
			input:    utils.PaginationParams{Page: 2, PageSize: 20},
			expected: utils.PaginationParams{Page: 2, PageSize: 20},
		},
		{
			name:     "negative page",
			input:    utils.PaginationParams{Page: -1, PageSize: 20},
			expected: utils.PaginationParams{Page: 1, PageSize: 20},
		},
		{
			name:     "zero page",
			input:    utils.PaginationParams{Page: 0, PageSize: 20},
			expected: utils.PaginationParams{Page: 1, PageSize: 20},
		},
		{
			name:     "negative page size",
			input:    utils.PaginationParams{Page: 1, PageSize: -5},
			expected: utils.PaginationParams{Page: 1, PageSize: 10},
		},
		{
			name:     "zero page size",
			input:    utils.PaginationParams{Page: 1, PageSize: 0},
			expected: utils.PaginationParams{Page: 1, PageSize: 10},
		},
		{
			name:     "page size too large",
			input:    utils.PaginationParams{Page: 1, PageSize: 200},
			expected: utils.PaginationParams{Page: 1, PageSize: 100},
		},
	}

	for _, tt := range tests {
		suite.T().Run(tt.name, func(t *testing.T) {
			result := utils.ValidatePaginationParams(tt.input)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func (suite *PaginationTestSuite) TestPaginateSlice() {
	items := []interface{}{"a", "b", "c", "d", "e", "f", "g", "h", "i", "j"}

	tests := []struct {
		name     string
		params   utils.PaginationParams
		expected utils.PaginationResult
	}{
		{
			name:   "first page",
			params: utils.PaginationParams{Page: 1, PageSize: 3},
			expected: utils.PaginationResult{
				Items:       []interface{}{"a", "b", "c"},
				CurrentPage: 1,
				PageSize:    3,
				TotalItems:  10,
				TotalPages:  4,
				HasNext:     true,
				HasPrev:     false,
			},
		},
		{
			name:   "middle page",
			params: utils.PaginationParams{Page: 2, PageSize: 3},
			expected: utils.PaginationResult{
				Items:       []interface{}{"d", "e", "f"},
				CurrentPage: 2,
				PageSize:    3,
				TotalItems:  10,
				TotalPages:  4,
				HasNext:     true,
				HasPrev:     true,
			},
		},
		{
			name:   "last page",
			params: utils.PaginationParams{Page: 4, PageSize: 3},
			expected: utils.PaginationResult{
				Items:       []interface{}{"j"},
				CurrentPage: 4,
				PageSize:    3,
				TotalItems:  10,
				TotalPages:  4,
				HasNext:     false,
				HasPrev:     true,
			},
		},
		{
			name:   "page beyond total",
			params: utils.PaginationParams{Page: 10, PageSize: 3},
			expected: utils.PaginationResult{
				Items:       []interface{}{},
				CurrentPage: 10,
				PageSize:    3,
				TotalItems:  10,
				TotalPages:  4,
				HasNext:     false,
				HasPrev:     true,
			},
		},
		{
			name:   "empty slice",
			params: utils.PaginationParams{Page: 1, PageSize: 3},
			expected: utils.PaginationResult{
				Items:       []interface{}{},
				CurrentPage: 1,
				PageSize:    3,
				TotalItems:  0,
				TotalPages:  1,
				HasNext:     false,
				HasPrev:     false,
			},
		},
	}

	for _, tt := range tests {
		suite.T().Run(tt.name, func(t *testing.T) {
			var input interface{}
			if tt.name == "empty slice" {
				input = []interface{}{}
			} else {
				input = items
			}
			result := utils.PaginateSlice(input, tt.params)
			assert.Equal(t, tt.expected.Items, result.Items)
			assert.Equal(t, tt.expected.CurrentPage, result.CurrentPage)
			assert.Equal(t, tt.expected.PageSize, result.PageSize)
			assert.Equal(t, tt.expected.TotalItems, result.TotalItems)
			assert.Equal(t, tt.expected.TotalPages, result.TotalPages)
			assert.Equal(t, tt.expected.HasNext, result.HasNext)
			assert.Equal(t, tt.expected.HasPrev, result.HasPrev)
		})
	}
}

func (suite *PaginationTestSuite) TestCalculateOffset() {
	tests := []struct {
		name     string
		page     int
		pageSize int
		expected int
	}{
		{"first page", 1, 10, 0},
		{"second page", 2, 10, 10},
		{"third page", 3, 5, 10},
		{"negative page", -1, 10, 0},
		{"zero page", 0, 10, 0},
		{"negative page size", 1, -5, 0},
		{"zero page size", 1, 0, 0},
	}

	for _, tt := range tests {
		suite.T().Run(tt.name, func(t *testing.T) {
			result := utils.CalculateOffset(tt.page, tt.pageSize)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func (suite *PaginationTestSuite) TestCalculateTotalPages() {
	tests := []struct {
		name       string
		totalItems int
		pageSize   int
		expected   int
	}{
		{"exact division", 20, 10, 2},
		{"remainder", 25, 10, 3},
		{"single page", 5, 10, 1},
		{"zero items", 0, 10, 1},
		{"negative items", -5, 10, 1},
		{"zero page size", 20, 0, 1},
		{"negative page size", 20, -5, 1},
	}

	for _, tt := range tests {
		suite.T().Run(tt.name, func(t *testing.T) {
			result := utils.CalculateTotalPages(tt.totalItems, tt.pageSize)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func (suite *PaginationTestSuite) TestGetPageInfo() {
	tests := []struct {
		name       string
		page       int
		pageSize   int
		totalItems int
		expected   utils.PageInfo
	}{
		{
			name:       "first page",
			page:       1,
			pageSize:   10,
			totalItems: 25,
			expected:   utils.PageInfo{StartItem: 1, EndItem: 10, HasNext: true, HasPrev: false},
		},
		{
			name:       "last page",
			page:       3,
			pageSize:   10,
			totalItems: 25,
			expected:   utils.PageInfo{StartItem: 21, EndItem: 25, HasNext: false, HasPrev: true},
		},
		{
			name:       "negative page",
			page:       -1,
			pageSize:   10,
			totalItems: 25,
			expected:   utils.PageInfo{StartItem: 1, EndItem: 10, HasNext: true, HasPrev: false},
		},
		{
			name:       "zero page size",
			page:       1,
			pageSize:   0,
			totalItems: 25,
			expected:   utils.PageInfo{StartItem: 1, EndItem: 10, HasNext: true, HasPrev: false},
		},
	}

	for _, tt := range tests {
		suite.T().Run(tt.name, func(t *testing.T) {
			result := utils.GetPageInfo(tt.page, tt.pageSize, tt.totalItems)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func (suite *PaginationTestSuite) TestCreatePaginationMeta() {
	tests := []struct {
		name       string
		page       int
		pageSize   int
		totalItems int
		expected   utils.PaginationMeta
	}{
		{
			name:       "normal case",
			page:       2,
			pageSize:   10,
			totalItems: 25,
			expected: utils.PaginationMeta{
				CurrentPage: 2,
				PageSize:    10,
				TotalItems:  25,
				TotalPages:  3,
				HasNext:     true,
				HasPrev:     true,
				StartItem:   11,
				EndItem:     20,
			},
		},
		{
			name:       "first page",
			page:       1,
			pageSize:   10,
			totalItems: 25,
			expected: utils.PaginationMeta{
				CurrentPage: 1,
				PageSize:    10,
				TotalItems:  25,
				TotalPages:  3,
				HasNext:     true,
				HasPrev:     false,
				StartItem:   1,
				EndItem:     10,
			},
		},
	}

	for _, tt := range tests {
		suite.T().Run(tt.name, func(t *testing.T) {
			result := utils.CreatePaginationMeta(tt.page, tt.pageSize, tt.totalItems)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func (suite *PaginationTestSuite) TestEncodeCursor() {
	tests := []struct {
		name     string
		id       uint
		expected string
	}{
		{"id 1", 1, "\x01"},
		{"id 42", 42, "*"},
		{"id 255", 255, "ÿ"},
	}

	for _, tt := range tests {
		suite.T().Run(tt.name, func(t *testing.T) {
			result := utils.EncodeCursor(tt.id)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func (suite *PaginationTestSuite) TestDecodeCursor() {
	tests := []struct {
		name     string
		cursor   string
		expected uint
		hasError bool
	}{
		{"valid cursor", "\x01", 1, false},
		{"empty cursor", "", 0, false},
		{"single char", "a", 97, false},
	}

	for _, tt := range tests {
		suite.T().Run(tt.name, func(t *testing.T) {
			result, err := utils.DecodeCursor(tt.cursor)
			if tt.hasError {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
				assert.Equal(t, tt.expected, result)
			}
		})
	}
}

func (suite *PaginationTestSuite) TestValidatePageSize() {
	tests := []struct {
		name     string
		pageSize int
		minSize  int
		maxSize  int
		expected int
	}{
		{"within bounds", 20, 10, 50, 20},
		{"below min", 5, 10, 50, 10},
		{"above max", 60, 10, 50, 50},
		{"equal to min", 10, 10, 50, 10},
		{"equal to max", 50, 10, 50, 50},
	}

	for _, tt := range tests {
		suite.T().Run(tt.name, func(t *testing.T) {
			result := utils.ValidatePageSize(tt.pageSize, tt.minSize, tt.maxSize)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func (suite *PaginationTestSuite) TestGetDefaultPageSize() {
	result := utils.GetDefaultPageSize()
	assert.Equal(suite.T(), 10, result)
}

func (suite *PaginationTestSuite) TestGetMaxPageSize() {
	result := utils.GetMaxPageSize()
	assert.Equal(suite.T(), 100, result)
}

func (suite *PaginationTestSuite) TestIsValidPage() {
	tests := []struct {
		name     string
		page     int
		expected bool
	}{
		{"valid page", 1, true},
		{"valid page 2", 5, true},
		{"invalid negative", -1, false},
		{"invalid zero", 0, false},
	}

	for _, tt := range tests {
		suite.T().Run(tt.name, func(t *testing.T) {
			result := utils.IsValidPage(tt.page)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func (suite *PaginationTestSuite) TestIsValidPageSize() {
	tests := []struct {
		name     string
		pageSize int
		expected bool
	}{
		{"valid size", 10, true},
		{"valid size 2", 50, true},
		{"valid max", 100, true},
		{"invalid negative", -1, false},
		{"invalid zero", 0, false},
		{"invalid too large", 101, false},
	}

	for _, tt := range tests {
		suite.T().Run(tt.name, func(t *testing.T) {
			result := utils.IsValidPageSize(tt.pageSize)
			assert.Equal(t, tt.expected, result)
		})
	}
}