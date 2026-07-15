import { describe, expect, it, vi } from "vitest";

import {
  scheduleMascotIdleTask,
  shouldAutoLoadMascot,
  type MascotAutoLoadContext,
} from "./use-mascot-runtime";

const readyContext: MascotAutoLoadContext = {
  enabled: true,
  modelUrl: "https://assets.example.com/models/kagura/model3.json",
  desktop: true,
  reducedMotion: false,
  dismissed: false,
  welcomeComplete: true,
  automaticAttempted: false,
};

describe("shouldAutoLoadMascot", () => {
  it("allows one desktop idle load after welcome completion", () => {
    expect(shouldAutoLoadMascot(readyContext)).toBe(true);
  });

  it.each<Partial<MascotAutoLoadContext>>([
    { enabled: false },
    { modelUrl: null },
    { desktop: false },
    { reducedMotion: true },
    { dismissed: true },
    { welcomeComplete: false },
    { automaticAttempted: true },
  ])("blocks automatic loading for %o", (override) => {
    expect(shouldAutoLoadMascot({ ...readyContext, ...override })).toBe(false);
  });
});

describe("scheduleMascotIdleTask", () => {
  it("uses and cancels requestIdleCallback when available", () => {
    const task = vi.fn();
    const requestIdleCallback = vi.fn(() => 41);
    const cancelIdleCallback = vi.fn();
    const cancel = scheduleMascotIdleTask(
      {
        requestIdleCallback,
        cancelIdleCallback,
        setTimeout: vi.fn(),
        clearTimeout: vi.fn(),
      },
      task,
    );

    expect(requestIdleCallback).toHaveBeenCalledWith(task, { timeout: 2_000 });
    cancel();
    expect(cancelIdleCallback).toHaveBeenCalledWith(41);
  });

  it("falls back to a cancellable timer", () => {
    const task = vi.fn();
    const setTimeout = vi.fn(() => 73);
    const clearTimeout = vi.fn();
    const cancel = scheduleMascotIdleTask({ setTimeout, clearTimeout }, task);

    expect(setTimeout).toHaveBeenCalledWith(task, 600);
    cancel();
    expect(clearTimeout).toHaveBeenCalledWith(73);
  });
});
