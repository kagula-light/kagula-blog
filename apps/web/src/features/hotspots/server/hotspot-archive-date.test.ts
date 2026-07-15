import { describe, expect, it } from "vitest";

import { parseHotspotArchiveDate } from "./hotspot-archive-date";

describe("parseHotspotArchiveDate", () => {
  it.each(["2026-07-15", "2024-02-29", "2099-12-31"])("accepts calendar date %s", (value) => {
    expect(parseHotspotArchiveDate(value)).toBe(value);
  });

  it.each([
    "2026-7-15",
    "26-07-15",
    "2026/07/15",
    "2026-02-29",
    "2026-04-31",
    "2026-00-10",
    "2026-13-10",
    "not-a-date",
  ])("rejects invalid archive date %s", (value) => {
    expect(parseHotspotArchiveDate(value)).toBeNull();
  });
});
