package analyzer

import (
	"context"
	"fmt"
)

// MockAnalyzer は単体テストおよび開発・検証用のモックアナライザーです。
type MockAnalyzer struct {
	LastImagePath string
	LastPrompt    string
	ShouldFail    bool
}

func NewMockAnalyzer() *MockAnalyzer {
	return &MockAnalyzer{}
}

func (m *MockAnalyzer) Name() string {
	return "mock"
}

func (m *MockAnalyzer) CheckAvailability() error {
	return nil
}

func (m *MockAnalyzer) Analyze(ctx context.Context, imagePath string, prompt string) error {
	m.LastImagePath = imagePath
	m.LastPrompt = prompt
	if m.ShouldFail {
		return fmt.Errorf("mock analysis failure")
	}
	return nil
}
