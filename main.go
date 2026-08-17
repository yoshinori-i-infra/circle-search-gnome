package main

import (
	"context"
	"errors"
	"fmt"
	"os"
	"os/signal"
	"path/filepath"
	"syscall"
	"time"

	"go-deno-ts/pkg/analyzer"
	"go-deno-ts/pkg/capture"
	"go-deno-ts/pkg/crop"
	appErrors "go-deno-ts/pkg/errors"
	"go-deno-ts/pkg/ui"
)

// App はアプリケーションの主要コンポーネントを保持するオーケストレーターです。
// コンポーネントを具体構造体ではなく抽象インターフェースで保持（Dependency Inversion Principle）することで、
// 単体テストや将来のAIプロバイダー拡張（ローカルLLMへの切り替え等）を容易にします。
type App struct {
	capturer capture.Capturer
	uiRunner ui.Runner
	cropper  crop.Cropper
	analyzer analyzer.Analyzer
	prompt   string
}

func NewApp(
	capturer capture.Capturer,
	uiRunner ui.Runner,
	cropper crop.Cropper,
	aiAnalyzer analyzer.Analyzer,
	prompt string,
) *App {
	return &App{
		capturer: capturer,
		uiRunner: uiRunner,
		cropper:  cropper,
		analyzer: aiAnalyzer,
		prompt:   prompt,
	}
}

func (app *App) Run(ctx context.Context) error {
	homeDir, err := os.UserHomeDir()
	if err != nil {
		return fmt.Errorf("failed to get user home dir: %w", err)
	}
	cacheDir := filepath.Join(homeDir, ".cache", "circle-search")
	_ = os.MkdirAll(cacheDir, 0755)

	snapshotPath := filepath.Join(cacheDir, "full_snapshot.png")
	croppedPath := filepath.Join(cacheDir, "cropped.png")

	defer func() {
		_ = os.Remove(snapshotPath)
		_ = os.Remove(croppedPath)
	}()

	// 1. キャプチャ取得
	fmt.Println("📸 キャプチャ取得中...")
	start := time.Now()
	if err := app.capturer.Capture(ctx, snapshotPath); err != nil {
		return err
	}
	fmt.Printf("✅ キャプチャ完了 (%.2f ms)\n", float64(time.Since(start).Microseconds())/1000.0)

	// 2. 囲み選択UI起動
	fmt.Println("🎨 囲み選択中...")
	uiStart := time.Now()
	area, err := app.uiRunner.RunOverlay(ctx, snapshotPath)
	if err != nil {
		if errors.Is(err, appErrors.ErrUserCancelled) {
			fmt.Println("ℹ️ 範囲選択がキャンセルされました。")
			return nil
		}
		return err
	}
	fmt.Printf("✅ 囲み選択完了 (%.2f s)\n", time.Since(uiStart).Seconds())

	// 3. 切り抜き
	if err := app.cropper.Crop(snapshotPath, croppedPath, area); err != nil {
		return err
	}

	// 4. AIによる解析 (Strategyパターンで注入されたプロバイダーを使用)
	fmt.Printf("🤖 AIで解析中... [Provider: %s]\n---\n", app.analyzer.Name())
	aiStart := time.Now()
	if err := app.analyzer.Analyze(ctx, croppedPath, app.prompt); err != nil {
		return err
	}
	fmt.Printf("\n---\n✅ AI解析完了 (%.2f s)\n", time.Since(aiStart).Seconds())
	return nil

}

func main() {
	ctx, cancel := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer cancel()

	// 依存関係の組み立て (Dependency Injection)
	// ★ 将来ローカルLLM (Ollama) や Mock に切り替えたい場合は、
	// 　 analyzer.NewMockAnalyzer() や analyzer.NewOllamaAnalyzer() に差し替えるだけで拡張可能！
	capturer := capture.NewGnomeDBusCapturer()
	uiRunner := ui.NewGJSOverlayRunner("ui/overlay.js")
	cropper := crop.NewPNGSubImageCropper()
	aiAnalyzer := analyzer.NewAgyAnalyzer()

	prompt := "この画像について解析し、重要なポイントやコード、テキストを日本語で詳しく解説してください。"

	app := NewApp(capturer, uiRunner, cropper, aiAnalyzer, prompt)

	if err := app.Run(ctx); err != nil {
		fmt.Printf("❌ %v\n", err)
		os.Exit(1)
	}
}
