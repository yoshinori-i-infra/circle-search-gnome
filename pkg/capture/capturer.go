package capture

import (
	"context"
	"fmt"

	"github.com/godbus/dbus/v5"

	appErrors "go-deno-ts/pkg/errors"
)

type Capturer interface {
	Capture(ctx context.Context, outputPath string) error
}

type GnomeDBusCapturer struct{}

func NewGnomeDBusCapturer() *GnomeDBusCapturer {
	return &GnomeDBusCapturer{}
}

func (c *GnomeDBusCapturer) Capture(ctx context.Context, outputPath string) error {
	conn, err := dbus.ConnectSessionBus()
	if err != nil {
		return fmt.Errorf("%w: failed to connect to DBus session bus: %v", appErrors.ErrCaptureFailed, err)
	}
	defer conn.Close()

	obj := conn.Object("org.gnome.Shell", "/org/gnome/Shell/Extensions/CircleSearch")
	var success bool

	call := obj.CallWithContext(ctx, "org.gnome.Shell.Extensions.CircleSearch.Capture", 0, outputPath)
	if call.Err != nil {
		return fmt.Errorf("%w: DBus call failed: %v", appErrors.ErrCaptureFailed, call.Err)
	}

	if err := call.Store(&success); err != nil {
		return fmt.Errorf("%w: DBus response parse failed: %v", appErrors.ErrCaptureFailed, err)
	}

	if !success {
		return fmt.Errorf("%w: GNOME Shell Extension returned capture success=false", appErrors.ErrCaptureFailed)
	}

	return nil
}
