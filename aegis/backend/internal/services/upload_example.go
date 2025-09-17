package services

import (
	"fmt"
)

// This file demonstrates the PROBLEM and SOLUTION for the Go type conversion error

// PROBLEMATIC CODE (This will cause: "map[string]interface {} is not an Upload")
/*
type Upload struct {
    ID       string `json:"id"`
    Filename string `json:"filename"`
    Size     int64  `json:"size"`
}

func uploadDocumentsBROKEN(data map[string]interface{}) {
    var u Upload = data // ❌ COMPILER ERROR: cannot assign map to struct
    fmt.Printf("Upload: %+v\n", u)
}
*/

// SOLUTION CODE (Proper way to handle the conversion)

type ExampleUpload struct {
    ID          string `json:"id"`
    Filename    string `json:"filename"`
    Size        int64  `json:"size"`
    ContentType string `json:"content_type"`
    UploadedAt  string `json:"uploaded_at"`
}

// ExampleUsage demonstrates how to properly convert map[string]interface{} to struct
func ExampleUsage() {
    // Sample data that might come from JSON parsing or external API
    data := map[string]interface{}{
        "id":           "example-123",
        "filename":     "sample.pdf",
        "size":         float64(1024), // Note: JSON numbers are float64
        "content_type": "application/pdf",
        "uploaded_at":  "2023-12-01T10:00:00Z",
    }

    fmt.Println("=== SOLUTION 1: JSON Unmarshaling ===")
    upload1, err := ConvertMapToUpload(data)
    if err != nil {
        fmt.Printf("Error: %v\n", err)
    } else {
        fmt.Printf("Converted upload: %+v\n", upload1)
    }

    fmt.Println("\n=== SOLUTION 2: Manual Field Assignment ===")
    upload2, err := ConvertMapToUploadManual(data)
    if err != nil {
        fmt.Printf("Error: %v\n", err)
    } else {
        fmt.Printf("Converted upload: %+v\n", upload2)
    }

    fmt.Println("\n=== SOLUTION 3: Using in Function ===")
    err = UploadDocuments(data)
    if err != nil {
        fmt.Printf("Error: %v\n", err)
    }
}