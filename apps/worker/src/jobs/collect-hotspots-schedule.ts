const collectionIntervalMs = 30 * 60 * 1_000;

export interface HotspotCollectionScheduleDependencies {
  readonly enabled: boolean;
  readonly collect: () => Promise<void>;
  readonly onFailure?: (error: unknown) => void;
}

export interface HotspotCollectionSchedule {
  readonly stop: () => void;
}

export function startHotspotCollectionSchedule({
  enabled,
  collect,
  onFailure = () => undefined,
}: HotspotCollectionScheduleDependencies): HotspotCollectionSchedule {
  if (!enabled) return { stop: () => undefined };

  let active = false;
  let stopped = false;
  const run = async (): Promise<void> => {
    if (active || stopped) return;
    active = true;
    try {
      await collect();
    } catch (error) {
      onFailure(error);
    } finally {
      active = false;
    }
  };

  queueMicrotask(() => void run());
  const timer = setInterval(() => void run(), collectionIntervalMs);
  timer.unref();

  return {
    stop: () => {
      stopped = true;
      clearInterval(timer);
    },
  };
}
