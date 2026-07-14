import { beforeEach, describe, expect, it, vi } from "vitest";

import type { RegistrationResult } from "../server/registration-service";
import { registerAction } from "./register-action";
import type { RegisterActionState } from "./register-action-state";

const mocks = vi.hoisted(() => ({
  register: vi.fn<
    (
      input: Readonly<{
        username: string;
        displayName: string;
        password: string;
        challengeToken: string;
        clientAddress: string;
      }>,
    ) => Promise<RegistrationResult>
  >(),
  setSessionCookie: vi.fn(),
  redirect: vi.fn((destination: string): never => {
    throw new Error(`NEXT_REDIRECT:${destination}`);
  }),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({ get: vi.fn(), set: vi.fn() })),
  headers: vi.fn(async () => new Headers({ "x-forwarded-for": "198.51.100.8, 10.0.0.4" })),
}));

vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));

vi.mock("@kagula/auth/password", () => ({
  hashPassword: vi.fn(async () => "argon2id-password-hash"),
}));

vi.mock("@kagula/auth/session-token", () => ({
  issueSessionToken: vi.fn(() => ({ token: "raw-token", digest: "d".repeat(64) })),
}));

vi.mock("../../../server/config/env", () => ({
  getServerEnv: vi.fn(() => ({
    APP_URL: "https://blog.example.com",
    DATABASE_URL: "postgres://test.invalid/kagura",
    REDIS_URL: "redis://test.invalid",
    SESSION_COOKIE_NAME: "kagura_session",
    SESSION_SECRET: "test_session_secret_that_is_at_least_32_chars",
    SESSION_TTL_HOURS: 24,
    TURNSTILE_SECRET_KEY: "turnstile-test-secret",
  })),
}));

vi.mock("../../../server/database/get-database", () => ({
  getDatabase: vi.fn(() => ({ kind: "database" })),
}));

vi.mock("../../../server/auth/session-cookie", () => ({
  setSessionCookie: mocks.setSessionCookie,
}));

vi.mock("../../../server/security/turnstile", () => ({
  verifyTurnstile: vi.fn(async () => true),
}));

vi.mock("../server/registration-repository", () => ({
  createRegistrationRepository: vi.fn(() => ({
    createUserCredentialSession: vi.fn(),
  })),
}));

vi.mock("../server/registration-rate-limiter", () => ({
  createRegistrationRateLimiter: vi.fn(() => ({
    consumeRegistrationBudget: vi.fn(),
  })),
}));

vi.mock("../server/registration-service", async (importOriginal) => {
  const original = await importOriginal<typeof import("../server/registration-service")>();
  return { ...original, createRegistrationService: vi.fn(() => mocks.register) };
});

const initialState: RegisterActionState = { status: "IDLE" };

function createRegisterForm(overrides: Readonly<Record<string, string>> = {}): FormData {
  const formData = new FormData();
  formData.set("username", "Kagura_Reader");
  formData.set("displayName", "星图读者");
  formData.set("password", "correct horse battery staple");
  formData.set("passwordConfirmation", "correct horse battery staple");
  formData.set("cf-turnstile-response", "turnstile-response");
  for (const [name, value] of Object.entries(overrides)) formData.set(name, value);
  return formData;
}

describe("registerAction", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns field errors before invoking the registration service", async () => {
    await expect(
      registerAction(initialState, createRegisterForm({ username: "" })),
    ).resolves.toMatchObject({
      status: "ERROR",
      fieldErrors: { username: ["请输入 3–32 位小写字母、数字或下划线用户名"] },
    });
    expect(mocks.register).not.toHaveBeenCalled();
  });

  it.each([
    [{ status: "USERNAME_TAKEN" }, "该用户名已被使用"],
    [{ status: "CHALLENGE_FAILED" }, "人机验证未通过，请重试"],
    [{ status: "INVALID_INPUT" }, "注册信息无效，请检查后重试"],
  ] satisfies ReadonlyArray<readonly [RegistrationResult, string]>)(
    "maps %s to a safe page message",
    async (result, message) => {
      mocks.register.mockResolvedValue(result);
      await expect(registerAction(initialState, createRegisterForm())).resolves.toEqual({
        status: "ERROR",
        message,
      });
    },
  );

  it("returns the remaining registration rate-limit window", async () => {
    mocks.register.mockResolvedValue({ status: "RATE_LIMITED", retryAfterSeconds: 61 });
    await expect(registerAction(initialState, createRegisterForm())).resolves.toEqual({
      status: "ERROR",
      message: "注册尝试过于频繁，请在 2 分钟后重试",
    });
  });

  it("sets a secure session cookie and redirects to a safe next path", async () => {
    const expiresAt = new Date("2026-07-15T10:00:00.000Z");
    mocks.register.mockResolvedValue({
      status: "SUCCESS",
      token: "opaque-session-token",
      expiresAt,
    });

    await expect(
      registerAction(initialState, createRegisterForm({ next: "/articles/welcome#comments" })),
    ).rejects.toThrow("NEXT_REDIRECT:/articles/welcome#comments");
    expect(mocks.register).toHaveBeenCalledWith({
      username: "Kagura_Reader",
      displayName: "星图读者",
      password: "correct horse battery staple",
      challengeToken: "turnstile-response",
      clientAddress: "198.51.100.8",
    });
    expect(mocks.setSessionCookie).toHaveBeenCalledWith(expect.anything(), {
      name: "kagura_session",
      token: "opaque-session-token",
      expiresAt,
      secure: true,
    });
  });

  it("redirects an unsafe destination to the account page", async () => {
    mocks.register.mockResolvedValue({
      status: "SUCCESS",
      token: "opaque-session-token",
      expiresAt: new Date("2026-07-15T10:00:00.000Z"),
    });

    await expect(
      registerAction(initialState, createRegisterForm({ next: "https://attacker.example/path" })),
    ).rejects.toThrow("NEXT_REDIRECT:/account");
  });
});
