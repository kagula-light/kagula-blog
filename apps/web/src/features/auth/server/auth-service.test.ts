import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createLoginRateLimitKey,
  createLoginService,
  type LoginIdentity,
  type LoginServiceDependencies,
} from "./auth-service";

const now = new Date("2026-07-13T10:00:00.000Z");
const activeAdmin: LoginIdentity = {
  id: "admin-id",
  role: "ADMIN",
  status: "ACTIVE",
  passwordHash: "stored-password-hash",
};

function createDependencies(
  overrides: Partial<LoginServiceDependencies> = {},
): LoginServiceDependencies {
  return {
    findLoginIdentity: vi.fn(async () => activeAdmin),
    verifyPassword: vi.fn(async (encodedHash, password) => {
      return encodedHash === activeAdmin.passwordHash && password === "correct password";
    }),
    dummyPasswordHash: "dummy-password-hash",
    issueToken: vi.fn(() => ({ token: "raw-session-token", digest: "d".repeat(64) })),
    createSession: vi.fn(async () => undefined),
    consumeFailureBudget: vi.fn(async () => ({ allowed: true, retryAfterSeconds: 0 })),
    recordFailure: vi.fn(async () => undefined),
    clearFailures: vi.fn(async () => undefined),
    sessionTtlHours: 24,
    clock: () => now,
    ...overrides,
  };
}

describe("login service", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("uses a digest-only rate limit key", () => {
    const key = createLoginRateLimitKey("203.0.113.9", "Kagura_Admin");

    expect(key).toMatch(/^login:[a-f0-9]{64}$/);
    expect(key).not.toContain("203.0.113.9");
    expect(key).not.toContain("kagura_admin");
  });

  it("performs dummy password work and returns a uniform result for an unknown user", async () => {
    const dependencies = createDependencies({ findLoginIdentity: vi.fn(async () => null) });
    const login = createLoginService(dependencies);

    await expect(
      login({ username: "missing_user", password: "candidate password", clientAddress: "ip" }),
    ).resolves.toEqual({ status: "INVALID_CREDENTIALS" });
    expect(dependencies.verifyPassword).toHaveBeenCalledWith(
      "dummy-password-hash",
      "candidate password",
    );
    expect(dependencies.createSession).not.toHaveBeenCalled();
    expect(dependencies.recordFailure).toHaveBeenCalledOnce();
  });

  it("returns the same result for a wrong password", async () => {
    const dependencies = createDependencies();
    const login = createLoginService(dependencies);

    await expect(
      login({ username: "kagura_admin", password: "wrong password", clientAddress: "ip" }),
    ).resolves.toEqual({ status: "INVALID_CREDENTIALS" });
    expect(dependencies.createSession).not.toHaveBeenCalled();
    expect(dependencies.recordFailure).toHaveBeenCalledOnce();
  });

  it("returns the uniform credential result for a banned identity", async () => {
    const dependencies = createDependencies({
      findLoginIdentity: vi.fn(async (): Promise<LoginIdentity> => ({
        ...activeAdmin,
        status: "BANNED",
      })),
      verifyPassword: vi.fn(async () => true),
    });
    const login = createLoginService(dependencies);

    await expect(
      login({ username: "kagura_admin", password: "correct password", clientAddress: "ip" }),
    ).resolves.toEqual({ status: "INVALID_CREDENTIALS" });
    expect(dependencies.createSession).not.toHaveBeenCalled();
  });

  it("stops before account lookup when the failure budget is exhausted", async () => {
    const dependencies = createDependencies({
      consumeFailureBudget: vi.fn(async () => ({ allowed: false, retryAfterSeconds: 321 })),
    });
    const login = createLoginService(dependencies);

    await expect(
      login({ username: "kagura_admin", password: "correct password", clientAddress: "ip" }),
    ).resolves.toEqual({ status: "RATE_LIMITED", retryAfterSeconds: 321 });
    expect(dependencies.findLoginIdentity).not.toHaveBeenCalled();
    expect(dependencies.verifyPassword).not.toHaveBeenCalled();
  });

  it.each(["ADMIN", "USER"] as const)("creates a session for a valid %s login", async (role) => {
    const dependencies = createDependencies({
      findLoginIdentity: vi.fn(async () => ({ ...activeAdmin, role })),
    });
    const login = createLoginService(dependencies);

    await expect(
      login({ username: "KAGURA_ADMIN", password: "correct password", clientAddress: "ip" }),
    ).resolves.toEqual({
      status: "SUCCESS",
      token: "raw-session-token",
      expiresAt: new Date("2026-07-14T10:00:00.000Z"),
      role,
    });
    expect(dependencies.createSession).toHaveBeenCalledWith({
      userId: "admin-id",
      digest: "d".repeat(64),
      createdAt: now,
      expiresAt: new Date("2026-07-14T10:00:00.000Z"),
    });
    expect(dependencies.clearFailures).toHaveBeenCalledOnce();
  });
});
