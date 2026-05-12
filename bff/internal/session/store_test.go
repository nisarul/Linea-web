// SPDX-License-Identifier: AGPL-3.0-or-later

package session_test

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/nisarul/Linea-web/bff/internal/session"
)

func TestRoundTrip(t *testing.T) {
	s, err := session.Open("", time.Hour)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = s.Close() })

	id, err := s.New(context.Background(), session.Session{
		Subject:      "alice",
		AccessToken:  "at",
		RefreshToken: "rt",
		AccessExpiry: time.Now().Add(time.Minute),
	})
	if err != nil {
		t.Fatal(err)
	}
	if len(id) < 32 {
		t.Fatalf("id too short: %q", id)
	}

	got, err := s.Get(context.Background(), id)
	if err != nil {
		t.Fatal(err)
	}
	if got.Subject != "alice" || got.AccessToken != "at" {
		t.Fatalf("round-trip mismatch: %+v", got)
	}

	if err := s.Delete(context.Background(), id); err != nil {
		t.Fatal(err)
	}
	if _, err := s.Get(context.Background(), id); !errors.Is(err, session.ErrNotFound) {
		t.Fatalf("expected ErrNotFound, got %v", err)
	}
}
