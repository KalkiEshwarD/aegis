package utils

import (
	"sort"
	"strings"
	"time"
)

// SortDirection represents sort direction
type SortDirection int

const (
	Ascending SortDirection = iota
	Descending
)

// String returns string representation of SortDirection
func (sd SortDirection) String() string {
	switch sd {
	case Ascending:
		return "asc"
	case Descending:
		return "desc"
	default:
		return "asc"
	}
}

// SortDirectionFromString converts string to SortDirection
func SortDirectionFromString(s string) SortDirection {
	switch strings.ToLower(s) {
	case "desc", "descending":
		return Descending
	default:
		return Ascending
	}
}

// FileInfo represents file information for sorting/filtering
type FileInfo struct {
	ID        uint
	Filename  string
	SizeBytes int64
	CreatedAt time.Time
	UpdatedAt time.Time
	MimeType  string
}

// SortFiles sorts files by specified field and direction
func SortFiles(files []FileInfo, sortBy string, direction SortDirection) []FileInfo {
	if len(files) <= 1 {
		return files
	}

	sorted := make([]FileInfo, len(files))
	copy(sorted, files)

	sort.Slice(sorted, func(i, j int) bool {
		var less bool

		switch strings.ToLower(sortBy) {
		case "name", "filename":
			aVal := strings.ToLower(sorted[i].Filename)
			bVal := strings.ToLower(sorted[j].Filename)
			less = aVal < bVal
		case "date", "created_at":
			less = sorted[i].CreatedAt.Before(sorted[j].CreatedAt)
		case "size", "size_bytes":
			less = sorted[i].SizeBytes < sorted[j].SizeBytes
		case "updated_at":
			less = sorted[i].UpdatedAt.Before(sorted[j].UpdatedAt)
		default:
			// Default to name sorting
			aVal := strings.ToLower(sorted[i].Filename)
			bVal := strings.ToLower(sorted[j].Filename)
			less = aVal < bVal
		}

		if direction == Descending {
			return !less
		}
		return less
	})

	return sorted
}

// FilterCriteria represents filtering criteria
type FilterCriteria struct {
	Filename     *string
	MimeType     *string
	MinSize      *int64
	MaxSize      *int64
	DateFrom     *time.Time
	DateTo       *time.Time
	MimeTypeLike *string
}

// FilterFiles filters files based on criteria
func FilterFiles(files []FileInfo, criteria FilterCriteria) []FileInfo {
	if len(files) == 0 {
		return files
	}

	filtered := make([]FileInfo, 0, len(files))

	for _, file := range files {
		if matchesCriteria(file, criteria) {
			filtered = append(filtered, file)
		}
	}

	return filtered
}

// matchesCriteria checks if file matches the filter criteria
func matchesCriteria(file FileInfo, criteria FilterCriteria) bool {
	// Filename filter
	if criteria.Filename != nil && *criteria.Filename != "" {
		if !strings.Contains(strings.ToLower(file.Filename), strings.ToLower(*criteria.Filename)) {
			return false
		}
	}

	// MIME type exact match
	if criteria.MimeType != nil && *criteria.MimeType != "" {
		if file.MimeType != *criteria.MimeType {
			return false
		}
	}

	// MIME type like match
	if criteria.MimeTypeLike != nil && *criteria.MimeTypeLike != "" {
		if !strings.Contains(file.MimeType, *criteria.MimeTypeLike) {
			return false
		}
	}

	// Size filters
	if criteria.MinSize != nil && file.SizeBytes < *criteria.MinSize {
		return false
	}
	if criteria.MaxSize != nil && file.SizeBytes > *criteria.MaxSize {
		return false
	}

	// Date filters
	if criteria.DateFrom != nil && file.CreatedAt.Before(*criteria.DateFrom) {
		return false
	}
	if criteria.DateTo != nil && file.CreatedAt.After(*criteria.DateTo) {
		return false
	}

	return true
}

// PaginateFiles paginates a slice of files
func PaginateFiles(files []FileInfo, page, pageSize int) ([]FileInfo, int) {
	if pageSize <= 0 {
		pageSize = 10
	}
	if page < 1 {
		page = 1
	}

	total := len(files)
	start := (page - 1) * pageSize
	end := start + pageSize

	if start >= total {
		return []FileInfo{}, total
	}
	if end > total {
		end = total
	}

	return files[start:end], total
}

// SearchFiles performs text search on files
func SearchFiles(files []FileInfo, query string) []FileInfo {
	if query == "" {
		return files
	}

	query = strings.ToLower(query)
	filtered := make([]FileInfo, 0)

	for _, file := range files {
		if strings.Contains(strings.ToLower(file.Filename), query) ||
		   strings.Contains(strings.ToLower(file.MimeType), query) {
			filtered = append(filtered, file)
		}
	}

	return filtered
}

// SortAndFilterFiles combines sorting and filtering operations
func SortAndFilterFiles(files []FileInfo, criteria FilterCriteria, sortBy string, direction SortDirection) []FileInfo {
	// First filter
	filtered := FilterFiles(files, criteria)

	// Then sort
	return SortFiles(filtered, sortBy, direction)
}

// GroupFilesByMimeType groups files by MIME type
func GroupFilesByMimeType(files []FileInfo) map[string][]FileInfo {
	groups := make(map[string][]FileInfo)

	for _, file := range files {
		mimeType := file.MimeType
		if mimeType == "" {
			mimeType = "unknown"
		}
		groups[mimeType] = append(groups[mimeType], file)
	}

	return groups
}

// GroupFilesByDate groups files by date (YYYY-MM-DD format)
func GroupFilesByDate(files []FileInfo) map[string][]FileInfo {
	groups := make(map[string][]FileInfo)

	for _, file := range files {
		dateKey := file.CreatedAt.Format("2006-01-02")
		groups[dateKey] = append(groups[dateKey], file)
	}

	return groups
}

// GetFileStats calculates statistics for files
type FileStats struct {
	TotalFiles    int
	TotalSize     int64
	AverageSize   int64
	LargestFile   *FileInfo
	SmallestFile  *FileInfo
	MimeTypeCount map[string]int
}

func GetFileStats(files []FileInfo) FileStats {
	if len(files) == 0 {
		return FileStats{
			MimeTypeCount: make(map[string]int),
		}
	}

	stats := FileStats{
		TotalFiles:    len(files),
		MimeTypeCount: make(map[string]int),
		LargestFile:   &files[0],
		SmallestFile:  &files[0],
	}

	totalSize := int64(0)

	for _, file := range files {
		totalSize += file.SizeBytes

		if file.SizeBytes > stats.LargestFile.SizeBytes {
			stats.LargestFile = &file
		}
		if file.SizeBytes < stats.SmallestFile.SizeBytes {
			stats.SmallestFile = &file
		}

		stats.MimeTypeCount[file.MimeType]++
	}

	stats.TotalSize = totalSize
	if stats.TotalFiles > 0 {
		stats.AverageSize = totalSize / int64(stats.TotalFiles)
	}

	return stats
}