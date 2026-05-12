// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from "vitest";

import { resolve, type ThemePref } from "./theme";

describe("theme.resolve", () => {
  it("returns the explicit choice unchanged", () => {
    expect(resolve("light")).toBe("light");
    expect(resolve("dark")).toBe("dark");
  });

  it("resolves 'system' to either light or dark", () => {
    const r = resolve("system" as ThemePref);
    expect(["light", "dark"]).toContain(r);
  });
});
