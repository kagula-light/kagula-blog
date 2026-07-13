import { createHash } from "node:crypto";

import { normalizeUsername } from "@kagura/auth/username";

import type { UserRole, UserStatus } from "../../../server/permissions/policy";

export interface LoginIdentity {
  readonly id: string;
  readonly role: UserRole;
  readonly status: UserStatus;
  readonly passwordHash: string;
}

export interface LoginInput {
  readonly username: string;
  readonly password: string;
  readonly clientAddress: string;
}

export interface SessionCreation {
  readonly userId: string;
  readonly digest: string;
  readonly createdAt: Date;
  readonly expiresAt: Date;
}

export interface LoginServiceDependencies {
  readonly findLoginIdentity: (normalizedUsername: string) => Promise<LoginIdentity | null>;
  readonly verifyPassword: (encodedHash: string, password: string) => Promise<boolean>;
  readonly dummyPasswordHash: string;
  readonly issueToken: () => Readonly<{ token: string; digest: string }>;
  readonly createSession: (session: SessionCreation) => Promise<void>;
  readonly consumeFailureBudget: (
    key: string,
  ) => Promise<Readonly<{ allowed: boolean; retryAfterSeconds: number }>>;
  readonly recordFailure: (key: string) => Promise<void>;
  readonly clearFailures: (key: string) => Promise<void>;
  readonly sessionTtlHours: number;
  readonly clock: () => Date;
}

export type LoginResult =
  | {
      readonly status: "SUCCESS";
      readonly token: string;
      readonly expiresAt: Date;
      readonly role: UserRole;
    }
  | { readonly status: "INVALID_CREDENTIALS" }
  | { readonly status: "RATE_LIMITED"; readonly retryAfterSeconds: number };

export function createLoginRateLimitKey(clientAddress: string, username: string): string {
  const normalizedCandidate = username.normalize("NFKC").trim().toLowerCase();
  const digest = createHash("sha256")
    .update(clientAddress, "utf8")
    .update("\0", "utf8")
    .update(normalizedCandidate, "utf8")
    .digest("hex");
  return `login:${digest}`;
}

export function createLoginService(
  dependencies: LoginServiceDependencies,
): (input: LoginInput) => Promise<LoginResult> {
  return async (input) => {
    const failureKey = createLoginRateLimitKey(input.clientAddress, input.username);
    const budget = await dependencies.consumeFailureBudget(failureKey);
    if (!budget.allowed) {
      return { status: "RATE_LIMITED", retryAfterSeconds: budget.retryAfterSeconds };
    }

    let normalizedUsername: string | null = null;
    try {
      normalizedUsername = normalizeUsername(input.username);
    } catch {
      normalizedUsername = null;
    }

    const identity = normalizedUsername
      ? await dependencies.findLoginIdentity(normalizedUsername)
      : null;
    const passwordHash = identity?.passwordHash ?? dependencies.dummyPasswordHash;
    const passwordMatches = await dependencies.verifyPassword(passwordHash, input.password);

    if (!identity || !passwordMatches || identity.status === "BANNED") {
      await dependencies.recordFailure(failureKey);
      return { status: "INVALID_CREDENTIALS" };
    }

    const createdAt = dependencies.clock();
    const expiresAt = new Date(
      createdAt.getTime() + dependencies.sessionTtlHours * 60 * 60 * 1_000,
    );
    const issued = dependencies.issueToken();
    await dependencies.createSession({
      userId: identity.id,
      digest: issued.digest,
      createdAt,
      expiresAt,
    });
    await dependencies.clearFailures(failureKey);

    return {
      status: "SUCCESS",
      token: issued.token,
      expiresAt,
      role: identity.role,
    };
  };
}
