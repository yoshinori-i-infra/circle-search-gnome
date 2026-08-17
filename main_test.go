package main

import (
	"context"
	"image"
	"image/color"
	"image/png"
	"os"
	"testing"

	"go-deno-ts/pkg/analyzer"
	"go-deno-ts/pkg/crop"
)

// mockCapturer はテスト用のダミーキャプチャ画像を生成するモックです。
type mockCapturer struct{}

func (m *mockCapturer) Capture(ctx context.Context, outputPath string) error {
	img := image.NewRGBA(image.Rect(0, 0, 200, 200))
	for x := 0; x < 200; x++ {
		for y := 0; y < 200; y++ {
			img.Set(x, y, color.RGBA{R: 0, G: 255, B: 0, A: 255})
		}
	}
	f, err := os.Create(outputPath)
	if err != nil {
		return err
	}
	defer f.Close()
	return png.Encode(f, img)
}

// mockUIRunner はテスト用の選択領域 (50x50) を返すモックです。
type mockUIRunner struct{}

func (m *mockUIRunner) CheckAvailability() error {
	return nil
}

func (m *mockUIRunner) RunOverlay(ctx context.Context, snapshotPath string) (*crop.Area, error) {
	return &crop.Area{X: 10, Y: 10, Width: 50, Height: 50}, nil
}

func TestApp_Run(t *testing.T) {
	mockCap := &mockCapturer{}
	mockUI := &mockUIRunner{}
	cropper := crop.NewPNGSubImageCropper()
	mockAI := analyzer.NewMockAnalyzer()

	app := NewApp(mockCap, mockUI, cropper, mockAI, "test prompt")

	ctx := context.Background()
	if err := app.Run(ctx); err != nil {
		t.Fatalf("unexpected error during App.Run: %v", err)
	}

	if mockAI.LastPrompt != "test prompt" {
		t.Errorf("expected prompt 'test prompt', got '%s'", mockAI.LastPrompt)
	}
}
