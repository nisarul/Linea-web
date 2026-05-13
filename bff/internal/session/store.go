// SPDX-License-Identifier: AGPL-3.0-or-later

// Package session implements the BFF's server-side session store.
//
// Sessions hold OIDC tokens (access, refresh, id) plus identity
// claims. The browser only ever receives an opaque random id in
// an HttpOnly; SameSite=Strict; Secure cookie. Tokens never leave
// the BFF process.
//
// Backed by BadgerDB so sessions survive process restarts. Entries
// have a TTL aligned with the refresh-token expiry; a background
// sweeper would be added by Badger itself via SetEntry's TTL.
package session

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	badger "github.com/dgraph-io/badger/v4"
)

// CookieName is the HttpOnly cookie carrying the session id.
const CookieName = "linea_sid"

// Session is the server-side record. JSON-serialised in Badger.
type Session struct {
	ID           string    `json:"id"`
	Provider     string    `json:"provider,omitempty"`
	Subject      string    `json:"sub"`
	Email        string    `json:"email,omitempty"`
	Name         string    `json:"name,omitempty"`
	AccessToken  string    `json:"access_token"`
	RefreshToken string    `json:"refresh_token,omitempty"`
	IDToken      string    `json:"id_token,omitempty"`
	AccessExpiry time.Time `json:"access_expiry"`
	CreatedAt    time.Time `json:"created_at"`
}

// ErrNotFound is returned when a session id has no record (or has expired).
var ErrNotFound = errors.New("session: not found")

// Store is a Badger-backed session store.
type Store struct {
	db  *badger.DB
	ttl time.Duration
}

// Open opens (or creates) a Badger database at dir.
//
// If dir is empty, an in-memory Badger is used (handy for tests).
// ttl is the maximum session lifetime regardless of token refresh.
func Open(dir string, ttl time.Duration) (*Store, error) {
	var opts badger.Options
	if dir == "" {
		opts = badger.DefaultOptions("").WithInMemory(true)
	} else {
		opts = badger.DefaultOptions(dir)
	}
	opts.Logger = nil
	db, err := badger.Open(opts)
	if err != nil {
		return nil, fmt.Errorf("session: open badger: %w", err)
	}
	if ttl <= 0 {
		ttl = 12 * time.Hour
	}
	return &Store{db: db, ttl: ttl}, nil
}

// Close releases the underlying database.
func (s *Store) Close() error { return s.db.Close() }

// New creates and persists a new session. The returned id is the
// opaque value to put in the cookie.
func (s *Store) New(_ context.Context, sess Session) (string, error) {
	id, err := newID()
	if err != nil {
		return "", err
	}
	sess.ID = id
	sess.CreatedAt = time.Now().UTC()
	if err := s.put(sess); err != nil {
		return "", err
	}
	return id, nil
}

// Get returns the session for id, or ErrNotFound.
func (s *Store) Get(_ context.Context, id string) (Session, error) {
	var out Session
	err := s.db.View(func(txn *badger.Txn) error {
		item, err := txn.Get([]byte(id))
		if err != nil {
			if errors.Is(err, badger.ErrKeyNotFound) {
				return ErrNotFound
			}
			return err
		}
		return item.Value(func(b []byte) error { return json.Unmarshal(b, &out) })
	})
	return out, err
}

// Update overwrites the record at sess.ID (used after refresh).
func (s *Store) Update(_ context.Context, sess Session) error {
	if sess.ID == "" {
		return errors.New("session: update needs ID")
	}
	return s.put(sess)
}

// Delete removes a session. Idempotent.
func (s *Store) Delete(_ context.Context, id string) error {
	return s.db.Update(func(txn *badger.Txn) error { return txn.Delete([]byte(id)) })
}

func (s *Store) put(sess Session) error {
	b, err := json.Marshal(sess)
	if err != nil {
		return err
	}
	return s.db.Update(func(txn *badger.Txn) error {
		e := badger.NewEntry([]byte(sess.ID), b).WithTTL(s.ttl)
		return txn.SetEntry(e)
	})
}

func newID() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(b), nil
}
