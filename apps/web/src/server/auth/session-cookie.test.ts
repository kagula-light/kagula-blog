import { describe, expect, it, vi } from "vitest";

import {
  clearSessionCookie,
  readSessionCookie,
  setSessionCookie,
  type SessionCookieStore,
} from "./session-cookie";

function createCookieStore(initialValue?: string): SessionCookieStore {
  return {
    get: vi.fn(() => (initialValue ? { value: initialValue } : undefined)),
    set: vi.fn(),
  };
}

describe("session cookie boundary", () => {
  it("sets an opaque HttpOnly SameSite cookie with explicit expiry", () => {
    const store = createCookieStore();
    const expiresAt = new Date("2026-07-14T10:00:00.000Z");

    setSessionCookie(store, {
      name: "kagura_session",
      token: "opaque-token",
      expiresAt,
      secure: true,
    });

    expect(store.set).toHaveBeenCalledWith("kagura_session", "opaque-token", {
      httpOnly: true,
      sameSite: "lax",
      secure: true,
      path: "/",
      expires: expiresAt,
    });
  });

  it("reads and clears the configured cookie idempotently", () => {
    const store = createCookieStore("opaque-token");

    expect(readSessionCookie(store, "kagura_session")).toBe("opaque-token");
    clearSessionCookie(store, { name: "kagura_session", secure: false });
    expect(store.set).toHaveBeenCalledWith("kagura_session", "", {
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      path: "/",
      expires: new Date(0),
    });
  });
});
