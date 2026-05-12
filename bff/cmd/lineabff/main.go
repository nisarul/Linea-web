// SPDX-License-Identifier: AGPL-3.0-or-later

// Command lineabff is the Linea Backend-For-Frontend.
//
// Phase 1 (current): minimal scaffold — serves the built SPA from
// disk, exposes /healthz, sets the linea_theme cookie based on
// query param so the SPA can persist theme choice. OIDC + token
// proxy land in phase 2.
package main

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"

	"github.com/nisarul/Linea-web/bff/internal/server"
)

// version is overridden at build time via -ldflags.
var version = "0.0.1-phase1"

func main() {
	if err := run(); err != nil {
		fmt.Fprintln(os.Stderr, "fatal:", err)
		os.Exit(1)
	}
}

func run() error {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level: slog.LevelInfo,
	}))

	cfg := server.ConfigFromEnv()
	srv := server.New(cfg, logger, version)

	httpSrv := &http.Server{
		Addr:    cfg.Addr,
		Handler: srv,
	}

	logger.Info("starting lineabff",
		slog.String("version", version),
		slog.String("addr", cfg.Addr),
		slog.String("static_dir", cfg.StaticDir),
	)

	ctx, cancel := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer cancel()

	go func() {
		<-ctx.Done()
		_ = httpSrv.Shutdown(context.Background())
	}()

	if err := httpSrv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		return err
	}
	return nil
}
