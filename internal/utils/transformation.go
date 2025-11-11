package utils

import (
	"fmt"
	"os" // Replaced bimg with os
	"path/filepath"
)

func ReadImageBuffer(imagePath string) ([]byte, error) {
	// os.ReadFile does the same thing as bimg.Read
	buffer, err := os.ReadFile(imagePath)
	if err != nil {
		return nil, fmt.Errorf("error while reading image :%v", err)
	}
	return buffer, nil
}

func WriteImageBuffer(imageBytes []byte, filename string) error {
	outputPath := "D:/image-processing-backend/go-workers/images/processed"

	// Ensure directory exists
	err := os.MkdirAll(outputPath, os.ModePerm)
	if err != nil {
		return fmt.Errorf("failed to create directory: %w", err)
	}

	fullPath := filepath.Join(outputPath, filename)

	err = os.WriteFile(fullPath, imageBytes, 0644)
	if err != nil {
		return fmt.Errorf("failed to write image: %w", err)
	}

	fmt.Println("Image saved at:", fullPath)
	return nil
}
