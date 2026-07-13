import { resolve } from "node:path";

import { runMigrations } from "@kagura/database/migrate";
import pino from "pino";

interface MigrationEnv {
  readonly databaseUrl: string;
  readonly migrationsDir: string;
  readonly release: string;
}

function parseMigrationEnv(input: NodeJS.ProcessEnv): MigrationEnv {
  const missing = ["DATABASE_URL", "MIGRATIONS_DIR"].filter((name) => !input[name]);
  if (missing.length > 0) {
    throw new Error(`Missing migration environment variables: ${missing.join(", ")}`);
  }

  return {
    databaseUrl: input.DATABASE_URL!,
    migrationsDir: resolve(input.MIGRATIONS_DIR!),
    release: input.APP_RELEASE ?? "dev",
  };
}

const logger = pino({ base: { service: "worker-migrate" } });

async function migrateDatabase(): Promise<void> {
  const env = parseMigrationEnv(process.env);
  await runMigrations({ databaseUrl: env.databaseUrl, migrationsFolder: env.migrationsDir });
  logger.info({ release: env.release }, "database migrations completed");
  logger.flush();
}

migrateDatabase().catch(() => {
  logger.error({ release: process.env.APP_RELEASE ?? "dev" }, "database migrations failed");
  logger.flush();
  process.exitCode = 1;
});
