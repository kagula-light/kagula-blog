import { describe, expect, it, vi } from "vitest";

import {
  archiveHotspots,
  getPreviousBeijingDate,
  type DailyHotspotArchiveRepository,
} from "./archive-hotspots";

describe("getPreviousBeijingDate", () => {
  it.each([
    ["2026-07-15T15:59:59.999Z", "2026-07-14"],
    ["2026-07-15T16:00:00.000Z", "2026-07-15"],
    ["2025-12-31T16:00:00.000Z", "2025-12-31"],
    ["2026-03-29T16:00:00.000Z", "2026-03-29"],
  ] as const)("maps %s to previous Beijing date %s", (instant, expected) => {
    expect(getPreviousBeijingDate(new Date(instant))).toBe(expected);
  });
});

describe("archiveHotspots", () => {
  it("delegates one immutable snapshot for the previous Beijing date", async () => {
    const createArchive = vi.fn(async () => ({ status: "CREATED" as const, itemCount: 2 }));
    const repository: DailyHotspotArchiveRepository = { createArchive };
    const now = new Date("2026-07-15T16:05:00.000Z");

    await expect(archiveHotspots(repository, now)).resolves.toEqual({
      status: "CREATED",
      itemCount: 2,
    });
    expect(createArchive).toHaveBeenCalledWith({ archiveDate: "2026-07-15", archivedAt: now });
  });

  it("returns the existing archive result on a retry", async () => {
    const repository: DailyHotspotArchiveRepository = {
      createArchive: vi.fn(async () => ({ status: "EXISTING" as const, itemCount: 4 })),
    };

    await expect(
      archiveHotspots(repository, new Date("2026-07-16T16:05:00.000Z")),
    ).resolves.toEqual({ status: "EXISTING", itemCount: 4 });
  });
});
