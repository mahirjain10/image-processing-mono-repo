package utils

import (
	"fmt"
	"os"
	"path/filepath"
)

func PathUtil(path string, key string) (string, error) {
	filePath := filepath.Join(path, key)

	// Create all parent directories
	if err := os.MkdirAll(filepath.Dir(filePath), os.ModePerm); err != nil {
		return "", fmt.Errorf("failed to create directories: %w", err)
	}
	return filePath, nil
}
