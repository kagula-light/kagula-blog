const beijingOffsetMs = 8 * 60 * 60 * 1_000;

export function millisecondsUntilNextArchiveRun(now: Date): number {
  if (!Number.isFinite(now.getTime())) throw new Error("archive schedule instant is invalid");
  const beijing = new Date(now.getTime() + beijingOffsetMs);
  let target = Date.UTC(
    beijing.getUTCFullYear(),
    beijing.getUTCMonth(),
    beijing.getUTCDate(),
    0,
    5,
  );
  if (target <= beijing.getTime()) target += 24 * 60 * 60 * 1_000;
  return target - beijing.getTime();
}

export interface DailyHotspotArchiveScheduleDependencies {
  readonly archive: () => Promise<void>;
  readonly onFailure?: (error: unknown) => void;
}

export interface DailyHotspotArchiveSchedule {
  readonly stop: () => void;
}

export function startDailyHotspotArchiveSchedule({
  archive,
  onFailure = () => undefined,
}: DailyHotspotArchiveScheduleDependencies): DailyHotspotArchiveSchedule {
  let active = false;
  let stopped = false;
  let timer: NodeJS.Timeout | undefined;

  const run = async (): Promise<void> => {
    if (active || stopped) return;
    active = true;
    try {
      await archive();
    } catch (error) {
      onFailure(error);
    } finally {
      active = false;
    }
  };
  const scheduleNext = (): void => {
    if (stopped) return;
    timer = setTimeout(() => {
      void run();
      scheduleNext();
    }, millisecondsUntilNextArchiveRun(new Date()));
    timer.unref();
  };

  queueMicrotask(() => void run());
  scheduleNext();
  return {
    stop: () => {
      stopped = true;
      if (timer) clearTimeout(timer);
    },
  };
}
