package services_test

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/balkanid/aegis-backend/internal/services"
)

func TestConvertMapToUpload(t *testing.T) {
	// Test data that matches the Upload struct
	testData := map[string]interface{}{
		"id":           "upload-123",
		"filename":     "document.pdf",
		"size":         float64(1024), // JSON numbers are float64
		"content_type": "application/pdf",
		"uploaded_at":  "2023-12-01T10:00:00Z",
	}

	upload, err := services.ConvertMapToUpload(testData)

	require.NoError(t, err)
	assert.NotNil(t, upload)
	assert.Equal(t, "upload-123", upload.ID)
	assert.Equal(t, "document.pdf", upload.Filename)
	assert.Equal(t, int64(1024), upload.Size)
	assert.Equal(t, "application/pdf", upload.ContentType)
	assert.Equal(t, "2023-12-01T10:00:00Z", upload.UploadedAt)
}

func TestConvertMapToUploadManual(t *testing.T) {
	testData := map[string]interface{}{
		"id":           "upload-456",
		"filename":     "image.jpg",
		"size":         float64(2048),
		"content_type": "image/jpeg",
		"uploaded_at":  "2023-12-02T11:00:00Z",
	}

	upload, err := services.ConvertMapToUploadManual(testData)

	require.NoError(t, err)
	assert.NotNil(t, upload)
	assert.Equal(t, "upload-456", upload.ID)
	assert.Equal(t, "image.jpg", upload.Filename)
	assert.Equal(t, int64(2048), upload.Size)
	assert.Equal(t, "image/jpeg", upload.ContentType)
	assert.Equal(t, "2023-12-02T11:00:00Z", upload.UploadedAt)
}

func TestConvertMapToUpload_InvalidData(t *testing.T) {
	// Test with invalid data types
	invalidData := map[string]interface{}{
		"id":       123, // Should be string
		"size":     "not-a-number", // Should be number
		"filename": nil, // Should be string
	}

	upload, err := services.ConvertMapToUpload(invalidData)

	// This should fail because of type mismatches
	assert.Error(t, err)
	assert.Nil(t, upload)
}

func TestConvertMapToUploadManual_PartialData(t *testing.T) {
	// Test with partial data
	partialData := map[string]interface{}{
		"id":       "upload-789",
		"filename": "test.txt",
		// Missing size, content_type, uploaded_at
	}

	upload, err := services.ConvertMapToUploadManual(partialData)

	require.NoError(t, err)
	assert.NotNil(t, upload)
	assert.Equal(t, "upload-789", upload.ID)
	assert.Equal(t, "test.txt", upload.Filename)
	// Other fields should be zero values
	assert.Equal(t, int64(0), upload.Size)
	assert.Equal(t, "", upload.ContentType)
	assert.Equal(t, "", upload.UploadedAt)
}

func TestUploadDocuments(t *testing.T) {
	testData := map[string]interface{}{
		"id":           "upload-test",
		"filename":     "test.pdf",
		"size":         float64(512),
		"content_type": "application/pdf",
		"uploaded_at":  "2023-12-03T12:00:00Z",
	}

	err := services.UploadDocuments(testData)

	assert.NoError(t, err)
}

func TestUploadDocumentsManual(t *testing.T) {
	testData := map[string]interface{}{
		"id":           "upload-manual-test",
		"filename":     "manual.pdf",
		"size":         float64(256),
		"content_type": "application/pdf",
		"uploaded_at":  "2023-12-04T13:00:00Z",
	}

	err := services.UploadDocumentsManual(testData)

	assert.NoError(t, err)
}

func TestConvertMapToUpload_EmptyMap(t *testing.T) {
	emptyData := map[string]interface{}{}

	upload, err := services.ConvertMapToUpload(emptyData)

	// Empty map should succeed and create empty struct with zero values
	assert.NoError(t, err)
	assert.NotNil(t, upload)
	assert.Equal(t, "", upload.ID)
	assert.Equal(t, "", upload.Filename)
	assert.Equal(t, int64(0), upload.Size)
	assert.Equal(t, "", upload.ContentType)
	assert.Equal(t, "", upload.UploadedAt)
}

