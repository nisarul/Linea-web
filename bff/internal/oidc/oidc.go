// SPDX-License-Identifier: AGPL-3.0-or-later

// Package oidc implements the BFF's OIDC Authorization Code +
// PKCE flow against any OIDC-compliant issuer (Keycloak in dev,
// Entra/Auth0/etc. in prod).
//
// The package is deliberately small: it owns provider discovery,
// the auth-code exchange, ID-token verification, and refresh.
// It does NOT touch HTTP — the server package wires routes.
package oidc

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"fmt"
	"time"

	gooidc "github.com/coreos/go-oidc/v3/oidc"
	"golang.org/x/oauth2"
)

// Config configures the OIDC client.
type Config struct {
	IssuerURL    string   // e.g. http://keycloak:8080/realms/linea
	ClientID     string   // public client id
	ClientSecret string   // optional (confidential clients only)
	RedirectURL  string   // BFF's /auth/callback URL
	Scopes       []string // defaults to [openid, profile, email, offline_access]
	// ExtraAuthURLParams are appended to every AuthCodeURL call.
	// Used for provider-specific quirks (e.g. Google needs
	// access_type=offline + prompt=consent to issue a refresh token).
	ExtraAuthURLParams map[string]string
}

// Client wraps the verified OIDC provider + oauth2 config.
type Client struct {
	cfg      Config
	provider *gooidc.Provider
	oauth    *oauth2.Config
	verifier *gooidc.IDTokenVerifier
}

// New discovers the provider's metadata and returns a ready Client.
func New(ctx context.Context, cfg Config) (*Client, error) {
	if cfg.IssuerURL == "" || cfg.ClientID == "" || cfg.RedirectURL == "" {
		return nil, errors.New("oidc: IssuerURL, ClientID and RedirectURL are required")
	}
	if len(cfg.Scopes) == 0 {
		cfg.Scopes = defaultScopesFor(cfg.IssuerURL)
	}
	if cfg.ExtraAuthURLParams == nil {
		cfg.ExtraAuthURLParams = defaultExtraAuthParamsFor(cfg.IssuerURL)
	}
	provider, err := gooidc.NewProvider(ctx, cfg.IssuerURL)
	if err != nil {
		return nil, fmt.Errorf("oidc: discover %s: %w", cfg.IssuerURL, err)
	}
	return &Client{
		cfg:      cfg,
		provider: provider,
		oauth: &oauth2.Config{
			ClientID:     cfg.ClientID,
			ClientSecret: cfg.ClientSecret,
			RedirectURL:  cfg.RedirectURL,
			Endpoint:     provider.Endpoint(),
			Scopes:       cfg.Scopes,
		},
		verifier: provider.Verifier(&gooidc.Config{ClientID: cfg.ClientID}),
	}, nil
}

// defaultScopesFor returns the OIDC scopes appropriate for an issuer.
// Google rejects the standard "offline_access" scope (it uses
// access_type=offline instead), so we drop it for that provider.
func defaultScopesFor(issuer string) []string {
	base := []string{gooidc.ScopeOpenID, "profile", "email"}
	if isGoogleIssuer(issuer) {
		return base
	}
	return append(base, gooidc.ScopeOfflineAccess)
}

// defaultExtraAuthParamsFor returns provider-specific auth-URL
// parameters (e.g. Google's access_type / prompt to obtain a
// refresh token).
func defaultExtraAuthParamsFor(issuer string) map[string]string {
	if isGoogleIssuer(issuer) {
		return map[string]string{
			"access_type": "offline",
			"prompt":      "consent",
		}
	}
	return nil
}

func isGoogleIssuer(issuer string) bool {
	return issuer == "https://accounts.google.com" || issuer == "accounts.google.com"
}

// PKCE holds the per-request verifier + state. The BFF must
// stash this (in a short-lived cookie or signed state cache)
// between /auth/login and /auth/callback.
type PKCE struct {
	State        string
	Nonce        string
	CodeVerifier string
}

// NewPKCE generates fresh state / nonce / verifier.
func NewPKCE() (PKCE, error) {
	state, err := randURL(24)
	if err != nil {
		return PKCE{}, err
	}
	nonce, err := randURL(24)
	if err != nil {
		return PKCE{}, err
	}
	verifier, err := randURL(48) // 64 chars after base64url
	if err != nil {
		return PKCE{}, err
	}
	return PKCE{State: state, Nonce: nonce, CodeVerifier: verifier}, nil
}

