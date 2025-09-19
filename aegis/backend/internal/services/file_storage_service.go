package services

import (
	"context"
	"io"

	"github.com/minio/minio-go/v7"
)

// FileStorageService is a service for interacting with a file storage system.
type FileStorageService struct {
	minioClient *minio.Client
	bucketName  string
}

// NewFileStorageService creates a new FileStorageService.
func NewFileStorageService(minioClient *minio.Client, bucketName string) *FileStorageService {
	return &FileStorageService{
		minioClient: minioClient,
		bucketName:  bucketName,
	}
}

// UploadFile uploads a file to the file storage system.
func (s *FileStorageService) UploadFile(ctx context.Context, objectName string, reader io.Reader, objectSize int64, contentType string) error {
	_, err := s.minioClient.PutObject(ctx, s.bucketName, objectName, reader, objectSize, minio.PutObjectOptions{
		ContentType: contentType,
	})
	return err
}

// DownloadFile downloads a file from the file storage system.
func (s *FileStorageService) DownloadFile(ctx context.Context, objectName string) (*minio.Object, error) {
	return s.minioClient.GetObject(ctx, s.bucketName, objectName, minio.GetObjectOptions{})
}

// DeleteFile deletes a file from the file storage system.
func (s *FileStorageService) DeleteFile(ctx context.Context, objectName string) error {
	return s.minioClient.RemoveObject(ctx, s.bucketName, objectName, minio.RemoveObjectOptions{})
}
