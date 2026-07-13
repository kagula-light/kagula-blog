import type { DatabaseClient } from "@kagura/database/client";
import { credentials, sessions, users } from "@kagura/database/schema";
import { and, eq, gt, isNull } from "drizzle-orm";

import type { LoginIdentity, SessionCreation } from "../../features/auth/server/auth-service";
import type { SessionIdentity } from "./get-current-session";

export interface AuthRepository {
  readonly findLoginIdentity: (normalizedUsername: string) => Promise<LoginIdentity | null>;
  readonly createSession: (session: SessionCreation) => Promise<void>;
  readonly findSessionIdentity: (digest: string, now: Date) => Promise<SessionIdentity | null>;
  readonly revokeSession: (digest: string, revokedAt: Date) => Promise<void>;
}

export function createAuthRepository(database: DatabaseClient): AuthRepository {
  return {
    findLoginIdentity: async (normalizedUsername) => {
      const [identity] = await database.db
        .select({
          id: users.id,
          role: users.role,
          status: users.status,
          passwordHash: credentials.passwordHash,
        })
        .from(users)
        .innerJoin(credentials, eq(credentials.userId, users.id))
        .where(eq(users.normalizedUsername, normalizedUsername))
        .limit(1);
      return identity ?? null;
    },

    createSession: async ({ userId, digest, createdAt, expiresAt }) => {
      await database.db.transaction(async (transaction) => {
        await transaction.insert(sessions).values({
          userId,
          tokenDigest: digest,
          createdAt,
          lastActivityAt: createdAt,
          expiresAt,
        });
        await transaction
          .update(users)
          .set({ lastLoginAt: createdAt, updatedAt: createdAt })
          .where(eq(users.id, userId));
      });
    },

    findSessionIdentity: async (digest, now) => {
      const [identity] = await database.db
        .select({
          sessionId: sessions.id,
          id: users.id,
          username: users.username,
          displayName: users.displayName,
          role: users.role,
          status: users.status,
        })
        .from(sessions)
        .innerJoin(users, eq(users.id, sessions.userId))
        .where(
          and(
            eq(sessions.tokenDigest, digest),
            isNull(sessions.revokedAt),
            gt(sessions.expiresAt, now),
          ),
        )
        .limit(1);
      return identity ?? null;
    },

    revokeSession: async (digest, revokedAt) => {
      await database.db
        .update(sessions)
        .set({ revokedAt })
        .where(and(eq(sessions.tokenDigest, digest), isNull(sessions.revokedAt)));
    },
  };
}
