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
	"github.com/aws/aws-sdk-go-v2/feature/s3/manager"
	"github.com/aws/aws-sdk-go-v2/service/s3"
)

// Creating Dependency
type S3Service struct {
	client             *s3.Client
	bucketName         string
	downloadUploadPath string
	s3Manager          *manager.Uploader
}

// Using Constructor Pattern to initalize our s3Service
func NewS3Service(client *s3.Client, bucketName string, rawDownloadPath string, s3Manager *manager.Uploader) *S3Service {
	return &S3Service{client: client, bucketName: bucketName, downloadUploadPath: rawDownloadPath, s3Manager: s3Manager}
}

func (s3Service *S3Service) GetDependencyData() (string, string) {
	return s3Service.bucketName, s3Service.downloadUploadPath
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
		return fmt.Errorf("couldn't download object with key: %s, AWS error: %w", key, err)
	}
	defer resp.Body.Close()

	// Create full file path including all nested directories from the key
	filePath := filepath.Join(service.downloadUploadPath, key)

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

// func (service *S3Service) UploadtoS3Object(key string) error {
// 	filePath := filepath.Join(service.downloadUploadPath, key)

// 	// Create all parent directories
// 	if err := os.MkdirAll(filepath.Dir(filePath), os.ModePerm); err != nil {
// 		return fmt.Errorf("failed to create directories: %w", err)
// 	}
// 	var outKey string
// 	input := &s3.PutObjectInput{
// 		Bucket:            aws.String(service.bucketName),
// 		Key:               aws.String(key),
// 		Body:              bytes.NewReader([]byte(contents)),
// 		ChecksumAlgorithm: types.ChecksumAlgorithmSha256,
// 	}
// 	return nil
// }
