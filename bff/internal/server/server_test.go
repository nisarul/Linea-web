// SPDX-License-Identifier: AGPL-3.0-or-later

package server_test

import (
	"context"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"

	bff "github.com/nisarul/Linea-web/bff/internal/server"
)

func newTestServer(t *testing.T) http.Handler {
	t.Helper()
	logger := slog.New(slog.NewTextHandler(os.Stderr, &slog.HandlerOptions{Level: slog.LevelWarn}))
	srv, err := bff.New(context.Background(), bff.Config{Addr: ":0"}, logger, "test")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = srv.Close() })
	return srv
}

func TestHealth(t *testing.T) {
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/healthz", nil)
	newTestServer(t).ServeHTTP(rr, req)
	if rr.Code != http.StatusOK || rr.Body.String() != "ok" {
		t.Fatalf("healthz: got %d %q", rr.Code, rr.Body.String())
	}
}

func TestSetThemeRoundTrip(t *testing.T) {
	srv := newTestServer(t)

	rr := httptest.NewRecorder()
	srv.ServeHTTP(rr, httptest.NewRequest(http.MethodPost, "/auth/theme?pref=dark", nil))
	if rr.Code != http.StatusNoContent {
		t.Fatalf("set theme: got %d", rr.Code)
	}
	if !strings.Contains(rr.Header().Get("Set-Cookie"), "linea_theme=dark") {
		t.Fatalf("cookie not set: %q", rr.Header().Get("Set-Cookie"))
	}

	rr = httptest.NewRecorder()
	srv.ServeHTTP(rr, httptest.NewRequest(http.MethodPost, "/auth/theme?pref=invalid", nil))
	if rr.Code != http.StatusBadRequest {
		t.Fatalf("invalid theme: got %d", rr.Code)
	}
}

func TestUnconfiguredAuthAndProxy(t *testing.T) {
	srv := newTestServer(t)

	// /auth/login when OIDC unset -> 503.
	rr := httptest.NewRecorder()
	srv.ServeHTTP(rr, httptest.NewRequest(http.MethodGet, "/auth/login", nil))
	if rr.Code != http.StatusServiceUnavailable {
		t.Fatalf("login: expected 503, got %d", rr.Code)
	}

	// /api/* without an upstream -> 503.
	rr = httptest.NewRecorder()
	srv.ServeHTTP(rr, httptest.NewRequest(http.MethodGet, "/api/v1/genealogies", nil))
	if rr.Code != http.StatusServiceUnavailable {
		t.Fatalf("api: expected 503, got %d", rr.Code)
	}
}

func TestMeUnauthenticated(t *testing.T) {
	rr := httptest.NewRecorder()
	newTestServer(t).ServeHTTP(rr, httptest.NewRequest(http.MethodGet, "/auth/me", nil))
	if rr.Code != http.StatusOK {
		t.Fatalf("me: got %d", rr.Code)
	}
	if !strings.Contains(rr.Body.String(), `"authenticated":false`) {
		t.Fatalf("body=%s", rr.Body.String())
	}
}

func TestLogoutClearsCookie(t *testing.T) {
	rr := httptest.NewRecorder()
	newTestServer(t).ServeHTTP(rr, httptest.NewRequest(http.MethodPost, "/auth/logout", nil))
	if rr.Code != http.StatusNoContent {
		t.Fatalf("logout: got %d", rr.Code)
	}
	if !strings.Contains(rr.Header().Get("Set-Cookie"), "linea_sid=;") {
		t.Fatalf("expected cleared sid cookie, got %q", rr.Header().Get("Set-Cookie"))
	}
}
