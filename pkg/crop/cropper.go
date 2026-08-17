package crop

import (
	"fmt"
	"image"
	"image/png"
	"os"

	appErrors "go-deno-ts/pkg/errors"
)

type Area struct {
	X      int `json:"x"`
	Y      int `json:"y"`
	Width  int `json:"width"`
	Height int `json:"height"`
}

type Cropper interface {
	Crop(srcPath, dstPath string, area *Area) error
}

type PNGSubImageCropper struct{}

func NewPNGSubImageCropper() *PNGSubImageCropper {
	return &PNGSubImageCropper{}
}

func (c *PNGSubImageCropper) Crop(srcPath, dstPath string, area *Area) error {
	if area == nil || area.Width <= 0 || area.Height <= 0 {
		return fmt.Errorf("%w: invalid crop area dimensions", appErrors.ErrCropFailed)
	}

	file, err := os.Open(srcPath)
	if err != nil {
		return fmt.Errorf("%w: failed to open source image: %v", appErrors.ErrCropFailed, err)
	}
	defer file.Close()

	img, err := png.Decode(file)
	if err != nil {
		return fmt.Errorf("%w: failed to decode PNG image: %v", appErrors.ErrCropFailed, err)
	}

	rect := image.Rect(area.X, area.Y, area.X+area.Width, area.Y+area.Height)
	subImg, ok := img.(interface {
		SubImage(r image.Rectangle) image.Image
	})
	if !ok {
		return fmt.Errorf("%w: image type does not support SubImage cropping", appErrors.ErrCropFailed)
	}

	cropped := subImg.SubImage(rect)

	outFile, err := os.Create(dstPath)
	if err != nil {
		return fmt.Errorf("%w: failed to create destination file: %v", appErrors.ErrCropFailed, err)
	}
	defer outFile.Close()

	if err := png.Encode(outFile, cropped); err != nil {
		return fmt.Errorf("%w: failed to encode cropped PNG: %v", appErrors.ErrCropFailed, err)
	}

	return nil
}
