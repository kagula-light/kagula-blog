import { describe, expect, it } from "vitest";

import { getServerEnv } from "./env";

const validEnv = {
  NODE_ENV: "test",
  APP_URL: "http://localhost:3000",
  APP_TIMEZONE: "Asia/Shanghai",
  APP_RELEASE: "test",
  LOG_LEVEL: "info",
  DATABASE_URL: "postgresql://kagura:test@localhost:55432/kagura_blog_test",
  REDIS_URL: "redis://localhost:56379/1",
  SESSION_SECRET: "test_session_secret_that_is_at_least_32_chars",
  SESSION_COOKIE_NAME: "kagura_session",
  SESSION_TTL_HOURS: "168",
} as const;

describe("getServerEnv", () => {
  it("parses Web session settings separately from the shared runtime env", () => {
    const parsed = getServerEnv(validEnv) as ReturnType<typeof getServerEnv> & {
      readonly SESSION_TTL_HOURS: number;
    };

    expect(parsed).toMatchObject({
      SESSION_SECRET: validEnv.SESSION_SECRET,
      SESSION_COOKIE_NAME: "kagura_session",
      SESSION_TTL_HOURS: 168,
    });
  });

  it("rejects a short session secret without including its value", () => {
    const shortSecret = "too-short";

    expect(() => getServerEnv({ ...validEnv, SESSION_SECRET: shortSecret })).toThrow(
      /SESSION_SECRET/,
    );
    expect(() => getServerEnv({ ...validEnv, SESSION_SECRET: shortSecret })).not.toThrow(
      shortSecret,
    );
  });

  it.each(["invalid cookie", "invalid;cookie", ""])(
    "rejects invalid cookie name %j",
    (SESSION_COOKIE_NAME) => {
      expect(() => getServerEnv({ ...validEnv, SESSION_COOKIE_NAME })).toThrow(
        /SESSION_COOKIE_NAME/,
      );
    },
  );

  it.each(["0", "721", "not-a-number"])("rejects invalid session TTL %j", (SESSION_TTL_HOURS) => {
    expect(() => getServerEnv({ ...validEnv, SESSION_TTL_HOURS })).toThrow(/SESSION_TTL_HOURS/);
  });
});
