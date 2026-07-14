import { describe, expect, it, vi } from "vitest";

import {
  createRegistrationRateLimitKey,
  createRegistrationService,
  type RegistrationServiceDependencies,
} from "./registration-service";

const now = new Date("2026-07-14T08:00:00.000Z");

function dependencies(
  overrides: Partial<RegistrationServiceDependencies> = {},
): RegistrationServiceDependencies {
  return {
    verifyChallenge: vi.fn(async () => true),
    consumeRegistrationBudget: vi.fn(async () => ({ allowed: true, retryAfterSeconds: 0 })),
    hashPassword: vi.fn(async () => "argon2id-password-hash"),
    issueToken: vi.fn(() => ({ token: "raw-session-token", digest: "d".repeat(64) })),
    createUserCredentialSession: vi.fn(
      async (): Promise<"CREATED" | "USERNAME_TAKEN"> => "CREATED",
    ),
    sessionTtlHours: 24,
    clock: () => now,
    ...overrides,
  };
}

const validInput = {
  username: "Kagura_Reader",
  displayName: "星图读者",
  password: "correct horse battery staple",
  challengeToken: "turnstile-response",
  clientAddress: "203.0.113.19",
} as const;

describe("registration service", () => {
  it("uses a digest-only client registration key", () => {
    const key = createRegistrationRateLimitKey(validInput.clientAddress);
    expect(key).toMatch(/^registration:[a-f0-9]{64}$/);
    expect(key).not.toContain(validInput.clientAddress);
  });

  it("stops before challenge verification when the budget is exhausted", async () => {
    const ports = dependencies({
      consumeRegistrationBudget: vi.fn(async () => ({
        allowed: false,
        retryAfterSeconds: 900,
      })),
    });
    const register = createRegistrationService(ports);

    await expect(register(validInput)).resolves.toEqual({
      status: "RATE_LIMITED",
      retryAfterSeconds: 900,
    });
    expect(ports.verifyChallenge).not.toHaveBeenCalled();
  });

  it("rejects a failed challenge before password work", async () => {
    const ports = dependencies({ verifyChallenge: vi.fn(async () => false) });
    const register = createRegistrationService(ports);

    await expect(register(validInput)).resolves.toEqual({ status: "CHALLENGE_FAILED" });
    expect(ports.hashPassword).not.toHaveBeenCalled();
    expect(ports.createUserCredentialSession).not.toHaveBeenCalled();
  });

  it("normalizes the username and creates a USER credential session atomically", async () => {
    const ports = dependencies();
    const register = createRegistrationService(ports);

    await expect(register(validInput)).resolves.toEqual({
      status: "SUCCESS",
      token: "raw-session-token",
      expiresAt: new Date("2026-07-15T08:00:00.000Z"),
    });
    expect(ports.hashPassword).toHaveBeenCalledWith(validInput.password);
    expect(ports.createUserCredentialSession).toHaveBeenCalledWith({
      username: "kagura_reader",
      normalizedUsername: "kagura_reader",
      displayName: validInput.displayName,
      passwordHash: "argon2id-password-hash",
      sessionDigest: "d".repeat(64),
      createdAt: now,
      expiresAt: new Date("2026-07-15T08:00:00.000Z"),
    });
  });

  it("returns a stable result when the normalized username already exists", async () => {
    const ports = dependencies({
      createUserCredentialSession: vi.fn(
        async (): Promise<"CREATED" | "USERNAME_TAKEN"> => "USERNAME_TAKEN",
      ),
    });
    const register = createRegistrationService(ports);

    await expect(register(validInput)).resolves.toEqual({ status: "USERNAME_TAKEN" });
  });

  it("returns invalid input without invoking infrastructure for a malformed username", async () => {
    const ports = dependencies();
    const register = createRegistrationService(ports);

    await expect(register({ ...validInput, username: "x" })).resolves.toEqual({
      status: "INVALID_INPUT",
    });
    expect(ports.verifyChallenge).not.toHaveBeenCalled();
    expect(ports.hashPassword).not.toHaveBeenCalled();
  });
});
