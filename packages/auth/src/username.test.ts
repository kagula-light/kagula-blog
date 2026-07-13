import { describe, expect, it } from "vitest";

import { normalizeUsername } from "./username";

describe("normalizeUsername", () => {
  it("normalizes width, surrounding space, and ASCII case", () => {
    expect(normalizeUsername("  Ｋａｇｕｒａ_01  ")).toBe("kagura_01");
  });

  it.each(["ab", "contains space", "name!", "a".repeat(33)])(
    "rejects unsupported username %s",
    (username) => expect(() => normalizeUsername(username)).toThrow(/username/i),
  );
});
