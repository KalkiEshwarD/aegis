package utils_test

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"

	"github.com/balkanid/aegis-backend/internal/utils"
)

func TestSortDirectionString(t *testing.T) {
	tests := []struct {
		direction utils.SortDirection
		expected  string
	}{
		{utils.Ascending, "asc"},
		{utils.Descending, "desc"},
		{utils.SortDirection(999), "asc"}, // invalid defaults to asc
	}

	for _, tt := range tests {
		result := tt.direction.String()
		assert.Equal(t, tt.expected, result)
	}
}

func TestSortDirectionFromString(t *testing.T) {
	tests := []struct {
		input    string
		expected utils.SortDirection
	}{
		{"asc", utils.Ascending},
		{"desc", utils.Descending},
		{"ascending", utils.Ascending},
		{"descending", utils.Descending},
		{"ASC", utils.Ascending},
		{"DESC", utils.Descending},
		{"invalid", utils.Ascending}, // defaults to ascending
		{"", utils.Ascending},
	}

	for _, tt := range tests {
		result := utils.SortDirectionFromString(tt.input)
		assert.Equal(t, tt.expected, result)
	}
}

func TestSortFiles(t *testing.T) {
	baseTime := time.Date(2023, 1, 1, 12, 0, 0, 0, time.UTC)

	files := []utils.FileInfo{
		{ID: 1, Filename: "zebra.txt", SizeBytes: 1000, CreatedAt: baseTime.Add(time.Hour), MimeType: "text/plain"},
		{ID: 2, Filename: "apple.txt", SizeBytes: 500, CreatedAt: baseTime, MimeType: "text/plain"},
		{ID: 3, Filename: "Banana.txt", SizeBytes: 2000, CreatedAt: baseTime.Add(2 * time.Hour), MimeType: "text/plain"},
	}

	tests := []struct {
		name      string
		sortBy    string
		direction utils.SortDirection
		expected  []string // expected filenames in order
	}{
		{
			name:      "sort by name ascending",
			sortBy:    "name",
			direction: utils.Ascending,
			expected:  []string{"apple.txt", "Banana.txt", "zebra.txt"},
		},
		{
			name:      "sort by name descending",
			sortBy:    "name",
			direction: utils.Descending,
			expected:  []string{"zebra.txt", "Banana.txt", "apple.txt"},
		},
		{
			name:      "sort by size ascending",
			sortBy:    "size",
			direction: utils.Ascending,
			expected:  []string{"apple.txt", "zebra.txt", "Banana.txt"},
		},
		{
			name:      "sort by date ascending",
			sortBy:    "date",
			direction: utils.Ascending,
			expected:  []string{"apple.txt", "zebra.txt", "Banana.txt"},
		},
		{
			name:      "sort by invalid field defaults to name",
			sortBy:    "invalid",
			direction: utils.Ascending,
			expected:  []string{"apple.txt", "Banana.txt", "zebra.txt"},
		},
		{
			name:      "empty slice",
			sortBy:    "name",
			direction: utils.Ascending,
			expected:  []string{},
		},
		{
			name:      "single item",
			sortBy:    "name",
			direction: utils.Ascending,
			expected:  []string{"apple.txt"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var input []utils.FileInfo
			if tt.name == "empty slice" {
				input = []utils.FileInfo{}
			} else if tt.name == "single item" {
				input = []utils.FileInfo{files[1]}
			} else {
				input = make([]utils.FileInfo, len(files))
				copy(input, files)
			}

			result := utils.SortFiles(input, tt.sortBy, tt.direction)

			if len(tt.expected) == 0 {
				assert.Empty(t, result)
				return
			}

			assert.Equal(t, len(tt.expected), len(result))
			for i, expectedName := range tt.expected {
				assert.Equal(t, expectedName, result[i].Filename)
			}
		})
	}
}