// AuthCodeURL returns the URL to redirect the browser to.
func (c *Client) AuthCodeURL(p PKCE) string {
	sum := sha256.Sum256([]byte(p.CodeVerifier))
	challenge := base64.RawURLEncoding.EncodeToString(sum[:])
	opts := []oauth2.AuthCodeOption{
		oauth2.SetAuthURLParam("code_challenge", challenge),
		oauth2.SetAuthURLParam("code_challenge_method", "S256"),
		gooidc.Nonce(p.Nonce),
	}
	for k, v := range c.cfg.ExtraAuthURLParams {
		opts = append(opts, oauth2.SetAuthURLParam(k, v))
	}
	return c.oauth.AuthCodeURL(p.State, opts...)
}

// Identity is the verified subset of ID-token claims the BFF cares about.
type Identity struct {
	Subject string
	Email   string
	Name    string
}

// Exchanged is the full result of the code exchange.
type Exchanged struct {
	Identity     Identity
	AccessToken  string
	RefreshToken string
	IDToken      string
	AccessExpiry time.Time
}

// Exchange exchanges the auth code for tokens, verifies the ID
// token, and returns identity + tokens.
func (c *Client) Exchange(ctx context.Context, code string, p PKCE) (Exchanged, error) {
	tok, err := c.oauth.Exchange(ctx, code,
		oauth2.SetAuthURLParam("code_verifier", p.CodeVerifier),
	)
	if err != nil {
		return Exchanged{}, fmt.Errorf("oidc: code exchange: %w", err)
	}
	rawID, _ := tok.Extra("id_token").(string)
	if rawID == "" {
		return Exchanged{}, errors.New("oidc: response missing id_token")
	}
	idTok, err := c.verifier.Verify(ctx, rawID)
	if err != nil {
		return Exchanged{}, fmt.Errorf("oidc: verify id_token: %w", err)
	}
	if idTok.Nonce != p.Nonce {
		return Exchanged{}, errors.New("oidc: nonce mismatch")
	}
	var claims struct {
		Email string `json:"email"`
		Name  string `json:"name"`
	}
	_ = idTok.Claims(&claims)

	return Exchanged{
		Identity:     Identity{Subject: idTok.Subject, Email: claims.Email, Name: claims.Name},
		AccessToken:  tok.AccessToken,
		RefreshToken: tok.RefreshToken,
		IDToken:      rawID,
		AccessExpiry: tok.Expiry,
	}, nil
}

// Refresh trades a refresh token for a new access token. The
// returned Exchanged carries fresh tokens; identity claims are
// re-read from the new ID token if present, otherwise unchanged.
func (c *Client) Refresh(ctx context.Context, refreshToken string) (Exchanged, error) {
	src := c.oauth.TokenSource(ctx, &oauth2.Token{RefreshToken: refreshToken})
	tok, err := src.Token()
	if err != nil {
		return Exchanged{}, fmt.Errorf("oidc: refresh: %w", err)
	}
	out := Exchanged{
		AccessToken:  tok.AccessToken,
		RefreshToken: tok.RefreshToken,
		AccessExpiry: tok.Expiry,
	}
	if rawID, _ := tok.Extra("id_token").(string); rawID != "" {
		if idTok, err := c.verifier.Verify(ctx, rawID); err == nil {
			out.IDToken = rawID
			var claims struct {
				Email string `json:"email"`
				Name  string `json:"name"`
			}
			_ = idTok.Claims(&claims)
			out.Identity = Identity{Subject: idTok.Subject, Email: claims.Email, Name: claims.Name}
		}
	}
	return out, nil
}

// LogoutURL returns the issuer's RP-initiated logout URL with
// the given post-logout redirect, if the provider advertises one.
// Returns "" if the provider has no end_session_endpoint.
func (c *Client) LogoutURL(idToken, postLogoutRedirect string) string {
	var meta struct {
		EndSession string `json:"end_session_endpoint"`
	}
	if err := c.provider.Claims(&meta); err != nil || meta.EndSession == "" {
		return ""
	}
	u := meta.EndSession
	sep := "?"
	if contains(u, "?") {
		sep = "&"
	}
	return fmt.Sprintf("%s%sid_token_hint=%s&post_logout_redirect_uri=%s",
		u, sep, idToken, postLogoutRedirect)
}

func contains(s, sub string) bool {
	for i := 0; i+len(sub) <= len(s); i++ {
		if s[i:i+len(sub)] == sub {
			return true
		}
	}
	return false
}

func randURL(n int) (string, error) {
	b := make([]byte, n)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(b), nil
}
