import { afterEach, describe, expect, it, vi } from "vitest";

import { startHotspotCollectionSchedule } from "./collect-hotspots-schedule";

afterEach(() => {
  vi.useRealTimers();
});

describe("startHotspotCollectionSchedule", () => {
  it("does not collect or create a timer when collection is disabled", async () => {
    vi.useFakeTimers();
    const collect = vi.fn(async () => undefined);

    const schedule = startHotspotCollectionSchedule({ enabled: false, collect });
    await vi.runAllTicks();
    await vi.advanceTimersByTimeAsync(60 * 60 * 1_000);

    expect(collect).not.toHaveBeenCalled();
    schedule.stop();
  });

  it("collects asynchronously on start and then every thirty minutes", async () => {
    vi.useFakeTimers();
    const collect = vi.fn(async () => undefined);

    const schedule = startHotspotCollectionSchedule({ enabled: true, collect });
    expect(collect).not.toHaveBeenCalled();
    await vi.runAllTicks();
    expect(collect).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(30 * 60 * 1_000);
    expect(collect).toHaveBeenCalledTimes(2);
    schedule.stop();
  });

  it("reports a failure and retries at the next interval", async () => {
    vi.useFakeTimers();
    const failure = new Error("database unavailable");
    const collect = vi
      .fn<() => Promise<void>>()
      .mockRejectedValueOnce(failure)
      .mockResolvedValueOnce(undefined);
    const onFailure = vi.fn();

    const schedule = startHotspotCollectionSchedule({ enabled: true, collect, onFailure });
    await vi.runAllTicks();
    await vi.runAllTicks();
    expect(onFailure).toHaveBeenCalledWith(failure);

    await vi.advanceTimersByTimeAsync(30 * 60 * 1_000);
    expect(collect).toHaveBeenCalledTimes(2);
    schedule.stop();
  });

  it("does not overlap runs when a collection takes longer than the interval", async () => {
    vi.useFakeTimers();
    let finishCollection: (() => void) | undefined;
    const collect = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finishCollection = resolve;
        }),
    );

    const schedule = startHotspotCollectionSchedule({ enabled: true, collect });
    await vi.runAllTicks();
    await vi.advanceTimersByTimeAsync(30 * 60 * 1_000);
    expect(collect).toHaveBeenCalledOnce();

    finishCollection?.();
    await vi.runAllTicks();
    await vi.advanceTimersByTimeAsync(30 * 60 * 1_000);
    expect(collect).toHaveBeenCalledTimes(2);
    schedule.stop();
  });
});
