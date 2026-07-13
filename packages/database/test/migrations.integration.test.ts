import { afterAll, beforeAll, describe, expect, it } from "vitest";
import postgres from "postgres";

import { runMigrations } from "../src/migrate";

const databaseUrl = process.env.TEST_DATABASE_URL;
let client: ReturnType<typeof postgres> | undefined;

describe("database migrations", () => {
  beforeAll(async () => {
    if (!databaseUrl) {
      throw new Error("TEST_DATABASE_URL is required for database integration tests");
    }

    await runMigrations({ databaseUrl });
    await runMigrations({ databaseUrl });
    client = postgres(databaseUrl, { max: 1 });
  });

  afterAll(async () => {
    await client?.end({ timeout: 5 });
  });

  it("records one baseline migration and remains idempotent", async () => {
    if (!client) {
      throw new Error("database client was not initialized");
    }

    const rows = await client<{ hash: string }[]>`
      select hash
      from drizzle.__drizzle_migrations
      order by created_at
    `;

    expect(rows).toHaveLength(1);
    expect(rows[0]?.hash).toEqual(expect.any(String));
  });
});
