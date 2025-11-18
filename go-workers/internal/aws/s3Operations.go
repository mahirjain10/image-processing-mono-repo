package aws

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"log"
	"os"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/aws/aws-sdk-go-v2/service/s3/types"
	"github.com/mahirjain10/go-workers/internal/utils"
)

// Creating Dependency
type S3Service struct {
	client       *s3.Client
	bucketName   string
	uploadPath   string
	downloadPath string
}

// Using Constructor Pattern to initalize our s3Service
func NewS3Service(client *s3.Client, bucketName string, downloadPath string, uploadPath string) *S3Service {
	return &S3Service{client: client, bucketName: bucketName, downloadPath: downloadPath, uploadPath: uploadPath}
}

func (s3Service *S3Service) GetDependencyData() (string, string, string) {
	return s3Service.bucketName, s3Service.downloadPath, s3Service.uploadPath
}

func (service *S3Service) DownloadFromS3Object(ctx context.Context, key string) error {
	ctx, cancel := context.WithTimeout(ctx, 1*time.Second)
	defer cancel()

	resp, err := service.client.GetObject(ctx, &s3.GetObjectInput{
		Bucket: aws.String(service.bucketName),
		Key:    aws.String(key),
	})
	if err != nil {
		return fmt.Errorf("couldn't download object with key: %s, AWS error: %w", key, err)
	}
	defer resp.Body.Close()

	filePath, err := utils.PathUtil(service.downloadPath, key)
	if err != nil {
		return err
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

func (service *S3Service) UploadtoS3Object(parentCtx context.Context, key string) (string, error) {

	// return "",fmt.Errorf("error") // To test if we are failure is working or not

	ctx, cancel := context.WithTimeout(parentCtx, 1*time.Minute)
	defer cancel()

	var publicUrl string = ""

	// Create filepath
	filePath, err := utils.PathUtil(service.uploadPath, key)
	if err != nil {
		return publicUrl, err
	}
	log.Printf("file ptah while uploading: %v", filePath)
	// Read imagebuffer or return error
	imageBuffer, err := utils.ReadImageBuffer(filePath)
	if err != nil {
		return publicUrl, err
	}
	log.Println("key :", key)

	// Input Options
	input := &s3.PutObjectInput{
		Bucket:            aws.String(service.bucketName),
		Key:               aws.String(key),
		Body:              bytes.NewReader(imageBuffer),
		ChecksumAlgorithm: types.ChecksumAlgorithmSha256,
		// ACL:               types.ObjectCannedACLPublicRead,
	}
	_, err = service.client.PutObject(ctx, input)
	if err != nil {
		return "", err
	}

	// Step 2: Generate a pre-signed download URL (valid for 15 min)
	presignClient := s3.NewPresignClient(service.client)

	req, err := presignClient.PresignGetObject(ctx, &s3.GetObjectInput{
		Bucket: aws.String(service.bucketName),
		Key:    aws.String(key),
	}, s3.WithPresignExpires(15*time.Minute))
	if err != nil {
		return "", fmt.Errorf("failed to presign url: %w", err)
	}

	// Step 3: Return URL to the client
	return req.URL, nil
}

func (service *S3Service) DeleteS3Object(parentCtx context.Context, key string) (bool, error) {
	if key == "" {
		return false, errors.New("key cannot be empty")
	}

	ctx, cancel := context.WithTimeout(parentCtx, 1*time.Minute)
	defer cancel()

	deleteInput := &s3.DeleteObjectInput{
		Bucket: aws.String(service.bucketName),
		Key:    aws.String(key),
	}

	if _, err := service.client.DeleteObject(ctx, deleteInput); err != nil {
		return false, fmt.Errorf("failed to delete object %s: %w", key, err)
	}

	return true, nil
}
