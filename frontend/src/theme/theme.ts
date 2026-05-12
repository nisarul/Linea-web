// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Theme model
// -----------
//
// Three preferences are exposed to the user:
//   "light"  — always light
//   "dark"   — always dark
//   "system" — follow OS prefers-color-scheme
//
// Only TWO actual values ever land on <html data-theme="...">: light or dark.
// The "system" preference is resolved to whichever the OS reports right now,
// and re-resolved when the OS preference changes.
//
// The preference is persisted in a cookie named `linea_theme` so the BFF
// can render the correct attribute server-side on first paint (no flash).
// The inline boot script in index.html applies the same logic before React
// mounts, so the static-asset / dev-server case has no flash either.

export type ThemePref = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

const COOKIE = "linea_theme";

export function readPref(): ThemePref {
  if (typeof document === "undefined") return "system";
  const m = document.cookie.match(/(?:^|; )linea_theme=([^;]+)/);
  if (!m || !m[1]) return "system";
  const v = decodeURIComponent(m[1]);
  return v === "light" || v === "dark" || v === "system" ? v : "system";
}

export function writePref(p: ThemePref): void {
  // 400 days — the maximum the spec allows for a Set-Cookie Max-Age.
  const maxAge = 60 * 60 * 24 * 400;
  document.cookie =
    `${COOKIE}=${encodeURIComponent(p)}; Max-Age=${maxAge}; Path=/; SameSite=Lax`;
}

export function systemTheme(): ResolvedTheme {
  if (typeof window === "undefined" || !window.matchMedia) return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export function resolve(pref: ThemePref): ResolvedTheme {
  return pref === "system" ? systemTheme() : pref;
}

export function apply(pref: ThemePref): ResolvedTheme {
  const resolved = resolve(pref);
  document.documentElement.setAttribute("data-theme", resolved);
  document.documentElement.setAttribute("data-theme-pref", pref);
  return resolved;
}

/**
 * Subscribe to OS-level prefers-color-scheme changes. Only meaningful when
 * the active preference is "system"; the caller is expected to gate the
 * subscription on that.
 */
export function onSystemChange(cb: (t: ResolvedTheme) => void): () => void {
  if (typeof window === "undefined" || !window.matchMedia) return () => {};
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  const handler = (e: MediaQueryListEvent) => cb(e.matches ? "dark" : "light");
  mq.addEventListener("change", handler);
  return () => mq.removeEventListener("change", handler);
}