func TestFilterFiles(t *testing.T) {
	baseTime := time.Date(2023, 1, 1, 12, 0, 0, 0, time.UTC)

	files := []utils.FileInfo{
		{ID: 1, Filename: "document.pdf", SizeBytes: 1000, CreatedAt: baseTime, MimeType: "application/pdf"},
		{ID: 2, Filename: "image.jpg", SizeBytes: 500, CreatedAt: baseTime.Add(time.Hour), MimeType: "image/jpeg"},
		{ID: 3, Filename: "text.txt", SizeBytes: 2000, CreatedAt: baseTime.Add(2 * time.Hour), MimeType: "text/plain"},
		{ID: 4, Filename: "another.pdf", SizeBytes: 1500, CreatedAt: baseTime.Add(3 * time.Hour), MimeType: "application/pdf"},
	}

	tests := []struct {
		name     string
		criteria utils.FilterCriteria
		expected []string // expected filenames
	}{
		{
			name:     "no criteria",
			criteria: utils.FilterCriteria{},
			expected: []string{"document.pdf", "image.jpg", "text.txt", "another.pdf"},
		},
		{
			name: "filename filter",
			criteria: utils.FilterCriteria{
				Filename: stringPtr("pdf"),
			},
			expected: []string{"document.pdf", "another.pdf"},
		},
		{
			name: "mime type exact match",
			criteria: utils.FilterCriteria{
				MimeType: stringPtr("application/pdf"),
			},
			expected: []string{"document.pdf", "another.pdf"},
		},
		{
			name: "mime type like match",
			criteria: utils.FilterCriteria{
				MimeTypeLike: stringPtr("image"),
			},
			expected: []string{"image.jpg"},
		},
		{
			name: "size range",
			criteria: utils.FilterCriteria{
				MinSize: int64Ptr(800),
				MaxSize: int64Ptr(1600),
			},
			expected: []string{"document.pdf", "another.pdf"},
		},
		{
			name: "date range",
			criteria: utils.FilterCriteria{
				DateFrom: timePtr(baseTime.Add(30 * time.Minute)),
				DateTo:   timePtr(baseTime.Add(90 * time.Minute)),
			},
			expected: []string{"image.jpg"},
		},
		{
			name: "multiple criteria",
			criteria: utils.FilterCriteria{
				MimeType: stringPtr("application/pdf"),
				MinSize:  int64Ptr(1200),
			},
			expected: []string{"another.pdf"},
		},
		{
			name:     "no matches",
			criteria: utils.FilterCriteria{
				Filename: stringPtr("nonexistent"),
			},
			expected: []string{},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := utils.FilterFiles(files, tt.criteria)

			assert.Equal(t, len(tt.expected), len(result))
			for i, expectedName := range tt.expected {
				assert.Equal(t, expectedName, result[i].Filename)
			}
		})
	}
}

func TestPaginateFiles(t *testing.T) {
	files := []utils.FileInfo{
		{ID: 1, Filename: "file1.txt"},
		{ID: 2, Filename: "file2.txt"},
		{ID: 3, Filename: "file3.txt"},
		{ID: 4, Filename: "file4.txt"},
		{ID: 5, Filename: "file5.txt"},
		{ID: 6, Filename: "file6.txt"},
		{ID: 7, Filename: "file7.txt"},
	}

	tests := []struct {
		name      string
		page      int
		pageSize  int
		expected  []string
		total     int
	}{
		{
			name:     "first page",
			page:     1,
			pageSize: 3,
			expected: []string{"file1.txt", "file2.txt", "file3.txt"},
			total:    7,
		},
		{
			name:     "second page",
			page:     2,
			pageSize: 3,
			expected: []string{"file4.txt", "file5.txt", "file6.txt"},
			total:    7,
		},
		{
			name:     "last page",
			page:     3,
			pageSize: 3,
			expected: []string{"file7.txt"},
			total:    7,
		},
		{
			name:     "page beyond total",
			page:     10,
			pageSize: 3,
			expected: []string{},
			total:    7,
		},
		{
			name:     "invalid page defaults to 1",
			page:     0,
			pageSize: 3,
			expected: []string{"file1.txt", "file2.txt", "file3.txt"},
			total:    7,
		},
		{
			name:     "invalid page size defaults to 10",
			page:     1,
			pageSize: 0,
			expected: []string{"file1.txt", "file2.txt", "file3.txt", "file4.txt", "file5.txt", "file6.txt", "file7.txt"},
			total:    7,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, total := utils.PaginateFiles(files, tt.page, tt.pageSize)

			assert.Equal(t, tt.total, total)
			assert.Equal(t, len(tt.expected), len(result))
			for i, expectedName := range tt.expected {
				assert.Equal(t, expectedName, result[i].Filename)
			}
		})
	}
}

func TestSearchFiles(t *testing.T) {
	files := []utils.FileInfo{
		{ID: 1, Filename: "document.pdf", MimeType: "application/pdf"},
		{ID: 2, Filename: "image.jpg", MimeType: "image/jpeg"},
		{ID: 3, Filename: "text.txt", MimeType: "text/plain"},
		{ID: 4, Filename: "another.pdf", MimeType: "application/pdf"},
	}

	tests := []struct {
		name     string
		query    string
		expected []string
	}{
		{
			name:     "empty query returns all",
			query:    "",
			expected: []string{"document.pdf", "image.jpg", "text.txt", "another.pdf"},
		},
		{
			name:     "search by filename",
			query:    "doc",
			expected: []string{"document.pdf"},
		},
		{
			name:     "search by mime type",
			query:    "pdf",
			expected: []string{"document.pdf", "another.pdf"},
		},
		{
			name:     "case insensitive search",
			query:    "TEXT",
			expected: []string{"text.txt"},
		},
		{
			name:     "no matches",
			query:    "nonexistent",
			expected: []string{},
		},
		{
			name:     "partial match",
			query:    "jpg",
			expected: []string{"image.jpg"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := utils.SearchFiles(files, tt.query)

			assert.Equal(t, len(tt.expected), len(result))
			for i, expectedName := range tt.expected {
				assert.Equal(t, expectedName, result[i].Filename)
			}
		})
	}
}

