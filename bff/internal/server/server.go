// SPDX-License-Identifier: AGPL-3.0-or-later

// Package server is the Linea-web BFF's HTTP layer.
//
// Phase 2 capabilities:
//   - OIDC Authorization Code + PKCE login at /auth/login/{provider}.
//   - Multi-provider support: each provider is independently configured
//     (issuer URL, client id/secret) and gets its own callback path
//     /auth/callback/{provider}. The browser picks a provider via the
//     /auth/providers endpoint.
//   - Server-side session store (Badger) keyed by an HttpOnly
//     SameSite=Strict Secure cookie.
//   - Silent token refresh on every authenticated request whose
//     access token is within the refresh window (using the session's
//     bound provider).
//   - Reverse proxy /api/* -> Linea-server with the session's
//     ID token injected as Authorization: Bearer.
//   - Static SPA serving with HTML5 history-mode fallback.
//   - Theme cookie endpoints (carried over from phase 1).
package server

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/nisarul/Linea-web/bff/internal/oidc"
	"github.com/nisarul/Linea-web/bff/internal/proxy"
	"github.com/nisarul/Linea-web/bff/internal/session"
)

// ProviderConfig describes one OIDC identity provider.
type ProviderConfig struct {
	// Name is the URL-safe slug used in /auth/login/{name} and stored
	// on the session (e.g. "microsoft", "google").
	Name string
	// DisplayName is shown in the UI (e.g. "Microsoft", "Google").
	DisplayName string
	// IssuerURL is the OIDC discovery base URL.
	IssuerURL string
	// ClientID / ClientSecret are the OAuth client credentials at the issuer.
	ClientID     string
	ClientSecret string
	// RedirectURL is the absolute callback URL registered at the issuer
	// (typically <RedirectBase>/<Name>).
	RedirectURL string
}

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

	// Providers is the resolved list of configured OIDC providers.
	// When empty, /auth/* returns 503.
	Providers []ProviderConfig

	// PostLoginURL is where the SPA lands after a successful login
	// (defaults to "/").
	PostLoginURL string
}

// ConfigFromEnv reads the BFF config from environment variables
// with sensible dev defaults.
//
// Multi-provider configuration:
//
//	LINEA_OIDC_PROVIDERS=microsoft,google
//	LINEA_OIDC_REDIRECT_BASE=https://web.example/auth/callback
//	# Per-provider (NAME upper-cased):
//	LINEA_OIDC_MICROSOFT_ISSUER=https://login.microsoftonline.com/<tenant>/v2.0
//	LINEA_OIDC_MICROSOFT_CLIENT_ID=...
//	LINEA_OIDC_MICROSOFT_CLIENT_SECRET=...
//	LINEA_OIDC_MICROSOFT_DISPLAY_NAME=Microsoft   # optional
//	LINEA_OIDC_GOOGLE_ISSUER=https://accounts.google.com
//	LINEA_OIDC_GOOGLE_CLIENT_ID=...
//	LINEA_OIDC_GOOGLE_CLIENT_SECRET=...
//
// Backward-compatible single-provider (existing deployments):
//
//	LINEA_OIDC_ISSUER=...        # mapped to provider name "default"
//	LINEA_OIDC_CLIENT_ID=...
//	LINEA_OIDC_CLIENT_SECRET=...
//	LINEA_OIDC_REDIRECT_URL=...
func ConfigFromEnv() Config {
	ttl, _ := strconv.Atoi(envOr("LINEA_BFF_SESSION_TTL_SECONDS", "43200")) // 12h
	return Config{
		Addr:         envOr("LINEA_BFF_ADDR", ":8090"),
		StaticDir:    envOr("LINEA_BFF_STATIC_DIR", filepath.Join("..", "frontend", "dist")),
		CookieSecure: envOr("LINEA_BFF_COOKIE_SECURE", "false") == "true",

		SessionDir: envOr("LINEA_BFF_SESSION_DIR", ""),
		SessionTTL: time.Duration(ttl) * time.Second,

		UpstreamURL: envOr("LINEA_BFF_UPSTREAM_URL", ""),

		Providers:    providersFromEnv(),
		PostLoginURL: envOr("LINEA_BFF_POST_LOGIN_URL", "/"),
	}
}

