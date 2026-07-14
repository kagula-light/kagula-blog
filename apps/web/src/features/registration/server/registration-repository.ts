import type { DatabaseClient } from "@kagura/database/client";
import { credentials, sessions, users } from "@kagura/database/schema";

import type { RegistrationCreation } from "./registration-service";

export interface RegistrationRepository {
  readonly createUserCredentialSession: (
    creation: RegistrationCreation,
  ) => Promise<"CREATED" | "USERNAME_TAKEN">;
}

export function createRegistrationRepository(database: DatabaseClient): RegistrationRepository {
  return {
    createUserCredentialSession: (creation) =>
      database.db.transaction(async (transaction) => {
        const [user] = await transaction
          .insert(users)
          .values({
            username: creation.username,
            normalizedUsername: creation.normalizedUsername,
            displayName: creation.displayName,
            role: "USER",
            status: "ACTIVE",
            lastLoginAt: creation.createdAt,
            createdAt: creation.createdAt,
            updatedAt: creation.createdAt,
          })
          .onConflictDoNothing({ target: users.normalizedUsername })
          .returning({ id: users.id });
        if (!user) return "USERNAME_TAKEN";

        await transaction.insert(credentials).values({
          userId: user.id,
          passwordHash: creation.passwordHash,
          passwordUpdatedAt: creation.createdAt,
        });
        await transaction.insert(sessions).values({
          userId: user.id,
          tokenDigest: creation.sessionDigest,
          createdAt: creation.createdAt,
          lastActivityAt: creation.createdAt,
          expiresAt: creation.expiresAt,
        });
        return "CREATED";
      }),
  };
}
