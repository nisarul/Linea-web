// SPDX-License-Identifier: AGPL-3.0-or-later

// Package server is the Linea-web BFF's HTTP layer.
//
// Phase 1 capabilities:
//   - Serves the static built SPA from disk.
//   - Exposes /healthz and /readyz.
//   - Lightweight theme-cookie endpoint at /auth/theme so the
//     SPA can persist Light/Dark/System without going through
//     full OIDC plumbing yet.
//
// Phase 2 will add OIDC redirect, session cookies, and the
// Linea-server reverse proxy. The package layout already reserves
// internal/oidc, internal/session, internal/proxy for that work
// (created in phase 2; not present yet to keep phase 1 small).
package server

import (
	"log/slog"
	"net/http"
	"os"
	"path/filepath"
)

// Config configures the BFF.
type Config struct {
	// Addr is the HTTP listen address (e.g. ":8090").
	Addr string
	// StaticDir is the directory containing the built SPA assets
	// (frontend/dist). When empty in dev, the BFF only exposes its
	// own routes and lets Vite serve the SPA via its own dev server.
	StaticDir string
	// CookieSecure controls the Secure attribute on the theme
	// cookie. Production deployments behind HTTPS MUST set this
	// to true.
	CookieSecure bool
}

// ConfigFromEnv reads the BFF config from environment variables
// with sensible dev defaults.
func ConfigFromEnv() Config {
	return Config{
		Addr:         envOr("LINEA_BFF_ADDR", ":8090"),
		StaticDir:    envOr("LINEA_BFF_STATIC_DIR", filepath.Join("..", "frontend", "dist")),
		CookieSecure: envOr("LINEA_BFF_COOKIE_SECURE", "false") == "true",
	}
}

func envOr(k, def string) string {
	if v, ok := os.LookupEnv(k); ok && v != "" {
		return v
	}
	return def
}

// Server is the BFF's root http.Handler.
type Server struct {
	cfg     Config
	logger  *slog.Logger
	version string
	mux     *http.ServeMux
}

// New constructs a Server.
func New(cfg Config, logger *slog.Logger, version string) *Server {
	s := &Server{
		cfg:     cfg,
		logger:  logger,
		version: version,
		mux:     http.NewServeMux(),
	}
	s.routes()
	return s
}

// ServeHTTP dispatches via the internal mux.
func (s *Server) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	s.mux.ServeHTTP(w, r)
}