func TestSortAndFilterFiles(t *testing.T) {
	baseTime := time.Date(2023, 1, 1, 12, 0, 0, 0, time.UTC)

	files := []utils.FileInfo{
		{ID: 1, Filename: "zebra.pdf", SizeBytes: 1000, CreatedAt: baseTime, MimeType: "application/pdf"},
		{ID: 2, Filename: "apple.txt", SizeBytes: 500, CreatedAt: baseTime.Add(time.Hour), MimeType: "text/plain"},
		{ID: 3, Filename: "banana.pdf", SizeBytes: 2000, CreatedAt: baseTime.Add(2 * time.Hour), MimeType: "application/pdf"},
	}

	criteria := utils.FilterCriteria{
		MimeType: stringPtr("application/pdf"),
	}

	result := utils.SortAndFilterFiles(files, criteria, "name", utils.Ascending)

	expected := []string{"banana.pdf", "zebra.pdf"}
	assert.Equal(t, len(expected), len(result))
	for i, expectedName := range expected {
		assert.Equal(t, expectedName, result[i].Filename)
	}
}

func TestGroupFilesByMimeType(t *testing.T) {
	files := []utils.FileInfo{
		{ID: 1, Filename: "doc1.pdf", MimeType: "application/pdf"},
		{ID: 2, Filename: "doc2.pdf", MimeType: "application/pdf"},
		{ID: 3, Filename: "image.jpg", MimeType: "image/jpeg"},
		{ID: 4, Filename: "text.txt", MimeType: "text/plain"},
		{ID: 5, Filename: "unknown", MimeType: ""},
	}

	result := utils.GroupFilesByMimeType(files)

	assert.Equal(t, 2, len(result["application/pdf"]))
	assert.Equal(t, 1, len(result["image/jpeg"]))
	assert.Equal(t, 1, len(result["text/plain"]))
	assert.Equal(t, 1, len(result["unknown"]))

	// Check specific files
	assert.Equal(t, "doc1.pdf", result["application/pdf"][0].Filename)
	assert.Equal(t, "doc2.pdf", result["application/pdf"][1].Filename)
	assert.Equal(t, "image.jpg", result["image/jpeg"][0].Filename)
}

func TestGroupFilesByDate(t *testing.T) {
	baseTime := time.Date(2023, 1, 1, 12, 0, 0, 0, time.UTC)

	files := []utils.FileInfo{
		{ID: 1, Filename: "file1.txt", CreatedAt: baseTime},
		{ID: 2, Filename: "file2.txt", CreatedAt: baseTime.Add(24 * time.Hour)},
		{ID: 3, Filename: "file3.txt", CreatedAt: baseTime.Add(24 * time.Hour)},
	}

	result := utils.GroupFilesByDate(files)

	assert.Equal(t, 1, len(result["2023-01-01"]))
	assert.Equal(t, 2, len(result["2023-01-02"]))

	assert.Equal(t, "file1.txt", result["2023-01-01"][0].Filename)
	assert.Equal(t, "file2.txt", result["2023-01-02"][0].Filename)
	assert.Equal(t, "file3.txt", result["2023-01-02"][1].Filename)
}

func TestGetFileStats(t *testing.T) {
	files := []utils.FileInfo{
		{ID: 1, Filename: "small.txt", SizeBytes: 100, MimeType: "text/plain"},
		{ID: 2, Filename: "medium.pdf", SizeBytes: 1000, MimeType: "application/pdf"},
		{ID: 3, Filename: "large.jpg", SizeBytes: 10000, MimeType: "image/jpeg"},
		{ID: 4, Filename: "another.pdf", SizeBytes: 2000, MimeType: "application/pdf"},
	}

	result := utils.GetFileStats(files)

	assert.Equal(t, 4, result.TotalFiles)
	assert.Equal(t, int64(13200), result.TotalSize)
	assert.Equal(t, int64(3300), result.AverageSize) // 13200 / 4
	assert.Equal(t, "large.jpg", result.LargestFile.Filename)
	assert.Equal(t, "small.txt", result.SmallestFile.Filename)

	assert.Equal(t, 2, result.MimeTypeCount["application/pdf"])
	assert.Equal(t, 1, result.MimeTypeCount["text/plain"])
	assert.Equal(t, 1, result.MimeTypeCount["image/jpeg"])
}

func TestGetFileStatsEmpty(t *testing.T) {
	result := utils.GetFileStats([]utils.FileInfo{})

	assert.Equal(t, 0, result.TotalFiles)
	assert.Equal(t, int64(0), result.TotalSize)
	assert.Equal(t, int64(0), result.AverageSize)
	assert.Nil(t, result.LargestFile)
	assert.Nil(t, result.SmallestFile)
	assert.NotNil(t, result.MimeTypeCount)
	assert.Equal(t, 0, len(result.MimeTypeCount))
}

// Helper functions for creating pointers
func stringPtr(s string) *string {
	return &s
}

func int64Ptr(i int64) *int64 {
	return &i
}

func timePtr(t time.Time) *time.Time {
	return &t
}