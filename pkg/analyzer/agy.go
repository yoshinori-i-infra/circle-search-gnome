package analyzer

import (
	"context"
	"fmt"
	"os"
	"os/exec"

	appErrors "go-deno-ts/pkg/errors"
)

type AgyAnalyzer struct{}

func NewAgyAnalyzer() *AgyAnalyzer {
	return &AgyAnalyzer{}
}
func (a *AgyAnalyzer) Name() string {
	return "agy"
}

func (a *AgyAnalyzer) CheckAvailability() error {
	if _, err := exec.LookPath("agy"); err != nil {
		return fmt.Errorf("%w: 'agy' command not found in PATH", appErrors.ErrDependencyMissing)
	}
	return nil
}

func (a *AgyAnalyzer) Analyze(ctx context.Context, imagePath string, prompt string) error {
	if err := a.CheckAvailability(); err != nil {
		return err
	}

	cmd := exec.CommandContext(ctx, "agy", "--dangerously-skip-permissions", "-p", prompt, "-c", imagePath)
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	cmd.Stdin = os.Stdin

	if err := cmd.Run(); err != nil {
		return fmt.Errorf("%w: agy process failed: %v", appErrors.ErrAnalysisFailed, err)
	}
	return nil
}
