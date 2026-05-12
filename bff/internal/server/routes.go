// SPDX-License-Identifier: AGPL-3.0-or-later

package server

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
)

// routes installs the BFF's HTTP handlers.
//
// /healthz, /readyz       — liveness / readiness.
// /auth/theme             — POST/GET theme preference cookie.
// /api/...                — reserved for the Linea-server proxy (phase 2).
// /auth/login, /callback  — reserved for OIDC (phase 2).
// (everything else)       — static SPA assets when StaticDir is configured.
func (s *Server) routes() {
	s.mux.HandleFunc("GET /healthz", s.handleHealth)
	s.mux.HandleFunc("GET /readyz", s.handleReady)
	s.mux.HandleFunc("GET /version", s.handleVersion)

	s.mux.HandleFunc("POST /auth/theme", s.handleSetTheme)
	s.mux.HandleFunc("GET /auth/theme", s.handleGetTheme)

	// Phase 2 stubs — return 501 so callers fail loudly until
	// the real implementations land.
	s.mux.HandleFunc("/api/", notImplemented("api proxy"))
	s.mux.HandleFunc("/auth/login", notImplemented("oidc login"))
	s.mux.HandleFunc("/auth/callback", notImplemented("oidc callback"))
	s.mux.HandleFunc("/auth/logout", notImplemented("oidc logout"))

	if s.cfg.StaticDir != "" {
		// Catch-all: serve built SPA assets. This must come last
		// because GO 1.22+ servemux gives the most-specific match
		// priority, but the bare "/" route is the fallback.
		s.mux.Handle("/", s.spaHandler())
	}
}

func (s *Server) handleHealth(w http.ResponseWriter, _ *http.Request) {
	_, _ = w.Write([]byte("ok"))
}

func (s *Server) handleReady(w http.ResponseWriter, _ *http.Request) {
	_, _ = w.Write([]byte("ready"))
}

func (s *Server) handleVersion(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]string{
		"server": "lineabff",
		"version": s.version,
	})
}

// handleSetTheme persists the user's theme preference in a long-
// lived cookie. The SPA writes the same cookie client-side; this
// endpoint exists so a future SSR pass can also update it without
// JavaScript.
func (s *Server) handleSetTheme(w http.ResponseWriter, r *http.Request) {
	v := r.URL.Query().Get("pref")
	switch v {
	case "light", "dark", "system":
	default:
		http.Error(w, "pref must be one of: light, dark, system", http.StatusBadRequest)
		return
	}
	http.SetCookie(w, &http.Cookie{
		Name:     "linea_theme",
		Value:    v,
		Path:     "/",
		MaxAge:   60 * 60 * 24 * 400,
		HttpOnly: false, // SPA needs to read it
		Secure:   s.cfg.CookieSecure,
		SameSite: http.SameSiteLaxMode,
	})
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) handleGetTheme(w http.ResponseWriter, r *http.Request) {
	c, err := r.Cookie("linea_theme")
	if err != nil {
		_, _ = w.Write([]byte(`{"pref":"system"}`))
		return
	}
	w.Header().Set("Content-Type", "application/json")
	_, _ = fmt.Fprintf(w, `{"pref":%q}`, c.Value)
}

func notImplemented(label string) http.HandlerFunc {
	return func(w http.ResponseWriter, _ *http.Request) {
		http.Error(w, label+" not implemented in phase 1", http.StatusNotImplemented)
	}
}

// spaHandler serves StaticDir, falling back to index.html for any
// path that does not match a real file (so client-side routing
// works on direct loads / refreshes).
func (s *Server) spaHandler() http.Handler {
	fs := http.FileServer(http.Dir(s.cfg.StaticDir))
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		full := s.cfg.StaticDir + r.URL.Path
		if info, err := os.Stat(full); err == nil && !info.IsDir() {
			fs.ServeHTTP(w, r)
			return
		}
		// SPA fallback.
		http.ServeFile(w, r, s.cfg.StaticDir+"/index.html")
	})
}
