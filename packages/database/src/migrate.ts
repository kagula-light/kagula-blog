import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const defaultMigrationsFolder = resolve(fileURLToPath(new URL("../drizzle", import.meta.url)));

export interface RunMigrationsOptions {
  readonly databaseUrl: string;
  readonly migrationsFolder?: string;
}

export async function runMigrations({
  databaseUrl,
  migrationsFolder = defaultMigrationsFolder,
}: RunMigrationsOptions): Promise<void> {
  const client = postgres(databaseUrl, { max: 1, connect_timeout: 5 });
  try {
    const db = drizzle(client);
    await migrate(db, { migrationsFolder });
  } finally {
    await client.end({ timeout: 5 });
  }
}
