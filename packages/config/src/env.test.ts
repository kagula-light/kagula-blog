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

  it("accepts a public HTTPS URL in production", () => {
    expect(
      parseRuntimeEnv({ ...validEnv, NODE_ENV: "production", APP_URL: "https://example.com" })
        .APP_URL,
    ).toBe("https://example.com");
  });

  it.each([
    "http://localhost:3000",
    "http://127.0.0.2:3000",
    "http://[::1]:3000",
    "http://[::ffff:127.0.0.1]:3000",
  ])("accepts the production HTTP loopback URL %s", (appUrl) => {
    expect(parseRuntimeEnv({ ...validEnv, NODE_ENV: "production", APP_URL: appUrl }).APP_URL).toBe(
      appUrl,
    );
  });

  it("rejects a public HTTP URL in production", () => {
    expect(() =>
      parseRuntimeEnv({ ...validEnv, NODE_ENV: "production", APP_URL: "http://example.com" }),
    ).toThrow(/APP_URL/);
  });

  it("aggregates missing variable names without including environment values", () => {
    const missingDatabaseAndRedis = {
      NODE_ENV: validEnv.NODE_ENV,
      APP_URL: validEnv.APP_URL,
      APP_TIMEZONE: validEnv.APP_TIMEZONE,
      APP_RELEASE: validEnv.APP_RELEASE,
      LOG_LEVEL: validEnv.LOG_LEVEL,
    };

    let thrown: unknown;
    try {
      parseRuntimeEnv(missingDatabaseAndRedis);
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(Error);
    expect((thrown as Error).message).toContain("DATABASE_URL");
    expect((thrown as Error).message).toContain("REDIS_URL");
    expect((thrown as Error).message).not.toContain(validEnv.APP_URL);
  });

  it.each(["APP_URL", "DATABASE_URL", "REDIS_URL"] as const)(
    "rejects a malformed %s",
    (variableName) => {
      expect(() => parseRuntimeEnv({ ...validEnv, [variableName]: "not-a-url" })).toThrow(
        variableName,
      );
    },
  );

  it.each([
    ["DATABASE_URL", "mysql://kagura:local-only@localhost:3306/kagura_blog"],
    ["REDIS_URL", "http://localhost:6379/0"],
  ] as const)("rejects an unsupported %s scheme", (variableName, url) => {
    expect(() => parseRuntimeEnv({ ...validEnv, [variableName]: url })).toThrow(variableName);
  });
});
