// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from "vitest";
import { lifeRange, preferredName, type Person } from "./persons";

const mk = (over: Partial<Person> = {}): Person => ({
  id: { value: "p-1" },
  ...over,
});

describe("preferredName", () => {
  it("returns 'Unknown ancestor' for placeholder persons", () => {
    expect(preferredName(mk({ unknownAncestor: true }))).toBe("Unknown ancestor");
  });

  it("returns the preferred name when present", () => {
    expect(
      preferredName(
        mk({
          names: [
            { text: "Suleiman" },
            { text: "Suleiman the Magnificent", preferred: true },
          ],
        }),
      ),
    ).toBe("Suleiman the Magnificent");
  });

  it("falls back to the first name when no preferred", () => {
    expect(
      preferredName(mk({ names: [{ text: "Alice" }, { text: "Bob" }] })),
    ).toBe("Alice");
  });

  it("falls back to an id stub when no names recorded", () => {
    expect(preferredName(mk({ id: { value: "abcdef1234" } }))).toBe("abcdef12");
  });
});

describe("lifeRange", () => {
  it("returns empty string when no vitals are known", () => {
    expect(lifeRange(mk())).toBe("");
  });

  it("renders earliestKnown years, applying 'c.' for circa", () => {
    expect(
      lifeRange(
        mk({
          birth: { earliestKnown: true, earliestYear: 1494, circa: true },
          death: { earliestKnown: true, earliestYear: 1566 },
        }),
      ),
    ).toBe("c. 1494 – 1566");
  });

  it("uses ≤ prefix when only latestKnown is set", () => {
    expect(
      lifeRange(
        mk({
          death: { latestKnown: true, latestYear: 1800 },
        }),
      ),
    ).toBe("? – ≤1800");
  });
});
