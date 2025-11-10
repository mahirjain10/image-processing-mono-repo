package utils

import (
	"fmt"
	"os" // Replaced bimg with os
)

func ReadImageBuffer(imagePath string) ([]byte, error) {
	// os.ReadFile does the same thing as bimg.Read
	buffer, err := os.ReadFile(imagePath)
	if err != nil {
		return nil, fmt.Errorf("error while reading image :%v", err)
	}
	return buffer, nil
}
