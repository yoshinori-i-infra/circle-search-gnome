package crop

import (
	"image"
	"image/color"
	"image/png"
	"os"
	"path/filepath"
	"testing"
)

func TestPNGSubImageCropper_Crop(t *testing.T) {
	tempDir := t.TempDir()
	srcPath := filepath.Join(tempDir, "test_source.png")
	dstPath := filepath.Join(tempDir, "test_cropped.png")

	img := image.NewRGBA(image.Rect(0, 0, 100, 100))
	for x := 0; x < 100; x++ {
		for y := 0; y < 100; y++ {
			img.Set(x, y, color.RGBA{R: 255, G: 0, B: 0, A: 255})
		}
	}
	f, err := os.Create(srcPath)
	if err != nil {
		t.Fatalf("failed to create test source image: %v", err)
	}
	_ = png.Encode(f, img)
	_ = f.Close()

	cropper := NewPNGSubImageCropper()

	area := &Area{X: 10, Y: 10, Width: 50, Height: 50}
	if err := cropper.Crop(srcPath, dstPath, area); err != nil {
		t.Fatalf("unexpected error during Crop: %v", err)
	}

	croppedFile, err := os.Open(dstPath)
	if err != nil {
		t.Fatalf("failed to open cropped image: %v", err)
	}
	defer croppedFile.Close()

	croppedImg, err := png.Decode(croppedFile)
	if err != nil {
		t.Fatalf("failed to decode cropped image: %v", err)
	}

	bounds := croppedImg.Bounds()
	if bounds.Dx() != 50 || bounds.Dy() != 50 {
		t.Errorf("expected size 50x50, got %dx%d", bounds.Dx(), bounds.Dy())
	}
}