func providersFromEnv() []ProviderConfig {
	list := envOr("LINEA_OIDC_PROVIDERS", "")
	redirectBase := strings.TrimRight(envOr("LINEA_OIDC_REDIRECT_BASE", ""), "/")

	if list == "" {
		// Backward-compat: single provider via legacy env vars.
		issuer := envOr("LINEA_OIDC_ISSUER", "")
		if issuer == "" {
			return nil
		}
		redir := envOr("LINEA_OIDC_REDIRECT_URL", "http://localhost:8090/auth/callback")
		return []ProviderConfig{{
			Name:         "default",
			DisplayName:  envOr("LINEA_OIDC_DISPLAY_NAME", "Sign in"),
			IssuerURL:    issuer,
			ClientID:     envOr("LINEA_OIDC_CLIENT_ID", ""),
			ClientSecret: envOr("LINEA_OIDC_CLIENT_SECRET", ""),
			RedirectURL:  redir,
		}}
	}

	out := []ProviderConfig{}
	for _, raw := range strings.Split(list, ",") {
		name := strings.ToLower(strings.TrimSpace(raw))
		if name == "" {
			continue
		}
		up := strings.ToUpper(name)
		issuer := envOr("LINEA_OIDC_"+up+"_ISSUER", "")
		if issuer == "" {
			continue
		}
		redir := envOr("LINEA_OIDC_"+up+"_REDIRECT_URL", "")
		if redir == "" && redirectBase != "" {
			redir = redirectBase + "/" + name
		}
		display := envOr("LINEA_OIDC_"+up+"_DISPLAY_NAME", strings.Title(name)) //nolint:staticcheck
		out = append(out, ProviderConfig{
			Name:         name,
			DisplayName:  display,
			IssuerURL:    issuer,
			ClientID:     envOr("LINEA_OIDC_"+up+"_CLIENT_ID", ""),
			ClientSecret: envOr("LINEA_OIDC_"+up+"_CLIENT_SECRET", ""),
			RedirectURL:  redir,
		})
	}
	sort.SliceStable(out, func(i, j int) bool { return out[i].Name < out[j].Name })
	return out
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
	// oidc maps provider name -> client. Empty when auth is disabled.
	oidc     map[string]*oidc.Client
	apiProxy http.Handler
}

// New constructs a Server, opening the session store and (when
// configured) the OIDC clients per provider and the upstream proxy.
// Callers are responsible for calling Close on shutdown.
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
		oidc:     map[string]*oidc.Client{},
	}
	for _, p := range cfg.Providers {
		oc, err := oidc.New(ctx, oidc.Config{
			IssuerURL:    p.IssuerURL,
			ClientID:     p.ClientID,
			ClientSecret: p.ClientSecret,
			RedirectURL:  p.RedirectURL,
		})
		if err != nil {
			_ = store.Close()
			return nil, fmt.Errorf("oidc provider %q: %w", p.Name, err)
		}
		s.oidc[p.Name] = oc
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

// providerByName returns the OIDC client and ProviderConfig, or false.
func (s *Server) providerByName(name string) (*oidc.Client, ProviderConfig, bool) {
	c, ok := s.oidc[name]
	if !ok {
		return nil, ProviderConfig{}, false
	}
	for _, p := range s.cfg.Providers {
		if p.Name == name {
			return c, p, true
		}
	}
	return c, ProviderConfig{}, true
}

// tokenForRequest implements proxy.TokenSource — pulls the bearer
// token to forward upstream from the caller's session, refreshing
// using the session's bound provider when near expiry.
//
// We forward the OIDC ID token (not the access token) because:
//   - The upstream (linea-server) verifies tokens against the OIDC
//     issuer's JWKS with audience = the BFF's client id. ID tokens
//     are always signed with that JWKS and have aud = client id.
//   - With Entra ID and only "openid profile email" scopes, the
//     access token is a Microsoft Graph token whose signing key is
//     not in the tenant's discovery JWKS, so signature verification
//     would fail.
func (s *Server) tokenForRequest(r *http.Request) (string, bool) {
	sess, err := s.currentSession(r)
	if err != nil {
		return "", false
	}
	// Refresh window: 30s before expiry.
	if sess.RefreshToken != "" && time.Until(sess.AccessExpiry) < 30*time.Second {
		if oc, ok := s.oidc[sess.Provider]; ok {
			ex, err := oc.Refresh(r.Context(), sess.RefreshToken)
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
