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