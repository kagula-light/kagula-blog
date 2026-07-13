import { describe, expect, it, vi } from "vitest";

import { digestSessionToken } from "@kagura/auth/session-token";

import { resolveCurrentSession, type SessionIdentity } from "./get-current-session";

const secret = "test_session_secret_that_is_at_least_32_chars";
const now = new Date("2026-07-13T10:00:00.000Z");
const activeAdmin: SessionIdentity = {
  sessionId: "session-id",
  id: "user-id",
  username: "kagura_admin",
  displayName: "神乐静无月",
  role: "ADMIN",
  status: "ACTIVE",
};

describe("resolveCurrentSession", () => {
  it("queries by HMAC digest and returns the current identity", async () => {
    const findSessionIdentity = vi.fn(async () => activeAdmin);

    await expect(
      resolveCurrentSession({
        token: "raw-token",
        sessionSecret: secret,
        now,
        findSessionIdentity,
      }),
    ).resolves.toEqual(activeAdmin);
    expect(findSessionIdentity).toHaveBeenCalledWith(
      digestSessionToken("raw-token", secret),
      now,
    );
  });

  it("returns null for a missing token or database session", async () => {
    const findSessionIdentity = vi.fn(async () => null);

    await expect(
      resolveCurrentSession({ token: null, sessionSecret: secret, now, findSessionIdentity }),
    ).resolves.toBeNull();
    await expect(
      resolveCurrentSession({
        token: "missing-token",
        sessionSecret: secret,
        now,
        findSessionIdentity,
      }),
    ).resolves.toBeNull();
  });

  it("invalidates an existing session when the current user is banned", async () => {
    const findSessionIdentity = vi.fn(async () => ({ ...activeAdmin, status: "BANNED" as const }));

    await expect(
      resolveCurrentSession({
        token: "raw-token",
        sessionSecret: secret,
        now,
        findSessionIdentity,
      }),
    ).resolves.toBeNull();
  });
});
