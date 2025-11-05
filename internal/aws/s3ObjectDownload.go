package aws

import (
	"context"
	"fmt"
	"io"
	"log"
	"os"
	"path/filepath"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/s3"
)

// Creating Dependency
type S3Service struct {
	client          *s3.Client
	bucketName      string
	rawDownloadPath string
}

// Using Constructor Pattern to initalize our s3Service
func NewS3Service(client *s3.Client, bucketName string, rawDownloadPath string) *S3Service {
	return &S3Service{client: client, bucketName: bucketName, rawDownloadPath: rawDownloadPath}
}

// Creation of individual context leads to cancellation of individual downloads
// Create a child context from parent context so that we can cancel inflights download when app shutsdown

func (service *S3Service) S3ObjectDownload(ctx context.Context, key string) error {
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	resp, err := service.client.GetObject(ctx, &s3.GetObjectInput{
		Bucket: aws.String(service.bucketName),
		Key:    aws.String(key),
	})
	if err != nil {
		return fmt.Errorf("couldn't download object with key: %s", key)
	}
	defer resp.Body.Close()

	// Create full file path including all nested directories from the key
	filePath := filepath.Join(service.rawDownloadPath, key)

	// Create all parent directories
	if err := os.MkdirAll(filepath.Dir(filePath), os.ModePerm); err != nil {
		return fmt.Errorf("failed to create directories: %w", err)
	}

	outFile, err := os.Create(filePath)
	if err != nil {
		return fmt.Errorf("failed to create file: %w", err)
	}
	defer outFile.Close()

	_, err = io.Copy(outFile, resp.Body)
	if err != nil {
		return fmt.Errorf("failed to write object data: %w", err)
	}
	log.Println("download success")
	return nil
}
