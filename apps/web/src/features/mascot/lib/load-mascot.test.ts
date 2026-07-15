import { describe, expect, it, vi } from "vitest";

import { loadMascot } from "./load-mascot";

describe("loadMascot", () => {
  it("creates one widget and exposes only the supported lifecycle", async () => {
    const sleep = vi.fn();
    const destroy = vi.fn().mockResolvedValue(undefined);
    const createWidget = vi.fn(() => ({
      l2d: { internal: true },
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
      model: { path: "https://assets.example.com/models/kagura/model3.json" },
    });
    expect(Object.keys(runtime).sort()).toEqual(["destroy", "sleep"]);

    runtime.sleep();
    await runtime.destroy();
    expect(sleep).toHaveBeenCalledOnce();
    expect(destroy).toHaveBeenCalledOnce();
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
