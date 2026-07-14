import { beforeEach, describe, expect, it, vi } from "vitest";

import type { LoginResult } from "../server/auth-service";
import { loginAction } from "./login-action";
import type { LoginActionState } from "./login-action-state";

const mocks = vi.hoisted(() => ({
  login:
    vi.fn<
      (
        input: Readonly<{ username: string; password: string; clientAddress: string }>,
      ) => Promise<LoginResult>
    >(),
  setSessionCookie: vi.fn(),
  redirect: vi.fn((destination: string): never => {
    throw new Error(`NEXT_REDIRECT:${destination}`);
  }),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({ get: vi.fn(), set: vi.fn() })),
  headers: vi.fn(async () => new Headers({ "x-real-ip": "203.0.113.9" })),
}));

vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));

vi.mock("@kagura/auth/password", () => ({
  hashPassword: vi.fn(async () => "dummy-password-hash"),
  verifyPassword: vi.fn(async () => true),
}));

vi.mock("@kagura/auth/session-token", () => ({
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
  })),
}));

vi.mock("../../../server/database/get-database", () => ({
  getDatabase: vi.fn(() => ({ kind: "database" })),
}));

vi.mock("../../../server/auth/auth-repository", () => ({
  createAuthRepository: vi.fn(() => ({
    findLoginIdentity: vi.fn(),
    createSession: vi.fn(),
  })),
}));

vi.mock("../../../server/auth/login-rate-limiter", () => ({
  createLoginFailureLimiter: vi.fn(() => ({
    consumeFailureBudget: vi.fn(),
    recordFailure: vi.fn(),
    clearFailures: vi.fn(),
  })),
}));

vi.mock("../../../server/auth/session-cookie", () => ({
  setSessionCookie: mocks.setSessionCookie,
}));

vi.mock("../server/auth-service", async (importOriginal) => {
  const original = await importOriginal<typeof import("../server/auth-service")>();
  return { ...original, createLoginService: vi.fn(() => mocks.login) };
});

const initialState: LoginActionState = { status: "IDLE" };

function createLoginForm(overrides: Readonly<Record<string, string>> = {}): FormData {
  const formData = new FormData();
  formData.set("username", "Kagura_Admin");
  formData.set("password", "correct-horse-battery-staple");

  for (const [name, value] of Object.entries(overrides)) {
    formData.set(name, value);
  }

  return formData;
}

describe("loginAction", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns field errors before invoking the login service", async () => {
    await expect(loginAction(initialState, createLoginForm({ username: "" }))).resolves.toEqual({
      status: "ERROR",
      fieldErrors: { username: ["请输入有效的用户名"] },
    });
    expect(mocks.login).not.toHaveBeenCalled();
  });

  it("returns one page-level message for invalid credentials", async () => {
    mocks.login.mockResolvedValue({ status: "INVALID_CREDENTIALS" });

    await expect(loginAction(initialState, createLoginForm())).resolves.toEqual({
      status: "ERROR",
      message: "用户名或密码错误",
    });
  });

  it("returns a retry message when login is rate limited", async () => {
    mocks.login.mockResolvedValue({ status: "RATE_LIMITED", retryAfterSeconds: 125 });

    await expect(loginAction(initialState, createLoginForm())).resolves.toEqual({
      status: "ERROR",
      message: "登录尝试过于频繁，请在 3 分钟后重试",
    });
  });

  it("sets the session cookie and redirects an administrator to a safe next path", async () => {
    const expiresAt = new Date("2026-07-14T10:00:00.000Z");
    mocks.login.mockResolvedValue({
      status: "SUCCESS",
      role: "ADMIN",
      token: "opaque-session-token",
      expiresAt,
    });

    await expect(
      loginAction(initialState, createLoginForm({ next: "/admin?tab=users" })),
    ).rejects.toThrow("NEXT_REDIRECT:/admin?tab=users");
    expect(mocks.login).toHaveBeenCalledWith({
      username: "Kagura_Admin",
      password: "correct-horse-battery-staple",
      clientAddress: "203.0.113.9",
    });
    expect(mocks.setSessionCookie).toHaveBeenCalledWith(expect.anything(), {
      name: "kagura_session",
      token: "opaque-session-token",
      expiresAt,
      secure: true,
    });
  });

  it("redirects an authenticated user away from the administrator area", async () => {
    mocks.login.mockResolvedValue({
      status: "SUCCESS",
      role: "USER",
      token: "opaque-session-token",
      expiresAt: new Date("2026-07-14T10:00:00.000Z"),
    });

    await expect(loginAction(initialState, createLoginForm({ next: "/admin" }))).rejects.toThrow(
      "NEXT_REDIRECT:/",
    );
  });
});
