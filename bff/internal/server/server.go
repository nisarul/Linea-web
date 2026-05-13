// SPDX-License-Identifier: AGPL-3.0-or-later

// Package server is the Linea-web BFF's HTTP layer.
//
// Phase 2 capabilities:
//   - OIDC Authorization Code + PKCE login at /auth/login.
//   - Server-side session store (Badger) keyed by an HttpOnly
//     SameSite=Strict Secure cookie.
//   - Silent token refresh on every authenticated request whose
//     access token is within the refresh window.
//   - Reverse proxy /api/* -> Linea-server with the session's
//     access token injected as Authorization: Bearer.
//   - Static SPA serving with HTML5 history-mode fallback.
//   - Theme cookie endpoints (carried over from phase 1).
package server

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"time"

	"github.com/nisarul/Linea-web/bff/internal/oidc"
	"github.com/nisarul/Linea-web/bff/internal/proxy"
	"github.com/nisarul/Linea-web/bff/internal/session"
)

// Config configures the BFF.
type Config struct {
	Addr         string
	StaticDir    string
	CookieSecure bool

	// SessionDir is the Badger directory for the session store.
	// Empty means in-memory (dev only — sessions die on restart).
	SessionDir string
	// SessionTTL bounds the maximum lifetime of a session.
	SessionTTL time.Duration

	// UpstreamURL is the Linea-server base URL (e.g. http://lineasrv:8080).
	// When empty, /api/* returns 503.
	UpstreamURL string

	// OIDC config. When IssuerURL is empty, /auth/* returns 503.
	OIDCIssuerURL    string
	OIDCClientID     string
	OIDCClientSecret string
	OIDCRedirectURL  string
	// PostLoginURL is where the SPA lands after a successful login
	// (defaults to "/").
	PostLoginURL string
}

// ConfigFromEnv reads the BFF config from environment variables
// with sensible dev defaults.
func ConfigFromEnv() Config {
	ttl, _ := strconv.Atoi(envOr("LINEA_BFF_SESSION_TTL_SECONDS", "43200")) // 12h
	return Config{
		Addr:         envOr("LINEA_BFF_ADDR", ":8090"),
		StaticDir:    envOr("LINEA_BFF_STATIC_DIR", filepath.Join("..", "frontend", "dist")),
		CookieSecure: envOr("LINEA_BFF_COOKIE_SECURE", "false") == "true",

		SessionDir: envOr("LINEA_BFF_SESSION_DIR", ""),
		SessionTTL: time.Duration(ttl) * time.Second,

		UpstreamURL: envOr("LINEA_BFF_UPSTREAM_URL", ""),

		OIDCIssuerURL:    envOr("LINEA_OIDC_ISSUER", ""),
		OIDCClientID:     envOr("LINEA_OIDC_CLIENT_ID", ""),
		OIDCClientSecret: envOr("LINEA_OIDC_CLIENT_SECRET", ""),
		OIDCRedirectURL:  envOr("LINEA_OIDC_REDIRECT_URL", "http://localhost:8090/auth/callback"),
		PostLoginURL:     envOr("LINEA_BFF_POST_LOGIN_URL", "/"),
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
	cfg      Config
	logger   *slog.Logger
	version  string
	mux      *http.ServeMux
	sessions *session.Store
	oidc     *oidc.Client
	apiProxy http.Handler
}

// New constructs a Server, opening the session store and (when
// configured) the OIDC client and upstream proxy. Callers are
// responsible for calling Close on shutdown.
func New(ctx context.Context, cfg Config, logger *slog.Logger, version string) (*Server, error) {
	store, err := session.Open(cfg.SessionDir, cfg.SessionTTL)
	if err != nil {
		return nil, err
	}
	s := &Server{
		cfg:      cfg,
		logger:   logger,
		version:  version,
		mux:      http.NewServeMux(),
		sessions: store,
	}
	if cfg.OIDCIssuerURL != "" {
		oc, err := oidc.New(ctx, oidc.Config{
			IssuerURL:    cfg.OIDCIssuerURL,
			ClientID:     cfg.OIDCClientID,
			ClientSecret: cfg.OIDCClientSecret,
			RedirectURL:  cfg.OIDCRedirectURL,
		})
		if err != nil {
			_ = store.Close()
			return nil, err
		}
		s.oidc = oc
	}
	if cfg.UpstreamURL != "" {
		p, err := proxy.New(cfg.UpstreamURL, s.tokenForRequest)
		if err != nil {
			_ = store.Close()
			return nil, err
		}
		s.apiProxy = p
	}
	s.routes()
	return s, nil
}

// Close releases resources (session store).
func (s *Server) Close() error {
	if s.sessions != nil {
		return s.sessions.Close()
	}
	return nil
}

// ServeHTTP dispatches via the internal mux.
func (s *Server) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	s.mux.ServeHTTP(w, r)
}

// tokenForRequest implements proxy.TokenSource — pulls the bearer
// token to forward upstream from the caller's session, refreshing
// if near expiry.
//
// We forward the OIDC ID token (not the access token) because:
//   - The upstream (linea-server) verifies tokens against the OIDC
//     issuer's JWKS with audience = the BFF's client id. ID tokens
//     are always signed with that JWKS and have aud = client id.
//   - With Entra ID and only "openid profile email" scopes, the
//     access token is a Microsoft Graph token whose signing key is
//     not in the tenant's discovery JWKS, so signature verification
//     would fail. Switching to an issued-for-your-API access token
//     would require defining a custom App ID URI + scope, which we
//     don't need today.
func (s *Server) tokenForRequest(r *http.Request) (string, bool) {
	sess, err := s.currentSession(r)
	if err != nil {
		return "", false
	}
	// Refresh window: 30s before expiry.
	if s.oidc != nil && sess.RefreshToken != "" &&
		time.Until(sess.AccessExpiry) < 30*time.Second {
		ex, err := s.oidc.Refresh(r.Context(), sess.RefreshToken)
		if err == nil {
			sess.AccessToken = ex.AccessToken
			if ex.RefreshToken != "" {
				sess.RefreshToken = ex.RefreshToken
			}
			if !ex.AccessExpiry.IsZero() {
				sess.AccessExpiry = ex.AccessExpiry
			}
			if ex.IDToken != "" {
				sess.IDToken = ex.IDToken
			}
			_ = s.sessions.Update(r.Context(), sess)
		}
	}
	return sess.IDToken, sess.IDToken != ""
}

// currentSession returns the session bound to the request's
// cookie, or an error.
func (s *Server) currentSession(r *http.Request) (session.Session, error) {
	c, err := r.Cookie(session.CookieName)
	if err != nil {
		return session.Session{}, errors.New("no session cookie")
	}
	return s.sessions.Get(r.Context(), c.Value)
}
