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
  R2_ENDPOINT: "http://localhost:59000",
  R2_REGION: "auto",
  R2_BUCKET: "kagura-assets",
  R2_PUBLIC_BASE_URL: "http://localhost:59000/kagura-assets",
  R2_ACCESS_KEY_ID: "test-access-key",
  R2_SECRET_ACCESS_KEY: "test-secret-access-key",
  R2_FORCE_PATH_STYLE: "true",
  MEDIA_MAX_BYTES: "10485760",
  MEDIA_MAX_DIMENSION: "8192",
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

  it("parses isolated R2 credentials and upload limits", () => {
    expect(getServerEnv(validEnv)).toMatchObject({
      R2_ENDPOINT: "http://localhost:59000",
      R2_REGION: "auto",
      R2_BUCKET: "kagura-assets",
      R2_PUBLIC_BASE_URL: "http://localhost:59000/kagura-assets",
      R2_ACCESS_KEY_ID: "test-access-key",
      R2_SECRET_ACCESS_KEY: "test-secret-access-key",
      R2_FORCE_PATH_STYLE: true,
      MEDIA_MAX_BYTES: 10_485_760,
      MEDIA_MAX_DIMENSION: 8_192,
    });
  });

  it("requires an R2 secret without including its value in an error", () => {
    const secret = "short";

    expect(() => getServerEnv({ ...validEnv, R2_SECRET_ACCESS_KEY: secret })).toThrow(
      /R2_SECRET_ACCESS_KEY/,
    );
    expect(() => getServerEnv({ ...validEnv, R2_SECRET_ACCESS_KEY: secret })).not.toThrow(secret);
  });

  it.each(["0", "104857601", "invalid"])(
    "rejects invalid media byte limit %j",
    (MEDIA_MAX_BYTES) => {
      expect(() => getServerEnv({ ...validEnv, MEDIA_MAX_BYTES })).toThrow(/MEDIA_MAX_BYTES/);
    },
  );

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
