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

	s.mux.HandleFunc("GET /auth/login", s.handleLogin)
	s.mux.HandleFunc("GET /auth/callback", s.handleCallback)
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

func (s *Server) handleLogin(w http.ResponseWriter, r *http.Request) {
	if s.oidc == nil {
		http.Error(w, "auth not configured", http.StatusServiceUnavailable)
		return
	}
	p, err := oidc.NewPKCE()
	if err != nil {
		http.Error(w, "pkce init failed", http.StatusInternalServerError)
		return
	}
	// Encode PKCE state in the cookie so we don't need server-side storage.
	val, err := encodePKCE(p)
	if err != nil {
		http.Error(w, "pkce encode failed", http.StatusInternalServerError)
		return
	}
	http.SetCookie(w, &http.Cookie{
		Name:     pkceCookie,
		Value:    val,
		Path:     "/auth/callback",
		MaxAge:   300,
		HttpOnly: true,
		Secure:   s.cfg.CookieSecure,
		SameSite: http.SameSiteLaxMode,
	})
	http.Redirect(w, r, s.oidc.AuthCodeURL(p), http.StatusFound)
}

func (s *Server) handleCallback(w http.ResponseWriter, r *http.Request) {
	if s.oidc == nil {
		http.Error(w, "auth not configured", http.StatusServiceUnavailable)
		return
	}
	c, err := r.Cookie(pkceCookie)
	if err != nil {
		http.Error(w, "missing pkce cookie", http.StatusBadRequest)
		return
	}
	// Clear the PKCE cookie regardless of outcome.
	http.SetCookie(w, &http.Cookie{
		Name: pkceCookie, Value: "", Path: "/auth/callback",
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
	ex, err := s.oidc.Exchange(ctx, code, p)
	if err != nil {
		s.logger.Warn("oidc exchange failed", "err", err)
		http.Error(w, "exchange failed", http.StatusBadGateway)
		return
	}
	id, err := s.sessions.New(r.Context(), session.Session{
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
		"subject":       sess.Subject,
		"email":         sess.Email,
		"name":          sess.Name,
	})
}

// --- API proxy ---

func (s *Server) handleAPI(w http.ResponseWriter, r *http.Request) {
	if s.apiProxy == nil {
		http.Error(w, "upstream not configured", http.StatusServiceUnavailable)
		return
	}
	if _, err := s.currentSession(r); err != nil {
		http.Error(w, "unauthenticated", http.StatusUnauthorized)
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