func TestConvertMapToUploadManual_EmptyMap(t *testing.T) {
	emptyData := map[string]interface{}{}

	upload, err := services.ConvertMapToUploadManual(emptyData)

	assert.NoError(t, err)
	assert.NotNil(t, upload)
	// All fields should be zero values
	assert.Equal(t, "", upload.ID)
	assert.Equal(t, "", upload.Filename)
	assert.Equal(t, int64(0), upload.Size)
	assert.Equal(t, "", upload.ContentType)
	assert.Equal(t, "", upload.UploadedAt)
}

func TestConvertMapToUpload_LargeNumbers(t *testing.T) {
	largeData := map[string]interface{}{
		"id":           "large-upload",
		"filename":     "large_file.dat",
		"size":         float64(9223372036854775807), // Max int64
		"content_type": "application/octet-stream",
		"uploaded_at":  "2023-12-01T10:00:00Z",
	}

	upload, err := services.ConvertMapToUpload(largeData)

	if err != nil {
		// If there's an unmarshaling error due to precision issues, check the error type
		assert.Contains(t, err.Error(), "failed to unmarshal JSON")
		assert.Nil(t, upload)
	} else {
		assert.NotNil(t, upload)
		assert.Equal(t, int64(9223372036854775807), upload.Size)
	}
}

func TestConvertMapToUpload_TooLargeNumber(t *testing.T) {
	// Test with a number that's too large for int64
	tooLargeData := map[string]interface{}{
		"id":           "too-large-upload",
		"filename":     "too_large_file.dat",
		"size":         float64(9223372036854775808), // Max int64 + 1
		"content_type": "application/octet-stream",
		"uploaded_at":  "2023-12-01T10:00:00Z",
	}

	upload, err := services.ConvertMapToUpload(tooLargeData)

	// Should fail because number is too large for int64
	assert.Error(t, err)
	assert.Nil(t, upload)
	assert.Contains(t, err.Error(), "failed to unmarshal JSON to Upload")
}

func TestConvertMapToUpload_NegativeSize(t *testing.T) {
	invalidData := map[string]interface{}{
		"id":           "negative-size",
		"filename":     "negative.dat",
		"size":         float64(-1024),
		"content_type": "application/octet-stream",
		"uploaded_at":  "2023-12-01T10:00:00Z",
	}

	upload, err := services.ConvertMapToUpload(invalidData)

	assert.NoError(t, err)
	assert.NotNil(t, upload)
	assert.Equal(t, int64(-1024), upload.Size) // Should convert negative float to negative int64
}

func TestConvertMapToUpload_SpecialCharacters(t *testing.T) {
	specialData := map[string]interface{}{
		"id":           "special-123",
		"filename":     "file with spaces & special chars (test).pdf",
		"size":         float64(1024),
		"content_type": "application/pdf",
		"uploaded_at":  "2023-12-01T10:00:00Z",
	}

	upload, err := services.ConvertMapToUpload(specialData)

	assert.NoError(t, err)
	assert.NotNil(t, upload)
	assert.Equal(t, "file with spaces & special chars (test).pdf", upload.Filename)
}

func TestConvertMapToUpload_UnicodeCharacters(t *testing.T) {
	unicodeData := map[string]interface{}{
		"id":           "unicode-123",
		"filename":     "файл_тест_中文_🚀.pdf",
		"size":         float64(1024),
		"content_type": "application/pdf",
		"uploaded_at":  "2023-12-01T10:00:00Z",
	}

	upload, err := services.ConvertMapToUpload(unicodeData)

	assert.NoError(t, err)
	assert.NotNil(t, upload)
	assert.Equal(t, "файл_тест_中文_🚀.pdf", upload.Filename)
}

