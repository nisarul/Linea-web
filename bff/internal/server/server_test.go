// SPDX-License-Identifier: AGPL-3.0-or-later

package server_test

import (
	"log/slog"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"

	bff "github.com/nisarul/Linea-web/bff/internal/server"
)

func newTestServer() http.Handler {
	logger := slog.New(slog.NewTextHandler(os.Stderr, &slog.HandlerOptions{Level: slog.LevelWarn}))
	return bff.New(bff.Config{Addr: ":0", StaticDir: ""}, logger, "test")
}

func TestHealth(t *testing.T) {
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/healthz", nil)
	newTestServer().ServeHTTP(rr, req)
	if rr.Code != http.StatusOK || rr.Body.String() != "ok" {
		t.Fatalf("healthz: got %d %q", rr.Code, rr.Body.String())
	}
}

func TestSetThemeRoundTrip(t *testing.T) {
	srv := newTestServer()

	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/auth/theme?pref=dark", nil)
	srv.ServeHTTP(rr, req)
	if rr.Code != http.StatusNoContent {
		t.Fatalf("set theme: got %d", rr.Code)
	}
	cookie := rr.Header().Get("Set-Cookie")
	if !strings.Contains(cookie, "linea_theme=dark") {
		t.Fatalf("cookie not set: %q", cookie)
	}

	rr = httptest.NewRecorder()
	req = httptest.NewRequest(http.MethodPost, "/auth/theme?pref=invalid", nil)
	srv.ServeHTTP(rr, req)
	if rr.Code != http.StatusBadRequest {
		t.Fatalf("invalid theme: got %d", rr.Code)
	}
}

func TestPhase2StubsReturn501(t *testing.T) {
	srv := newTestServer()
	for _, p := range []string{"/api/foo", "/auth/login", "/auth/callback", "/auth/logout"} {
		rr := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodGet, p, nil)
		srv.ServeHTTP(rr, req)
		if rr.Code != http.StatusNotImplemented {
			t.Fatalf("%s: expected 501, got %d", p, rr.Code)
		}
	}
}
