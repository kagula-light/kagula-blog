import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

import { hashPassword } from "@kagura/auth/password";
import { normalizeUsername } from "@kagura/auth/username";
import { createDatabaseClient } from "@kagura/database/client";
import { auditLogs, credentials, users } from "@kagura/database/schema";
import { eq, sql } from "drizzle-orm";
import pino from "pino";

export interface AdminSeedState {
  readonly normalizedUsername: string;
  readonly existingAdmins: ReadonlyArray<Readonly<{ id: string; normalizedUsername: string }>>;
  readonly usernameOwner: Readonly<{ id: string; role: "ADMIN" | "USER" }> | null;
}

export type AdminSeedDecision =
  | { readonly action: "CREATE" }
  | { readonly action: "ROTATE_CREDENTIAL"; readonly userId: string }
  | {
      readonly action: "REFUSE";
      readonly reason: "ANOTHER_ADMIN_EXISTS" | "MULTIPLE_ADMINS_EXIST" | "USERNAME_OWNED_BY_USER";
    };

export function decideAdminSeed(state: AdminSeedState): AdminSeedDecision {
  if (state.existingAdmins.length > 1) {
    return { action: "REFUSE", reason: "MULTIPLE_ADMINS_EXIST" };
  }

  const [existingAdmin] = state.existingAdmins;
  if (existingAdmin) {
    if (
      existingAdmin.normalizedUsername === state.normalizedUsername &&
      state.usernameOwner?.id === existingAdmin.id &&
      state.usernameOwner.role === "ADMIN"
    ) {
      return { action: "ROTATE_CREDENTIAL", userId: existingAdmin.id };
    }
    return { action: "REFUSE", reason: "ANOTHER_ADMIN_EXISTS" };
  }

  if (state.usernameOwner) {
    return { action: "REFUSE", reason: "USERNAME_OWNED_BY_USER" };
  }

  return { action: "CREATE" };
}

interface AdminSeedEnv {
  readonly databaseUrl: string;
  readonly username: string;
  readonly normalizedUsername: string;
  readonly displayName: string;
  readonly password: string;
}

export function parseAdminSeedEnv(input: NodeJS.ProcessEnv): AdminSeedEnv {
  const required = ["DATABASE_URL", "ADMIN_USERNAME", "ADMIN_DISPLAY_NAME", "ADMIN_PASSWORD"];
  const missing = required.filter((name) => !input[name]);
  if (missing.length > 0) {
    throw new Error(`Missing administrator seed environment variables: ${missing.join(", ")}`);
  }

  const displayName = input.ADMIN_DISPLAY_NAME!.trim();
  if (displayName.length < 1 || displayName.length > 80) {
    throw new Error("Invalid administrator seed environment variables: ADMIN_DISPLAY_NAME");
  }

  const password = input.ADMIN_PASSWORD!;
  if (password.length < 12 || password.length > 256) {
    throw new Error("Invalid administrator seed environment variables: ADMIN_PASSWORD");
  }

  const username = input.ADMIN_USERNAME!;
  return {
    databaseUrl: input.DATABASE_URL!,
    username,
    normalizedUsername: normalizeUsername(username),
    displayName,
    password,
  };
}

export async function runAdminSeed(
  input: NodeJS.ProcessEnv = process.env,
): Promise<
  Readonly<{ action: "ADMIN_BOOTSTRAPPED" | "ADMIN_CREDENTIAL_ROTATED"; userId: string }>
> {
  const env = parseAdminSeedEnv(input);
  const passwordHash = await hashPassword(env.password);
  const database = createDatabaseClient(env.databaseUrl);

  try {
    return await database.db.transaction(async (transaction) => {
      await transaction.execute(sql`select pg_advisory_xact_lock(hashtext('kagura_admin_seed'))`);

      const existingAdmins = await transaction
        .select({ id: users.id, normalizedUsername: users.normalizedUsername })
        .from(users)
        .where(eq(users.role, "ADMIN"))
        .limit(2)
        .for("update");
      const [usernameOwner = null] = await transaction
        .select({ id: users.id, role: users.role })
        .from(users)
        .where(eq(users.normalizedUsername, env.normalizedUsername))
        .limit(1)
        .for("update");
      const decision = decideAdminSeed({
        normalizedUsername: env.normalizedUsername,
        existingAdmins,
        usernameOwner,
      });

      if (decision.action === "REFUSE") {
        throw new Error(`Administrator bootstrap refused: ${decision.reason}`);
      }

      const changedAt = new Date();
      if (decision.action === "CREATE") {
        const [created] = await transaction
          .insert(users)
          .values({
            username: env.username,
            normalizedUsername: env.normalizedUsername,
            displayName: env.displayName,
            role: "ADMIN",
            status: "ACTIVE",
          })
          .returning({ id: users.id });
        if (!created) throw new Error("Administrator bootstrap did not create a user");

        await transaction.insert(credentials).values({
          userId: created.id,
          passwordHash,
          passwordUpdatedAt: changedAt,
        });
        await transaction.insert(auditLogs).values({
          actorUserId: created.id,
          action: "ADMIN_BOOTSTRAPPED",
          resourceType: "USER",
          resourceId: created.id,
        });
        return { action: "ADMIN_BOOTSTRAPPED" as const, userId: created.id };
      }

      await transaction
        .update(users)
        .set({ displayName: env.displayName, status: "ACTIVE", updatedAt: changedAt })
        .where(eq(users.id, decision.userId));
      await transaction
        .insert(credentials)
        .values({
          userId: decision.userId,
          passwordHash,
          passwordUpdatedAt: changedAt,
        })
        .onConflictDoUpdate({
          target: credentials.userId,
          set: { passwordHash, passwordUpdatedAt: changedAt },
        });
      await transaction.insert(auditLogs).values({
        actorUserId: decision.userId,
        action: "ADMIN_CREDENTIAL_ROTATED",
        resourceType: "USER",
        resourceId: decision.userId,
      });
      return { action: "ADMIN_CREDENTIAL_ROTATED" as const, userId: decision.userId };
    });
  } finally {
    await database.close();
  }
}

const logger = pino({ base: { service: "worker-seed-admin" } });
const entryPath = process.argv[1] ? resolve(process.argv[1]) : null;
if (entryPath === fileURLToPath(import.meta.url)) {
  runAdminSeed()
    .then((result) => {
      logger.info(
        { action: result.action, userId: result.userId, release: process.env.APP_RELEASE ?? "dev" },
        "administrator bootstrap completed",
      );
      logger.flush();
    })
    .catch(() => {
      logger.error({ release: process.env.APP_RELEASE ?? "dev" }, "administrator bootstrap failed");
      logger.flush();
      process.exitCode = 1;
    });
}
