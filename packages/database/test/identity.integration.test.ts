import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import postgres from "postgres";

import { runMigrations } from "../src/migrate";

const databaseUrl = process.env.TEST_DATABASE_URL;
let client: ReturnType<typeof postgres> | undefined;

function getClient(): ReturnType<typeof postgres> {
  if (!client) throw new Error("database client was not initialized");
  return client;
}

describe("identity database constraints", () => {
  beforeAll(async () => {
    if (!databaseUrl) {
      throw new Error("TEST_DATABASE_URL is required for database integration tests");
    }

    await runMigrations({ databaseUrl });
    client = postgres(databaseUrl, { max: 1 });
  });

  afterAll(async () => {
    await client?.end({ timeout: 5 });
  });

  it("enforces normalized username uniqueness", async () => {
    const sql = getClient();
    const suffix = randomUUID().replaceAll("-", "").slice(0, 12);
    const normalizedUsername = `user_${suffix}`;
    const [user] = await sql<{ id: string }[]>`
      insert into users (username, normalized_username, display_name)
      values (${normalizedUsername}, ${normalizedUsername}, 'Identity Test')
      returning id
    `;

    try {
      await expect(
        sql`
          insert into users (username, normalized_username, display_name)
          values (${normalizedUsername.toUpperCase()}, ${normalizedUsername}, 'Duplicate Test')
        `,
      ).rejects.toThrow();
    } finally {
      if (user) await sql`delete from users where id = ${user.id}`;
    }
  });

  it("enforces session digest uniqueness and cascades identity-owned rows", async () => {
    const sql = getClient();
    const suffix = randomUUID().replaceAll("-", "").slice(0, 12);
    const [user] = await sql<{ id: string }[]>`
      insert into users (username, normalized_username, display_name, role)
      values (${`admin_${suffix}`}, ${`admin_${suffix}`}, 'Admin Test', 'ADMIN')
      returning id
    `;
    if (!user) throw new Error("test user was not created");

    const digest = "a".repeat(64);
    await sql`
      insert into credentials (user_id, password_hash)
      values (${user.id}, '$argon2id$test-only-hash')
    `;
    await sql`
      insert into sessions (user_id, token_digest, expires_at)
      values (${user.id}, ${digest}, now() + interval '1 hour')
    `;

    await expect(
      sql`
        insert into sessions (user_id, token_digest, expires_at)
        values (${user.id}, ${digest}, now() + interval '1 hour')
      `,
    ).rejects.toThrow();

    await sql`delete from users where id = ${user.id}`;
    const [ownedRows] = await sql<{ credential_count: number; session_count: number }[]>`
      select
        (select count(*)::int from credentials where user_id = ${user.id}) as credential_count,
        (select count(*)::int from sessions where user_id = ${user.id}) as session_count
    `;
    expect(ownedRows).toEqual({ credential_count: 0, session_count: 0 });
  });

  it("preserves audit history when an actor is deleted", async () => {
    const sql = getClient();
    const suffix = randomUUID().replaceAll("-", "").slice(0, 12);
    const [user] = await sql<{ id: string }[]>`
      insert into users (username, normalized_username, display_name, role)
      values (${`audit_${suffix}`}, ${`audit_${suffix}`}, 'Audit Test', 'ADMIN')
      returning id
    `;
    if (!user) throw new Error("test user was not created");

    const [audit] = await sql<{ id: string }[]>`
      insert into audit_logs (actor_user_id, action, resource_type, resource_id)
      values (${user.id}, 'TEST_ACTION', 'USER', ${user.id})
      returning id
    `;
    if (!audit) throw new Error("test audit row was not created");

    await sql`delete from users where id = ${user.id}`;
    const [persisted] = await sql<{ actor_user_id: string | null }[]>`
      select actor_user_id from audit_logs where id = ${audit.id}
    `;
    expect(persisted?.actor_user_id).toBeNull();

    await sql`delete from audit_logs where id = ${audit.id}`;
  });
});