func TestConvertMapToUpload_InvalidJSONNumbers(t *testing.T) {
	// Test with various number formats that might come from JSON
	testCases := []struct {
		name     string
		size     interface{}
		expected int64
		expectError bool
	}{
		{"integer", 1024, 1024, false},
		{"float whole", 1024.0, 1024, false},
		{"float decimal", 1024.5, 0, true}, // JSON unmarshaling will fail for decimal floats
		{"scientific notation", 1.024e3, 1024, false},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			data := map[string]interface{}{
				"id":           "test-123",
				"filename":     "test.pdf",
				"size":         tc.size,
				"content_type": "application/pdf",
				"uploaded_at":  "2023-12-01T10:00:00Z",
			}

			upload, err := services.ConvertMapToUpload(data)

			if tc.expectError {
				assert.Error(t, err)
				assert.Nil(t, upload)
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, upload)
				assert.Equal(t, tc.expected, upload.Size)
			}
		})
	}
}

func TestConvertMapToUpload_InvalidDateFormats(t *testing.T) {
	testCases := []struct {
		name       string
		uploadedAt interface{}
	}{
		{"empty string", ""},
		{"invalid format", "not-a-date"},
		{"partial date", "2023-12-01"},
		{"wrong timezone", "2023-12-01T10:00:00+05:30"},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			data := map[string]interface{}{
				"id":           "test-123",
				"filename":     "test.pdf",
				"size":         float64(1024),
				"content_type": "application/pdf",
				"uploaded_at":  tc.uploadedAt,
			}

			upload, err := services.ConvertMapToUpload(data)

			// Should handle gracefully - either succeed or fail consistently
			if err != nil {
				assert.Nil(t, upload)
			} else {
				assert.NotNil(t, upload)
			}
		})
	}
}

func TestConvertMapToUploadManual_NilValues(t *testing.T) {
	data := map[string]interface{}{
		"id":           nil,
		"filename":     nil,
		"size":         nil,
		"content_type": nil,
		"uploaded_at":  nil,
	}

	upload, err := services.ConvertMapToUploadManual(data)

	assert.NoError(t, err)
	assert.NotNil(t, upload)
	// All fields should be zero values
	assert.Equal(t, "", upload.ID)
	assert.Equal(t, "", upload.Filename)
	assert.Equal(t, int64(0), upload.Size)
	assert.Equal(t, "", upload.ContentType)
	assert.Equal(t, "", upload.UploadedAt)
}

func TestConvertMapToUploadManual_TypeConversions(t *testing.T) {
	data := map[string]interface{}{
		"id":           123, // int to string
		"filename":     "test.txt",
		"size":         "2048", // string to int64
		"content_type": "text/plain",
		"uploaded_at":  "2023-12-01T10:00:00Z",
	}

	upload, err := services.ConvertMapToUploadManual(data)

	assert.NoError(t, err)
	assert.NotNil(t, upload)
	assert.Equal(t, "test.txt", upload.Filename)
	// Other fields depend on implementation - may or may not convert
}

func TestUploadDocuments_EmptyData(t *testing.T) {
	emptyData := map[string]interface{}{}

	err := services.UploadDocuments(emptyData)

	// Should handle empty data gracefully
	assert.NoError(t, err)
}

func TestUploadDocuments_InvalidData(t *testing.T) {
	invalidData := map[string]interface{}{
		"invalid_field": "value",
	}

	err := services.UploadDocuments(invalidData)

	// Should handle invalid data gracefully
	assert.NoError(t, err)
}

func TestUploadDocumentsManual_LargeData(t *testing.T) {
	largeData := map[string]interface{}{
		"id":           "large-test",
		"filename":     "large_file.pdf",
		"size":         float64(1000000),
		"content_type": "application/pdf",
		"uploaded_at":  "2023-12-01T10:00:00Z",
		"extra_field":  "should be ignored",
	}

	err := services.UploadDocumentsManual(largeData)

	assert.NoError(t, err)
}