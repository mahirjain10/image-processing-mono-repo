package utils

import (
	"fmt"
	"os"
)

func ReadImageBuffer(imagePath string) ([]byte, error) {
	// os.ReadFile does the same thing as bimg.Read
	buffer, err := os.ReadFile(imagePath)
	if err != nil {
		return nil, fmt.Errorf("error while reading image :%v", err)
	}
	return buffer, nil
}

func WriteImageBuffer(pathName string, imageBytes []byte) error {

	err := os.WriteFile(pathName, imageBytes, 0644)
	if err != nil {
		return fmt.Errorf("failed to write image: %w", err)
	}

	fmt.Println("Image saved at:", pathName)
	return nil
}
