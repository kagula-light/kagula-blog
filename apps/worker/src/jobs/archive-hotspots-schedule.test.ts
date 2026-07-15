import { afterEach, describe, expect, it, vi } from "vitest";

import {
  millisecondsUntilNextArchiveRun,
  startDailyHotspotArchiveSchedule,
} from "./archive-hotspots-schedule";

afterEach(() => {
  vi.useRealTimers();
});

describe("daily hotspot archive schedule", () => {
  it.each([
    ["2026-07-15T15:00:00.000Z", 65 * 60 * 1_000],
    ["2026-07-15T16:05:00.000Z", 24 * 60 * 60 * 1_000],
    ["2026-07-15T16:06:00.000Z", (23 * 60 + 59) * 60 * 1_000],
  ] as const)("schedules %s after %s milliseconds", (instant, expected) => {
    expect(millisecondsUntilNextArchiveRun(new Date(instant))).toBe(expected);
  });

  it("catches up asynchronously on start and runs again after Beijing midnight", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-15T15:00:00.000Z"));
    const archive = vi.fn(async () => undefined);
    const schedule = startDailyHotspotArchiveSchedule({ archive });

    expect(archive).not.toHaveBeenCalled();
    await vi.runAllTicks();
    expect(archive).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(65 * 60 * 1_000);
    expect(archive).toHaveBeenCalledTimes(2);
    schedule.stop();
  });

  it("reports failure without stopping the next daily run", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-15T16:05:00.000Z"));
    const failure = new Error("archive unavailable");
    const archive = vi
      .fn<() => Promise<void>>()
      .mockRejectedValueOnce(failure)
      .mockResolvedValueOnce(undefined);
    const onFailure = vi.fn();
    const schedule = startDailyHotspotArchiveSchedule({ archive, onFailure });

    await vi.runAllTicks();
    await vi.runAllTicks();
    expect(onFailure).toHaveBeenCalledWith(failure);
    await vi.advanceTimersByTimeAsync(24 * 60 * 60 * 1_000);
    expect(archive).toHaveBeenCalledTimes(2);
    schedule.stop();
  });
});
