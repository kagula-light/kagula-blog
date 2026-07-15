import { describe, expect, it } from "vitest";

import { createMascotServerConfig } from "./mascot-config";

describe("createMascotServerConfig", () => {
  it("returns a disabled poster configuration without a model", () => {
    expect(
      createMascotServerConfig({
        enabled: false,
        publicAssetBaseUrl: "https://assets.example.com/blog",
        posterPath: "/brand/kagura-avatar.webp",
      }),
    ).toEqual({ enabled: false, modelUrl: null, posterPath: "/brand/kagura-avatar.webp" });
  });

  it("resolves an enabled model below the configured asset base", () => {
    expect(
      createMascotServerConfig({
        enabled: true,
        publicAssetBaseUrl: "https://assets.example.com/blog",
        modelPath: "models/kagura/model3.json",
        posterPath: "/brand/kagura-avatar.webp",
      }),
    ).toEqual({
      enabled: true,
      modelUrl: "https://assets.example.com/blog/models/kagura/model3.json",
      posterPath: "/brand/kagura-avatar.webp",
    });
  });

  it("keeps an enabled mascot in poster-only mode without a model", () => {
    expect(
      createMascotServerConfig({
        enabled: true,
        publicAssetBaseUrl: "https://assets.example.com/blog",
        posterPath: "/brand/kagura-avatar.webp",
      }),
    ).toEqual({ enabled: true, modelUrl: null, posterPath: "/brand/kagura-avatar.webp" });
  });

  it.each([
    "https://evil.example/model3.json",
    "//evil.example/model3.json",
    "/models/model3.json",
    "../models/model3.json",
    "models/../model3.json",
    "models\\model3.json",
    "",
  ])("rejects unsafe model path %j", (modelPath) => {
    expect(() =>
      createMascotServerConfig({
        enabled: true,
        publicAssetBaseUrl: "https://assets.example.com/blog",
        modelPath,
        posterPath: "/brand/kagura-avatar.webp",
      }),
    ).toThrow("mascot model path");
  });

  it.each([
    "brand/poster.webp",
    "//evil.example/poster.webp",
    "/../poster.webp",
    "/brand\\poster.webp",
  ])("rejects unsafe poster path %j", (posterPath) => {
    expect(() =>
      createMascotServerConfig({
        enabled: true,
        publicAssetBaseUrl: "https://assets.example.com/blog",
        posterPath,
      }),
    ).toThrow("mascot poster path");
  });
});
