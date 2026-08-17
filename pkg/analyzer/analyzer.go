package analyzer

import "context"

// Analyzer は、切り取られた画像を解析するAIプロバイダーの共通インターフェースです。
// 将来的に Ollama や OpenAI を追加する際も、このインターフェースを満たす構造体を
// 実装するだけで拡張が可能になります (Open/Closed Principle)。
type Analyzer interface {
	Analyze(ctx context.Context, imagePath string, prompt string) error
	Name() string
	CheckAvailability() error
}
