// SPDX-License-Identifier: AGPL-3.0-or-later

package server

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/nisarul/Linea-web/bff/internal/oidc"
	"github.com/nisarul/Linea-web/bff/internal/session"
)

// pkceCookie carries the PKCE state across the OIDC redirect
// round-trip. Short-lived (5 minutes), HttpOnly, SameSite=Lax
// (Strict would drop the inbound cross-site redirect from the
// IdP).
const pkceCookie = "linea_pkce"

func (s *Server) routes() {
	s.mux.HandleFunc("GET /healthz", s.handleHealth)
	s.mux.HandleFunc("GET /readyz", s.handleReady)
	s.mux.HandleFunc("GET /version", s.handleVersion)

	s.mux.HandleFunc("POST /auth/theme", s.handleSetTheme)
	s.mux.HandleFunc("GET /auth/theme", s.handleGetTheme)

	s.mux.HandleFunc("GET /auth/providers", s.handleProviders)
	// Multi-provider routes.
	s.mux.HandleFunc("GET /auth/login/{provider}", s.handleLogin)
	s.mux.HandleFunc("GET /auth/callback/{provider}", s.handleCallback)
	// Legacy single-provider routes (back-compat). They redirect to
	// the only configured provider when there's exactly one.
	s.mux.HandleFunc("GET /auth/login", s.handleLegacyLogin)
	s.mux.HandleFunc("GET /auth/callback", s.handleLegacyCallback)
	s.mux.HandleFunc("POST /auth/logout", s.handleLogout)
	s.mux.HandleFunc("GET /auth/me", s.handleMe)

	s.mux.HandleFunc("/api/", s.handleAPI)

	if s.cfg.StaticDir != "" {
		s.mux.Handle("/", s.spaHandler())
	}
}

// --- liveness / build info ---

func (s *Server) handleHealth(w http.ResponseWriter, _ *http.Request) {
	_, _ = w.Write([]byte("ok"))
}

func (s *Server) handleReady(w http.ResponseWriter, _ *http.Request) {
	_, _ = w.Write([]byte("ready"))
}

func (s *Server) handleVersion(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{
		"server":  "lineabff",
		"version": s.version,
	})
}

