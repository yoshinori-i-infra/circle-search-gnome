package errors

import "errors"

var (
	// ErrUserCancelled はユーザーが範囲選択をキャンセルした場合のエラーです
	ErrUserCancelled = errors.New("range selection was cancelled by user")

	// ErrDependencyMissing は gjs や agy などの依存コマンドが存在しない場合のエラーです
	ErrDependencyMissing = errors.New("required system dependency is missing")

	// ErrCaptureFailed は画面キャプチャの取得に失敗した場合のエラーです
	ErrCaptureFailed = errors.New("failed to capture screen snapshot")

	// ErrCropFailed は画像の切り抜き処理に失敗した場合のエラーです
	ErrCropFailed = errors.New("failed to crop snapshot image")

	// ErrAnalysisFailed はAI解析処理に失敗した場合のエラーです
	ErrAnalysisFailed = errors.New("failed to analyze cropped image")
)
