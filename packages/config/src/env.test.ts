import { describe, expect, it } from "vitest";

import { parseRuntimeEnv } from "./env";

const validEnv = {
  NODE_ENV: "development",
  APP_URL: "http://localhost:3000",
  APP_TIMEZONE: "Asia/Shanghai",
  APP_RELEASE: "release",
  LOG_LEVEL: "info",
  DATABASE_URL: "postgresql://kagura:local-only@localhost:55432/kagura_blog",
  REDIS_URL: "redis://:local-only@localhost:56379/0",
} as const;

describe("parseRuntimeEnv", () => {
  it("returns a typed environment for valid input", () => {
    expect(parseRuntimeEnv(validEnv).APP_TIMEZONE).toBe("Asia/Shanghai");
  });

  it("rejects insecure production app URLs", () => {
    expect(() =>
      parseRuntimeEnv({ ...validEnv, NODE_ENV: "production", APP_URL: "http://example.com" }),
    ).toThrow(/APP_URL/);
  });

  it("reports invalid variable names without leaking values", () => {
    const secret = "do-not-print-this-value";

    expect(() => parseRuntimeEnv({ ...validEnv, DATABASE_URL: secret })).toThrow(/DATABASE_URL/);
    expect(() => parseRuntimeEnv({ ...validEnv, DATABASE_URL: secret })).not.toThrow(secret);
  });
});
