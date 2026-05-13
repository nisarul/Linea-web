// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from "vitest";
import {
  canManageMembers,
  isOwner,
  prettyRole,
  prettyVisibility,
} from "./genealogies";

describe("genealogies role helpers", () => {
  it("isOwner only matches OWNER", () => {
    expect(isOwner("GENEALOGY_ROLE_OWNER")).toBe(true);
    expect(isOwner("GENEALOGY_ROLE_CURATOR")).toBe(false);
    expect(isOwner("GENEALOGY_ROLE_VIEWER")).toBe(false);
  });

  it("canManageMembers covers Owner and Curator only", () => {
    expect(canManageMembers("GENEALOGY_ROLE_OWNER")).toBe(true);
    expect(canManageMembers("GENEALOGY_ROLE_CURATOR")).toBe(true);
    expect(canManageMembers("GENEALOGY_ROLE_CONTRIBUTOR")).toBe(false);
    expect(canManageMembers("GENEALOGY_ROLE_VIEWER")).toBe(false);
    expect(canManageMembers("GENEALOGY_ROLE_NONE")).toBe(false);
  });

  it("pretty printers strip enum prefixes", () => {
    expect(prettyRole("GENEALOGY_ROLE_CURATOR")).toBe("curator");
    expect(prettyVisibility("VISIBILITY_PUBLIC")).toBe("public");
  });
});
