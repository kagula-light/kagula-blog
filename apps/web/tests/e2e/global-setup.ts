import { hashPassword } from "@kagura/auth/password";
import { createDatabaseClient } from "@kagura/database/client";
import { credentials, sessions, users } from "@kagura/database/schema";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { inArray } from "drizzle-orm";

import { e2eIdentities } from "./identities";

export default async function globalSetup(): Promise<void> {
  const databaseUrl = process.env.TEST_DATABASE_URL;
  if (!databaseUrl) throw new Error("TEST_DATABASE_URL is required for Playwright setup");

  const database = createDatabaseClient(databaseUrl);

  try {
    await migrate(database.db, { migrationsFolder: "../../packages/database/drizzle" });
    const seededUserIds: Array<string> = [];
    for (const identity of Object.values(e2eIdentities)) {
      const now = new Date();
      const [user] = await database.db
        .insert(users)
        .values({
          username: identity.username,
          normalizedUsername: identity.username,
          displayName: identity.displayName,
          role: identity.role,
          status: "ACTIVE",
        })
        .onConflictDoUpdate({
          target: users.normalizedUsername,
          set: {
            username: identity.username,
            displayName: identity.displayName,
            role: identity.role,
            status: "ACTIVE",
            updatedAt: now,
          },
        })
        .returning({ id: users.id });
      if (!user) throw new Error("Playwright identity was not created");

      const passwordHash = await hashPassword(identity.password);
      await database.db
        .insert(credentials)
        .values({ userId: user.id, passwordHash, passwordUpdatedAt: now })
        .onConflictDoUpdate({
          target: credentials.userId,
          set: { passwordHash, passwordUpdatedAt: now },
        });
      seededUserIds.push(user.id);
    }

    await database.db
      .update(sessions)
      .set({ revokedAt: new Date() })
      .where(inArray(sessions.userId, seededUserIds));
  } finally {
    await database.close();
  }
}
