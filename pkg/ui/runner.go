package ui

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"

	"go-deno-ts/pkg/crop"
	appErrors "go-deno-ts/pkg/errors"
)

type Runner interface {
	RunOverlay(ctx context.Context, snapshotPath string) (*crop.Area, error)
	CheckAvailability() error
}

type GJSOverlayRunner struct {
	ScriptPath string
}

func NewGJSOverlayRunner(scriptPath string) *GJSOverlayRunner {
	return &GJSOverlayRunner{
		ScriptPath: scriptPath,
	}
}

func (r *GJSOverlayRunner) CheckAvailability() error {
	if _, err := exec.LookPath("gjs"); err != nil {
		return fmt.Errorf("%w: 'gjs' command not found in PATH", appErrors.ErrDependencyMissing)
	}
	return nil
}

func (r *GJSOverlayRunner) RunOverlay(ctx context.Context, snapshotPath string) (*crop.Area, error) {
	if err := r.CheckAvailability(); err != nil {
		return nil, err
	}

	cmd := exec.CommandContext(ctx, "gjs", r.ScriptPath, snapshotPath)

	var outBytes bytes.Buffer
	cmd.Stdout = &outBytes
	cmd.Stderr = os.Stderr

	if err := cmd.Run(); err != nil {
		// ESCキー等でキャンセルされた場合はセンチネルエラー ErrUserCancelled を返す
		return nil, appErrors.ErrUserCancelled
	}

	var area crop.Area
	if err := json.Unmarshal(outBytes.Bytes(), &area); err != nil {
		return nil, fmt.Errorf("%w: invalid JSON coordinates from overlay: %v", appErrors.ErrCropFailed, err)
	}

	return &area, nil
}
