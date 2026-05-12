// SPDX-License-Identifier: AGPL-3.0-or-later
import { useTheme } from "@/theme/useTheme";
import { Button } from "./Button";

/**
 * ThemeToggle cycles through Light → Dark → System.
 *
 * Shows a glyph for the *next* state on hover (microinteraction
 * borrowed from Linear). The button label reflects the *current*
 * preference for screen readers.
 */
export function ThemeToggle() {
  const { pref, cycle } = useTheme();
  const label = pref === "system" ? "System theme" : pref === "dark" ? "Dark theme" : "Light theme";
  return (
    <Button
      variant="ghost"
      size="sm"
      aria-label={`Theme: ${label} (click to cycle)`}
      title={label}
      onClick={cycle}
      className="px-2"
    >
      {pref === "light" && <SunIcon />}
      {pref === "dark" && <MoonIcon />}
      {pref === "system" && <SystemIcon />}
    </Button>
  );
}

function SunIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  );
}
function MoonIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}
function SystemIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <path d="M8 20h8M12 16v4" />
    </svg>
  );
}
