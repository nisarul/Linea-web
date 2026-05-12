// SPDX-License-Identifier: AGPL-3.0-or-later
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components";
import { fetchMe, login, logout } from "@/lib/auth";

/**
 * UserMenu shows the current user's avatar/initials and exposes
 * a dropdown with sign-out. When unauthenticated, it renders a
 * Sign-in button that hands off to the BFF's OIDC redirect.
 */
export function UserMenu() {
  const me = useQuery({ queryKey: ["me"], queryFn: fetchMe, staleTime: 60_000 });
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (me.isLoading) {
    return <div className="h-8 w-16 animate-pulse rounded-md bg-(--color-bg-sunken)" aria-hidden />;
  }

  if (!me.data?.authenticated) {
    return (
      <Button
        size="sm"
        variant="primary"
        onClick={() => login(window.location.pathname + window.location.search)}
      >
        Sign in
      </Button>
    );
  }

  const initials = computeInitials(me.data.name, me.data.email, me.data.subject);
  const display = me.data.name || me.data.email || me.data.subject || "Account";

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex h-8 w-8 items-center justify-center rounded-full bg-(--color-accent)/15 text-xs font-medium text-(--color-accent) transition-colors hover:bg-(--color-accent)/25 outline-none focus-visible:ring-2 focus-visible:ring-(--color-accent)/40"
      >
        {initials}
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-56 overflow-hidden rounded-lg border border-(--color-border-default) bg-(--color-bg-overlay) shadow-(--shadow-md)"
        >
          <div className="border-b border-(--color-border-subtle) px-3 py-2">
            <div className="truncate text-sm font-medium">{display}</div>
            {me.data.email && me.data.email !== display && (
              <div className="truncate text-xs text-(--color-fg-muted)">{me.data.email}</div>
            )}
          </div>
          <button
            type="button"
            role="menuitem"
            onClick={() => void logout()}
            className="block w-full px-3 py-2 text-left text-sm text-(--color-fg-secondary) hover:bg-(--color-bg-sunken) hover:text-(--color-fg-primary)"
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

function computeInitials(name?: string, email?: string, sub?: string): string {
  const src = (name || email || sub || "?").trim();
  if (!src) return "?";
  const parts = src.split(/[\s@._-]+/).filter(Boolean);
  if (parts.length >= 2) return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase();
  return src.slice(0, 2).toUpperCase();
}
