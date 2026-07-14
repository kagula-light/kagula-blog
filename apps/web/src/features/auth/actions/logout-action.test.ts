import { beforeEach, describe, expect, it, vi } from "vitest";

import { logoutAction } from "./logout-action";

const mocks = vi.hoisted(() => ({
  cookieValue: "opaque-session-token" as string | undefined,
  revokeSession: vi.fn(),
  clearSessionCookie: vi.fn(),
  digestSessionToken: vi.fn(() => "d".repeat(64)),
  redirect: vi.fn((destination: string): never => {
    throw new Error(`NEXT_REDIRECT:${destination}`);
  }),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: vi.fn(() => (mocks.cookieValue ? { value: mocks.cookieValue } : undefined)),
    set: vi.fn(),
  })),
}));

vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));

vi.mock("@kagura/auth/session-token", () => ({
  digestSessionToken: mocks.digestSessionToken,
}));

vi.mock("../../../server/config/env", () => ({
  getServerEnv: vi.fn(() => ({
    APP_URL: "https://blog.example.com",
    DATABASE_URL: "postgres://test.invalid/kagura",
    SESSION_COOKIE_NAME: "kagura_session",
    SESSION_SECRET: "test_session_secret_that_is_at_least_32_chars",
  })),
}));

vi.mock("../../../server/database/get-database", () => ({
  getDatabase: vi.fn(() => ({ kind: "database" })),
}));

vi.mock("../../../server/auth/auth-repository", () => ({
  createAuthRepository: vi.fn(() => ({ revokeSession: mocks.revokeSession })),
}));

vi.mock("../../../server/auth/session-cookie", () => ({
  readSessionCookie: vi.fn(
    (store: Readonly<{ get: (name: string) => { value: string } | undefined }>, name: string) =>
      store.get(name)?.value ?? null,
  ),
  clearSessionCookie: mocks.clearSessionCookie,
}));

describe("logoutAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.cookieValue = "opaque-session-token";
  });

  it("revokes only the presented session digest and clears the cookie", async () => {
    await expect(logoutAction()).rejects.toThrow("NEXT_REDIRECT:/login");

    expect(mocks.digestSessionToken).toHaveBeenCalledWith(
      "opaque-session-token",
      "test_session_secret_that_is_at_least_32_chars",
    );
    expect(mocks.revokeSession).toHaveBeenCalledWith("d".repeat(64), expect.any(Date));
    expect(mocks.clearSessionCookie).toHaveBeenCalledWith(expect.anything(), {
      name: "kagura_session",
      secure: true,
    });
  });

  it("still clears the cookie and redirects when no session is presented", async () => {
    mocks.cookieValue = undefined;

    await expect(logoutAction()).rejects.toThrow("NEXT_REDIRECT:/login");

    expect(mocks.digestSessionToken).not.toHaveBeenCalled();
    expect(mocks.revokeSession).not.toHaveBeenCalled();
    expect(mocks.clearSessionCookie).toHaveBeenCalledOnce();
  });
});
