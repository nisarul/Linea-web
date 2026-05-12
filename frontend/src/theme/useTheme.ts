// SPDX-License-Identifier: AGPL-3.0-or-later
import { useCallback, useEffect, useState } from "react";

import {
  apply,
  onSystemChange,
  readPref,
  resolve,
  writePref,
  type ResolvedTheme,
  type ThemePref,
} from "./theme";

export interface UseThemeResult {
  /** The user's chosen preference (light / dark / system). */
  pref: ThemePref;
  /** The currently active theme (system resolved to light or dark). */
  resolved: ResolvedTheme;
  /** Set the preference and persist it. */
  setPref: (p: ThemePref) => void;
  /** Cycle Light → Dark → System for keyboard / button toggles. */
  cycle: () => void;
}

const ORDER: readonly ThemePref[] = ["light", "dark", "system"] as const;

export function useTheme(): UseThemeResult {
  const [pref, setPrefState] = useState<ThemePref>(() => readPref());
  const [resolved, setResolved] = useState<ResolvedTheme>(() => resolve(readPref()));

  // Apply on mount in case the inline boot script ran with stale cookie.
  useEffect(() => {
    setResolved(apply(pref));
  }, [pref]);

  // Re-resolve when the OS preference changes — only if user picked "system".
  useEffect(() => {
    if (pref !== "system") return;
    return onSystemChange((t) => {
      setResolved(t);
      document.documentElement.setAttribute("data-theme", t);
    });
  }, [pref]);

  const setPref = useCallback((p: ThemePref) => {
    writePref(p);
    setPrefState(p);
  }, []);

  const cycle = useCallback(() => {
    const next = ORDER[(ORDER.indexOf(pref) + 1) % ORDER.length] ?? "system";
    setPref(next);
  }, [pref, setPref]);

  return { pref, resolved, setPref, cycle };
}
