import { describe, expect, it, vi } from "vitest";

import { loadMascot } from "./load-mascot";

describe("loadMascot", () => {
  it("creates one widget and exposes only the supported lifecycle", async () => {
    const sleep = vi.fn();
    const destroy = vi.fn().mockResolvedValue(undefined);
    const add = vi.fn();
    const on = vi.fn((_event: string, listener: () => void) => listener());
    const createWidget = vi.fn(() => ({
      l2d: { on, canvas: { parentElement: { classList: { add } } } },
      switchModel: vi.fn(),
      sleep,
      destroy,
    }));

    const runtime = await loadMascot(
      "https://assets.example.com/models/kagura/model3.json",
      async () => ({ createWidget }),
    );

    expect(createWidget).toHaveBeenCalledOnce();
    expect(createWidget).toHaveBeenCalledWith({
      model: {
        path: "https://assets.example.com/models/kagura/model3.json",
        tips: false,
      },
      menus: { items: [] },
      position: "bottom-right",
      size: { width: 240, height: 320 },
      transitionDuration: 0,
      transitionType: "fade",
    });
    expect(on).toHaveBeenCalledWith("loaded", expect.any(Function));
    expect(add).toHaveBeenCalledWith("kagura-mascot-runtime-host");
    expect(Object.keys(runtime).sort()).toEqual(["destroy", "sleep"]);

    runtime.sleep();
    await runtime.destroy();
    expect(sleep).toHaveBeenCalledOnce();
    expect(destroy).toHaveBeenCalledOnce();
  });

  it("waits for the model loaded signal before resolving", async () => {
    let announceLoaded: (() => void) | undefined;
    const createWidget = vi.fn(() => ({
      l2d: {
        on: vi.fn((_event: string, listener: () => void) => {
          announceLoaded = listener;
        }),
      },
      sleep: vi.fn(),
      destroy: vi.fn().mockResolvedValue(undefined),
    }));

    let settled = false;
    const loading = loadMascot(
      "https://assets.example.com/models/kagura/model3.json",
      async () => ({
        createWidget,
      }),
    ).then((runtime) => {
      settled = true;
      return runtime;
    });

    await Promise.resolve();
    expect(settled).toBe(false);
    announceLoaded?.();
    await expect(loading).resolves.toEqual({
      sleep: expect.any(Function),
      destroy: expect.any(Function),
    });
  });

  it("destroys and rejects a widget that never loads", async () => {
    vi.useFakeTimers();
    const destroy = vi.fn().mockResolvedValue(undefined);
    const loading = loadMascot(
      "https://assets.example.com/models/missing.model3.json",
      async () => ({
        createWidget: vi.fn(() => ({
          l2d: { on: vi.fn() },
          sleep: vi.fn(),
          destroy,
        })),
      }),
      4_000,
    );
    const rejection = expect(loading).rejects.toThrow("mascot model load timed out");

    await vi.advanceTimersByTimeAsync(4_000);
    await rejection;
    expect(destroy).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });

  it("destroys a partial widget when lifecycle validation fails", async () => {
    const destroy = vi.fn().mockResolvedValue(undefined);

    await expect(
      loadMascot("https://assets.example.com/models/broken.model3.json", async () => ({
        createWidget: vi.fn(() => ({ destroy })),
      })),
    ).rejects.toThrow("mascot widget lifecycle");
    expect(destroy).toHaveBeenCalledOnce();
  });
});
