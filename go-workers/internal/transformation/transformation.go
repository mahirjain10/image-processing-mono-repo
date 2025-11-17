package transformation

import (
	"bytes"
	"fmt"
	"image"

	// We must import the image formats we want to support,
	// even if we don't use them directly. This "registers"
	// their decoders with the standard 'image' package.
	_ "image/gif"
	_ "image/jpeg"
	_ "image/png"

	"github.com/disintegration/imaging"
)

// getFormat maps the string format from image.Decode to the imaging.Format enum
func getFormat(format string) (imaging.Format, error) {
	switch format {
	case "jpeg":
		return imaging.JPEG, nil
	case "png":
		return imaging.PNG, nil
	case "gif":
		return imaging.GIF, nil
	case "bmp":
		return imaging.BMP, nil
	case "tiff":
		return imaging.TIFF, nil
	default:
		return -1, fmt.Errorf("unsupported original format for re-encoding: %s", format)
	}
}

func Resize(buffer []byte, height int, width int) ([]byte, error) {
	// 1. Decode the image
	img, formatStr, err := image.Decode(bytes.NewReader(buffer))
	if err != nil {
		return nil, fmt.Errorf("failed to decode image: %v", err)
	}

	// 2. Get the original format for re-encoding
	format, err := getFormat(formatStr)
	if err != nil {
		return nil, err
	}

	// 3. Transform: bimg.Resize is like imaging.Thumbnail (fits within box)
	newImage := imaging.Thumbnail(img, width, height, imaging.Lanczos)

	// 4. Re-encode to a new buffer
	buf := new(bytes.Buffer)
	if err = imaging.Encode(buf, newImage, format); err != nil {
		return nil, fmt.Errorf("error while resizing: %v", err)
	}
	return buf.Bytes(), nil
}

func Rotate(buffer []byte, degree int) ([]byte, error) {
	// 1. Decode
	img, formatStr, err := image.Decode(bytes.NewReader(buffer))
	if err != nil {
		return nil, fmt.Errorf("failed to decode image: %v", err)
	}

	// 2. Get format
	format, err := getFormat(formatStr)
	if err != nil {
		return nil, err
	}

	// 3. Transform
	var newImage image.Image
	switch degree {
	case 90:
		newImage = imaging.Rotate90(img)
	case 180:
		newImage = imaging.Rotate180(img)
	case 270:
		newImage = imaging.Rotate270(img)
	case 0:
		newImage = img
	default:
		// bimg only supports 90, 180, 270. imaging.Rotate() can do any angle,
		// but we'll stick to the original logic.
		return nil, fmt.Errorf("unsupported angle: %d. Only 0, 90, 180, 270 supported", degree)
	}

	// 4. Re-encode
	buf := new(bytes.Buffer)
	if err = imaging.Encode(buf, newImage, format); err != nil {
		return nil, fmt.Errorf("error while rotating: %v", err)
	}
	return buf.Bytes(), nil
}

func Convert(buffer []byte, ext string) ([]byte, error) {
	// 1. Decode
	img, _, err := image.Decode(bytes.NewReader(buffer))
	if err != nil {
		return nil, fmt.Errorf("failed to decode image: %v", err)
	}

	// 2. Find target format
	var format imaging.Format
	switch ext {
	case "PNG":
		format = imaging.PNG
	case "JPEG":
		format = imaging.JPEG
	case "GIF":
		format = imaging.GIF
	case "BMP":
		format = imaging.BMP
	case "TIFF":
		format = imaging.TIFF
	case "PDF":
		return nil, fmt.Errorf("PDF conversion is not supported by pure Go libraries")
	default:
		return nil, fmt.Errorf("currently supporting %s only", ext)
	}

	// 3. Encode to the new format
	buf := new(bytes.Buffer)
	if err = imaging.Encode(buf, img, format); err != nil {
		return nil, fmt.Errorf("error while converting: %v", err)
	}
	return buf.Bytes(), nil
}

func ForceResize(buffer []byte, height int, width int) ([]byte, error) {
	// 1. Decode
	img, formatStr, err := image.Decode(bytes.NewReader(buffer))
	if err != nil {
		return nil, fmt.Errorf("failed to decode image: %v", err)
	}

	// 2. Get format
	format, err := getFormat(formatStr)
	if err != nil {
		return nil, err
	}

	// 3. Transform: bimg.ForceResize is like imaging.Resize (stretches)
	newImage := imaging.Resize(img, width, height, imaging.Lanczos)

	// 4. Re-encode
	buf := new(bytes.Buffer)
	if err = imaging.Encode(buf, newImage, format); err != nil {
		return nil, fmt.Errorf("error while force resizing: %v", err)
	}
	return buf.Bytes(), nil
}
