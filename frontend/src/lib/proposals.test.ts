// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from "vitest";
import {
  decodePayload,
  prettyAction,
  prettyKind,
  prettyState,
} from "./proposals";

describe("proposals pretty-printers", () => {
  it("prettyState drops the prefix and underscores", () => {
    expect(prettyState("PROPOSAL_STATE_UNDER_REVIEW")).toBe("under review");
    expect(prettyState("PROPOSAL_STATE_DRAFT")).toBe("draft");
  });

  it("prettyAction strips its prefix", () => {
    expect(prettyAction("PROPOSAL_ACTION_SAME_AS_LINK")).toBe("same as link");
    expect(prettyAction("PROPOSAL_ACTION_CREATE")).toBe("create");
  });

  it("prettyKind strips its prefix", () => {
    expect(prettyKind("ENTITY_KIND_PERSON")).toBe("person");
    expect(prettyKind("ENTITY_KIND_RELATIONSHIP")).toBe("relationship");
  });
});

describe("decodePayload", () => {
  it("returns null for missing input", () => {
    expect(decodePayload()).toBeNull();
    expect(decodePayload("")).toBeNull();
  });

  it("decodes base64-encoded JSON round-trip", () => {
    const json = '{"hello":"السلام","n":1}';
    const bin = new TextEncoder().encode(json);
    let s = "";
    bin.forEach((b) => (s += String.fromCharCode(b)));
    const b64 = btoa(s);
    expect(decodePayload(b64)).toEqual({ hello: "السلام", n: 1 });
  });

  it("returns null on malformed base64 / JSON", () => {
    expect(decodePayload("not base64 !!!")).toBeNull();
  });
});
