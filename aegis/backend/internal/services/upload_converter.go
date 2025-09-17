package services

import (
	"encoding/json"
	"fmt"
)

// Upload represents a document upload structure
type Upload struct {
	ID          string `json:"id"`
	Filename    string `json:"filename"`
	Size        int64  `json:"size"`
	ContentType string `json:"content_type"`
	UploadedAt  string `json:"uploaded_at"`
}

// ConvertMapToUpload converts a map[string]interface{} to Upload struct
// This demonstrates the proper way to handle type conversion
func ConvertMapToUpload(data map[string]interface{}) (*Upload, error) {
	// Method 1: JSON marshaling/unmarshaling (recommended for complex structures)
	jsonData, err := json.Marshal(data)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal map to JSON: %w", err)
	}

	var upload Upload
	err = json.Unmarshal(jsonData, &upload)
	if err != nil {
		return nil, fmt.Errorf("failed to unmarshal JSON to Upload: %w", err)
	}

	return &upload, nil
}

// ConvertMapToUploadManual demonstrates manual field assignment
// Useful when you need more control over type conversions
func ConvertMapToUploadManual(data map[string]interface{}) (*Upload, error) {
	upload := &Upload{}

	// Safely extract and convert each field
	if id, ok := data["id"].(string); ok {
		upload.ID = id
	}

	if filename, ok := data["filename"].(string); ok {
		upload.Filename = filename
	}

	// Handle numeric conversion (JSON numbers are float64)
	if size, ok := data["size"].(float64); ok {
		upload.Size = int64(size)
	}

	if contentType, ok := data["content_type"].(string); ok {
		upload.ContentType = contentType
	}

	if uploadedAt, ok := data["uploaded_at"].(string); ok {
		upload.UploadedAt = uploadedAt
	}

	return upload, nil
}

// UploadDocuments demonstrates the fixed version of the original problematic function
func UploadDocuments(data map[string]interface{}) error {
	// Instead of: var u Upload = data // This causes the error

	// Use proper conversion
	upload, err := ConvertMapToUpload(data)
	if err != nil {
		return fmt.Errorf("failed to convert map to Upload: %w", err)
	}

	// Now you can use the upload struct
	fmt.Printf("Successfully converted upload: %+v\n", upload)

	// Add your upload processing logic here
	// ...

	return nil
}

// UploadDocumentsManual demonstrates manual conversion approach
func UploadDocumentsManual(data map[string]interface{}) error {
	upload, err := ConvertMapToUploadManual(data)
	if err != nil {
		return fmt.Errorf("failed to convert map to Upload manually: %w", err)
	}

	fmt.Printf("Successfully converted upload manually: %+v\n", upload)

	// Add your upload processing logic here
	// ...

	return nil
}