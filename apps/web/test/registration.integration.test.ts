import { randomUUID } from "node:crypto";

import { createDatabaseClient, type DatabaseClient } from "@kagura/database/client";
import { runMigrations } from "@kagura/database/migrate";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createRegistrationRepository } from "../src/features/registration/server/registration-repository";

const databaseUrl = process.env.TEST_DATABASE_URL;
let database: DatabaseClient | undefined;

function getDatabase(): DatabaseClient {
  if (!database) throw new Error("database client was not initialized");
  return database;
}

describe("registration transaction", () => {
  const suffix = randomUUID().replaceAll("-", "").slice(0, 12);
  const username = `reg_${suffix}`;

  beforeAll(async () => {
    if (!databaseUrl)
      throw new Error("TEST_DATABASE_URL is required for registration integration tests");
    await runMigrations({ databaseUrl });
    database = createDatabaseClient(databaseUrl);
  });

  afterAll(async () => {
    if (!database) return;
    await database.client`delete from users where normalized_username = ${username}`;
    await database.close();
  });

  it("creates a USER credential and digest-only session atomically", async () => {
    const repository = createRegistrationRepository(getDatabase());
    const createdAt = new Date("2026-07-14T08:00:00.000Z");
    const expiresAt = new Date("2026-07-15T08:00:00.000Z");

    await expect(
      repository.createUserCredentialSession({
        username,
        normalizedUsername: username,
        displayName: "Registered Reader",
        passwordHash: "argon2id-test-hash",
        sessionDigest: "a".repeat(64),
        createdAt,
        expiresAt,
      }),
    ).resolves.toBe("CREATED");

    const [saved] = await getDatabase().client<
      { role: string; status: string; password_hash: string; token_digest: string }[]
    >`
      select u.role, u.status, c.password_hash, s.token_digest
      from users u
      join credentials c on c.user_id = u.id
      join sessions s on s.user_id = u.id
      where u.normalized_username = ${username}
    `;
    expect(saved).toEqual({
      role: "USER",
      status: "ACTIVE",
      password_hash: "argon2id-test-hash",
      token_digest: "a".repeat(64),
    });
  });

  it("returns a conflict without creating another session", async () => {
    const repository = createRegistrationRepository(getDatabase());
    await expect(
      repository.createUserCredentialSession({
        username,
        normalizedUsername: username,
        displayName: "Duplicate Reader",
        passwordHash: "another-hash",
        sessionDigest: "b".repeat(64),
        createdAt: new Date("2026-07-14T09:00:00.000Z"),
        expiresAt: new Date("2026-07-15T09:00:00.000Z"),
      }),
    ).resolves.toBe("USERNAME_TAKEN");

    const [count] = await getDatabase().client<{ count: number }[]>`
      select count(*)::int as count
      from sessions s
      join users u on u.id = s.user_id
      where u.normalized_username = ${username}
    `;
    expect(count?.count).toBe(1);
  });
});
