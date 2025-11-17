package handlers

import (
	"fmt"
	"log"
	"path"
	"strings"

	"github.com/mahirjain10/go-workers/internal/aws"
	"github.com/mahirjain10/go-workers/internal/transformation"
	"github.com/mahirjain10/go-workers/internal/types"
	"github.com/mahirjain10/go-workers/internal/utils"
)

type TransformHandler struct {
	s3Service *aws.S3Service
}

func NewTransformHandler(s3Service *aws.S3Service) *TransformHandler {
	return &TransformHandler{
		s3Service: s3Service,
	}
}

func (h *TransformHandler) TransformImage(imageProcessing types.ImageProcessing) error {
	_, downloadPath, uploadPath := h.s3Service.GetDependencyData()
	// Prepare a download path
	updatedDownloadPath, err := utils.PathUtil(downloadPath, imageProcessing.S3RawKey)
	if err != nil {
		return err
	}
	// Read image buffer from the download path
	imageBuffer, err := utils.ReadImageBuffer(updatedDownloadPath)
	if err != nil {
		return err
	}

	var transformedImageBytes []byte
	var formatToConvert = ""
	switch imageProcessing.TransformationType {
	case "RESIZE":
		var resize *types.Resize
		if err := utils.ParseJSON([]byte(imageProcessing.TransformationParameters), &resize); err != nil {
			return fmt.Errorf("failed to parse message: %w", err)
		}
		transformedImageBytes, err = transformation.Resize(imageBuffer, resize.Height, resize.Width)
		if err != nil {
			return err
		}

	case "ROTATE":
		var rotate *types.Rotate
		if err := utils.ParseJSON([]byte(imageProcessing.TransformationParameters), &rotate); err != nil {
			return fmt.Errorf("failed to parse message: %w", err)
		}
		transformedImageBytes, err = transformation.Rotate(imageBuffer, rotate.Degree)
		if err != nil {
			return err
		}

	case "CONVERT":
		var convert *types.Convert
		if err := utils.ParseJSON([]byte(imageProcessing.TransformationParameters), &convert); err != nil {
			return fmt.Errorf("failed to parse message: %w", err)
		}
		formatToConvert = strings.ToLower(convert.Format)
		transformedImageBytes, err = transformation.Convert(imageBuffer, convert.Format)
		if err != nil {
			return err
		}

	case "FORCE_RESIZE":
		var resize *types.Resize
		if err := utils.ParseJSON([]byte(imageProcessing.TransformationParameters), &resize); err != nil {
			return fmt.Errorf("failed to parse message: %w", err)
		}
		transformedImageBytes, err = transformation.ForceResize(imageBuffer, resize.Height, resize.Width)
		if err != nil {
			return err
		}

	default:
		return fmt.Errorf("unsupported transformation type: %s", imageProcessing.TransformationType)
	}

	log.Println("split looks like ", strings.Split(imageProcessing.S3RawKey, "/"))

	var finalKey string
	// Get the s3key and separate the "raw/"
	parts := strings.Split(imageProcessing.S3RawKey, "/")
	if len(parts) < 2 {
		return fmt.Errorf("unexpected S3RawKey format: %s", imageProcessing.S3RawKey)
	}
	finalKey = parts[1]
	if imageProcessing.TransformationType == "CONVERT" {
		dotSplit := strings.Split(parts[1], ".")
		if len(dotSplit) < 2 {
			return fmt.Errorf("unexpected S3RawKey format: %s", imageProcessing.S3RawKey)
		}
		finalKey = fmt.Sprintf("%s.%s", dotSplit[0], formatToConvert)
	}

	// Format the upload path where it saves the image and from where images can be uploaded
	formattedUploadPath, err := utils.PathUtil(path.Join(uploadPath, "processed"), finalKey)
	if err != nil {
		return err
	}
	log.Printf("formatted path :%s", formattedUploadPath)

	// Write image buffer to the path from where it would be uploaded to s3
	err = utils.WriteImageBuffer(formattedUploadPath, transformedImageBytes)
	if err != nil {
		return err
	}

	return nil
}
