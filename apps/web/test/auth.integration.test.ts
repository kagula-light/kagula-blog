import { randomUUID } from "node:crypto";

import { digestSessionToken } from "@kagura/auth/session-token";
import { createDatabaseClient, type DatabaseClient } from "@kagura/database/client";
import { runMigrations } from "@kagura/database/migrate";
import { users } from "@kagura/database/schema";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createAuthRepository } from "../src/server/auth/auth-repository";
import { createLoginFailureLimiter } from "../src/server/auth/login-rate-limiter";
import { resolveCurrentSession } from "../src/server/auth/get-current-session";
import { canAccessAdmin } from "../src/server/permissions/policy";

const databaseUrl = process.env.TEST_DATABASE_URL;
const redisUrl = process.env.TEST_REDIS_URL;
const sessionSecret = "integration_session_secret_that_is_at_least_32_chars";
let database: DatabaseClient | undefined;

describe("authentication infrastructure", () => {
  beforeAll(async () => {
    if (!databaseUrl) throw new Error("TEST_DATABASE_URL is required for auth integration tests");
    if (!redisUrl) throw new Error("TEST_REDIS_URL is required for auth integration tests");
    await runMigrations({ databaseUrl });
    database = createDatabaseClient(databaseUrl);
  });

  afterAll(async () => {
    await database?.close();
  });

  it.each([
    ["ADMIN", true],
    ["USER", false],
  ] as const)("resolves an active %s session with server authorization", async (role, isAdmin) => {
    if (!database) throw new Error("database was not initialized");
    const suffix = randomUUID().replaceAll("-", "").slice(0, 12);
    const repository = createAuthRepository(database);
    const [user] = await database.db
      .insert(users)
      .values({
        username: `auth_${suffix}`,
        normalizedUsername: `auth_${suffix}`,
        displayName: "Auth Integration",
        role,
      })
      .returning({ id: users.id });
    if (!user) throw new Error("integration user was not created");

    const token = `integration-token-${suffix}`;
    const digest = digestSessionToken(token, sessionSecret);
    const now = new Date();
    try {
      await repository.createSession({
        userId: user.id,
        digest,
        createdAt: now,
        expiresAt: new Date(now.getTime() + 60_000),
      });
      const identity = await resolveCurrentSession({
        token,
        sessionSecret,
        now,
        findSessionIdentity: repository.findSessionIdentity,
      });
      expect(identity?.id).toBe(user.id);
      expect(canAccessAdmin(identity)).toBe(isAdmin);

      await repository.revokeSession(digest, now);
      await expect(
        resolveCurrentSession({
          token,
          sessionSecret,
          now,
          findSessionIdentity: repository.findSessionIdentity,
        }),
      ).resolves.toBeNull();
    } finally {
      await database.db.delete(users).where(eq(users.id, user.id));
    }
  });

  it("invalidates an unrevoked session when the user becomes banned", async () => {
    if (!database) throw new Error("database was not initialized");
    const suffix = randomUUID().replaceAll("-", "").slice(0, 12);
    const repository = createAuthRepository(database);
    const [user] = await database.db
      .insert(users)
      .values({
        username: `banned_${suffix}`,
        normalizedUsername: `banned_${suffix}`,
        displayName: "Banned Integration",
        role: "ADMIN",
      })
      .returning({ id: users.id });
    if (!user) throw new Error("integration user was not created");

    const token = `banned-token-${suffix}`;
    const digest = digestSessionToken(token, sessionSecret);
    const now = new Date();
    try {
      await repository.createSession({
        userId: user.id,
        digest,
        createdAt: now,
        expiresAt: new Date(now.getTime() + 60_000),
      });
      await database.db.update(users).set({ status: "BANNED" }).where(eq(users.id, user.id));
      await expect(
        resolveCurrentSession({
          token,
          sessionSecret,
          now,
          findSessionIdentity: repository.findSessionIdentity,
        }),
      ).resolves.toBeNull();
    } finally {
      await database.db.delete(users).where(eq(users.id, user.id));
    }
  });

  it("enforces and clears the Redis login failure budget", async () => {
    if (!redisUrl) throw new Error("TEST_REDIS_URL is required for auth integration tests");
    const limiter = createLoginFailureLimiter(redisUrl);
    const key = `login:integration:${randomUUID()}`;

    await limiter.clearFailures(key);
    for (let attempt = 0; attempt < 5; attempt += 1) await limiter.recordFailure(key);
    await expect(limiter.consumeFailureBudget(key)).resolves.toMatchObject({ allowed: false });
    await limiter.clearFailures(key);
    await expect(limiter.consumeFailureBudget(key)).resolves.toEqual({
      allowed: true,
      retryAfterSeconds: 0,
    });
  });
});
