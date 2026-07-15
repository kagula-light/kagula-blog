import { describe, expect, it } from "vitest";

import { parseWorkerEnv } from "./env";

function createEnvironment(overrides: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
  return {
    NODE_ENV: "test",
    APP_URL: "http://localhost:3000",
    APP_TIMEZONE: "Asia/Shanghai",
    APP_RELEASE: "test",
    LOG_LEVEL: "info",
    DATABASE_URL: "postgresql://kagura:test@localhost:55432/kagura_blog_test",
    REDIS_URL: "redis://localhost:56379/1",
    WORKER_HEALTH_PORT: "3001",
    HOTSPOT_COLLECTION_ENABLED: "false",
    ...overrides,
  };
}

describe("parseWorkerEnv", () => {
  it("parses an explicitly enabled hotspot collector", () => {
    expect(
      parseWorkerEnv(createEnvironment({ HOTSPOT_COLLECTION_ENABLED: "true" }))
        .HOTSPOT_COLLECTION_ENABLED,
    ).toBe(true);
  });

  it("parses an explicitly disabled hotspot collector", () => {
    expect(parseWorkerEnv(createEnvironment()).HOTSPOT_COLLECTION_ENABLED).toBe(false);
  });

  it("defaults collection off outside production and on in production", () => {
    expect(
      parseWorkerEnv(createEnvironment({ HOTSPOT_COLLECTION_ENABLED: undefined }))
        .HOTSPOT_COLLECTION_ENABLED,
    ).toBe(false);
    expect(
      parseWorkerEnv(
        createEnvironment({
          NODE_ENV: "production",
          APP_URL: "https://blog.example.com",
          HOTSPOT_COLLECTION_ENABLED: undefined,
        }),
      ).HOTSPOT_COLLECTION_ENABLED,
    ).toBe(true);
  });

  it("rejects an ambiguous hotspot collection flag", () => {
    expect(() => parseWorkerEnv(createEnvironment({ HOTSPOT_COLLECTION_ENABLED: "1" }))).toThrow(
      "HOTSPOT_COLLECTION_ENABLED",
    );
  });
});
