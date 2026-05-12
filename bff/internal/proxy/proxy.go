// SPDX-License-Identifier: AGPL-3.0-or-later

// Package proxy reverse-proxies /api/* from the BFF to the
// upstream Linea-server, attaching the caller's bearer token
// from their session. The browser never sees the token.
package proxy

import (
	"errors"
	"net/http"
	"net/http/httputil"
	"net/url"
	"strings"
)

// TokenSource resolves the request to a bearer access token.
// Implemented by the server's session middleware.
type TokenSource func(r *http.Request) (string, bool)

// New builds a reverse proxy for upstreamURL with /api stripped.
//
//	BFF:    GET /api/v1/genealogies
//	Server: GET /v1/genealogies (with Authorization: Bearer ...)
func New(upstreamURL string, tokens TokenSource) (http.Handler, error) {
	if upstreamURL == "" {
		return nil, errors.New("proxy: upstream URL required")
	}
	target, err := url.Parse(upstreamURL)
	if err != nil {
		return nil, err
	}
	rp := httputil.NewSingleHostReverseProxy(target)
	orig := rp.Director
	rp.Director = func(req *http.Request) {
		orig(req)
		req.URL.Path = strings.TrimPrefix(req.URL.Path, "/api")
		if req.URL.Path == "" {
			req.URL.Path = "/"
		}
		req.Host = target.Host
		// Strip any inbound Authorization header — only the
		// session-derived token is allowed to flow upstream.
		req.Header.Del("Authorization")
		if tokens != nil {
			if tok, ok := tokens(req); ok {
				req.Header.Set("Authorization", "Bearer "+tok)
			}
		}
		// Hop-by-hop hygiene.
		req.Header.Del("Cookie")
	}
	return rp, nil
}
