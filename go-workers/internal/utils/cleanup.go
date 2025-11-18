package utils

import (
	"context"
	"fmt"
	"log"
	"os"
	"strings"
)

// S3Deleter is the minimal interface we need from your s3 service.
type S3Deleter interface {
	// DeleteS3Object should match your real signature: (ctx, key) -> (whatever, error)
	DeleteS3Object(ctx context.Context, key string) (bool, error)
}

// RemoveLocalRaw removes the local "raw" file at downloadPath + s3RawKey.
func RemoveLocalRaw(downloadPath, s3RawKey string) error {
	fp, err := PathUtil(downloadPath, s3RawKey)
	if err != nil {
		return fmt.Errorf("construct raw file path: %w", err)
	}
	if err := os.Remove(fp); err != nil {
		return fmt.Errorf("remove raw file %q: %w", fp, err)
	}
	log.Printf("removed local raw file: %s", fp)
	return nil
}

// RemoveLocalProcessed removes the derived processed file under uploadPath.
// It uses the same trimming/formatting logic as your original snippet.
func RemoveLocalProcessed(uploadPath, s3RawKey string) error {
	trimmed := strings.TrimPrefix(s3RawKey, "raw/")
	formatted := fmt.Sprintf("processed/%s", trimmed)

	fp, err := PathUtil(uploadPath, formatted)
	if err != nil {
		return fmt.Errorf("construct processed file path: %w", err)
	}
	if err := os.Remove(fp); err != nil {
		return fmt.Errorf("remove processed file %q: %w", fp, err)
	}
	log.Printf("removed local processed file: %s", fp)
	return nil
}

func DeleteS3Object(ctx context.Context, s3 S3Deleter, s3Key string) error {
	if _, err := s3.DeleteS3Object(ctx, s3Key); err != nil {
		return fmt.Errorf("delete s3 object %q: %w", s3Key, err)
	}
	log.Printf("s3 object %s deleted successfully", s3Key)
	return nil
}

func CleanupAll(ctx context.Context, s3 S3Deleter, downloadPath, uploadPath, s3RawKey string) error {
	var errs []string

	if err := RemoveLocalRaw(downloadPath, s3RawKey); err != nil {
		log.Printf("warning: %v", err)
		errs = append(errs, err.Error())
	}

	if err := RemoveLocalProcessed(uploadPath, s3RawKey); err != nil {
		log.Printf("warning: %v", err)
		errs = append(errs, err.Error())
	}

	if err := DeleteS3Object(ctx, s3, s3RawKey); err != nil {
		log.Printf("warning: %v", err)
		errs = append(errs, err.Error())
	}

	if len(errs) > 0 {
		return fmt.Errorf("cleanup errors: %s", strings.Join(errs, " | "))
	}
	log.Println("raw and processed file removed successfully, s3 object deleted")
	return nil
}