// --- theme cookie ---

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
		HttpOnly: false,
		Secure:   s.cfg.CookieSecure,
		SameSite: http.SameSiteLaxMode,
	})
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) handleGetTheme(w http.ResponseWriter, r *http.Request) {
	c, err := r.Cookie("linea_theme")
	if err != nil {
		writeJSON(w, http.StatusOK, map[string]string{"pref": "system"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"pref": c.Value})
}

// --- OIDC ---

// handleProviders lists the configured providers so the SPA can
// render a per-provider sign-in button.
func (s *Server) handleProviders(w http.ResponseWriter, _ *http.Request) {
	type provDTO struct {
		Name        string `json:"name"`
		DisplayName string `json:"displayName"`
		LoginURL    string `json:"loginUrl"`
	}
	out := make([]provDTO, 0, len(s.cfg.Providers))
	for _, p := range s.cfg.Providers {
		out = append(out, provDTO{
			Name:        p.Name,
			DisplayName: p.DisplayName,
			LoginURL:    "/auth/login/" + p.Name,
		})
	}
	writeJSON(w, http.StatusOK, out)
}

// handleLogin starts the auth-code + PKCE flow for {provider}.
func (s *Server) handleLogin(w http.ResponseWriter, r *http.Request) {
	name := r.PathValue("provider")
	oc, _, ok := s.providerByName(name)
	if !ok {
		http.Error(w, "unknown provider", http.StatusNotFound)
		return
	}
	p, err := oidc.NewPKCE()
	if err != nil {
		http.Error(w, "pkce init failed", http.StatusInternalServerError)
		return
	}
	val, err := encodePKCE(p)
	if err != nil {
		http.Error(w, "pkce encode failed", http.StatusInternalServerError)
		return
	}
	http.SetCookie(w, &http.Cookie{
		Name:     pkceCookie,
		Value:    val,
		Path:     "/auth/callback/" + name,
		MaxAge:   300,
		HttpOnly: true,
		Secure:   s.cfg.CookieSecure,
		SameSite: http.SameSiteLaxMode,
	})
	http.Redirect(w, r, oc.AuthCodeURL(p), http.StatusFound)
}

// handleLegacyLogin keeps the old /auth/login working when there's
// exactly one provider configured (back-compat for older clients).
func (s *Server) handleLegacyLogin(w http.ResponseWriter, r *http.Request) {
	if len(s.cfg.Providers) == 0 {
		http.Error(w, "auth not configured", http.StatusServiceUnavailable)
		return
	}
	if len(s.cfg.Providers) > 1 {
		// Force the SPA to choose explicitly.
		http.Redirect(w, r, "/login", http.StatusFound)
		return
	}
	r.SetPathValue("provider", s.cfg.Providers[0].Name)
	s.handleLogin(w, r)
}

// handleCallback finishes the auth-code + PKCE flow for {provider}.
func (s *Server) handleCallback(w http.ResponseWriter, r *http.Request) {
	name := r.PathValue("provider")
	oc, _, ok := s.providerByName(name)
	if !ok {
		http.Error(w, "unknown provider", http.StatusNotFound)
		return
	}
	c, err := r.Cookie(pkceCookie)
	if err != nil {
		http.Error(w, "missing pkce cookie", http.StatusBadRequest)
		return
	}
	// Clear the PKCE cookie regardless of outcome.
	http.SetCookie(w, &http.Cookie{
		Name: pkceCookie, Value: "", Path: "/auth/callback/" + name,
		MaxAge: -1, HttpOnly: true, Secure: s.cfg.CookieSecure,
		SameSite: http.SameSiteLaxMode,
	})
	p, err := decodePKCE(c.Value)
	if err != nil {
		http.Error(w, "bad pkce cookie", http.StatusBadRequest)
		return
	}
	if state := r.URL.Query().Get("state"); state != p.State {
		http.Error(w, "state mismatch", http.StatusBadRequest)
		return
	}
	code := r.URL.Query().Get("code")
	if code == "" {
		if errParam := r.URL.Query().Get("error"); errParam != "" {
			http.Error(w, "idp error: "+errParam, http.StatusBadGateway)
			return
		}
		http.Error(w, "missing code", http.StatusBadRequest)
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
	defer cancel()
	ex, err := oc.Exchange(ctx, code, p)
	if err != nil {
		s.logger.Warn("oidc exchange failed", "provider", name, "err", err)
		http.Error(w, "exchange failed", http.StatusBadGateway)
		return
	}
	id, err := s.sessions.New(r.Context(), session.Session{
		Provider:     name,
		Subject:      ex.Identity.Subject,
		Email:        ex.Identity.Email,
		Name:         ex.Identity.Name,
		AccessToken:  ex.AccessToken,
		RefreshToken: ex.RefreshToken,
		IDToken:      ex.IDToken,
		AccessExpiry: ex.AccessExpiry,
	})
	if err != nil {
		http.Error(w, "session create failed", http.StatusInternalServerError)
		return
	}
	http.SetCookie(w, &http.Cookie{
		Name:     session.CookieName,
		Value:    id,
		Path:     "/",
		MaxAge:   int(s.cfg.SessionTTL.Seconds()),
		HttpOnly: true,
		Secure:   s.cfg.CookieSecure,
		SameSite: http.SameSiteStrictMode,
	})
	dest := s.cfg.PostLoginURL
	if dest == "" {
		dest = "/"
	}
	http.Redirect(w, r, dest, http.StatusFound)
}

// handleLegacyCallback routes the old /auth/callback path when there
// is exactly one provider configured.
func (s *Server) handleLegacyCallback(w http.ResponseWriter, r *http.Request) {
	if len(s.cfg.Providers) != 1 {
		http.Error(w, "use /auth/callback/{provider}", http.StatusBadRequest)
		return
	}
	r.SetPathValue("provider", s.cfg.Providers[0].Name)
	s.handleCallback(w, r)
}

func (s *Server) handleLogout(w http.ResponseWriter, r *http.Request) {
	c, err := r.Cookie(session.CookieName)
	if err == nil {
		_ = s.sessions.Delete(r.Context(), c.Value)
	}
	http.SetCookie(w, &http.Cookie{
		Name: session.CookieName, Value: "", Path: "/",
		MaxAge: -1, HttpOnly: true, Secure: s.cfg.CookieSecure,
		SameSite: http.SameSiteStrictMode,
	})
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) handleMe(w http.ResponseWriter, r *http.Request) {
	sess, err := s.currentSession(r)
	if err != nil {
		writeJSON(w, http.StatusOK, map[string]any{"authenticated": false})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"authenticated": true,
		"provider":      sess.Provider,
		"subject":       sess.Subject,
		"email":         sess.Email,
		"name":          sess.Name,
	})
}

// --- API proxy ---

// handleAPI forwards /api/* to Linea-server. Unauthenticated
// requests are forwarded WITHOUT a bearer; the server enforces
// per-genealogy visibility (Public reads succeed, Private/Unlisted
// reads return 404, mutating endpoints return 401/403).
func (s *Server) handleAPI(w http.ResponseWriter, r *http.Request) {
	if s.apiProxy == nil {
		http.Error(w, "upstream not configured", http.StatusServiceUnavailable)
		return
	}
	s.apiProxy.ServeHTTP(w, r)
}

// --- SPA ---

func (s *Server) spaHandler() http.Handler {
	fs := http.FileServer(http.Dir(s.cfg.StaticDir))
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		full := s.cfg.StaticDir + r.URL.Path
		if info, err := os.Stat(full); err == nil && !info.IsDir() {
			fs.ServeHTTP(w, r)
			return
		}
		http.ServeFile(w, r, s.cfg.StaticDir+"/index.html")
	})
}

// --- helpers ---

func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(body)
}

// encodePKCE/decodePKCE serialise oidc.PKCE into a cookie value.
// Format: state|nonce|verifier (none of these contain '|' since
// they're base64-url).
func encodePKCE(p oidc.PKCE) (string, error) {
	if strings.ContainsAny(p.State+p.Nonce+p.CodeVerifier, "|") {
		return "", errors.New("pkce: unexpected delimiter in tokens")
	}
	return fmt.Sprintf("%s|%s|%s", p.State, p.Nonce, p.CodeVerifier), nil
}

func decodePKCE(v string) (oidc.PKCE, error) {
	parts := strings.SplitN(v, "|", 3)
	if len(parts) != 3 {
		return oidc.PKCE{}, errors.New("pkce: bad cookie format")
	}
	return oidc.PKCE{State: parts[0], Nonce: parts[1], CodeVerifier: parts[2]}, nil
}
