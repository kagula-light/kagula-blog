import type { DatabaseClient } from "@kagura/database/client";
import { favorites, postLikes, posts, users } from "@kagura/database/schema";
import { and, count, eq } from "drizzle-orm";

import type { ReactionMutation, ReactionResult } from "./reaction-service";

export interface ReactionSummary {
  readonly likeCount: number;
  readonly favoriteCount: number;
  readonly liked: boolean;
  readonly favorited: boolean;
}

type RepositoryReactionResult = Exclude<ReactionResult, { status: "UNAUTHENTICATED" }>;

export interface ReactionRepository {
  readonly mutateReaction: (input: ReactionMutation) => Promise<RepositoryReactionResult>;
  readonly getSummary: (postId: string, userId: string | null) => Promise<ReactionSummary>;
}

export function createReactionRepository(database: DatabaseClient): ReactionRepository {
  async function getSummary(postId: string, userId: string | null): Promise<ReactionSummary> {
    const [likeRows, favoriteRows, likedRows, favoritedRows] = await Promise.all([
      database.db.select({ value: count() }).from(postLikes).where(eq(postLikes.postId, postId)),
      database.db.select({ value: count() }).from(favorites).where(eq(favorites.postId, postId)),
      userId
        ? database.db
            .select({ postId: postLikes.postId })
            .from(postLikes)
            .where(and(eq(postLikes.postId, postId), eq(postLikes.userId, userId)))
            .limit(1)
        : Promise.resolve([]),
      userId
        ? database.db
            .select({ postId: favorites.postId })
            .from(favorites)
            .where(and(eq(favorites.postId, postId), eq(favorites.userId, userId)))
            .limit(1)
        : Promise.resolve([]),
    ]);
    return {
      likeCount: Number(likeRows[0]?.value ?? 0),
      favoriteCount: Number(favoriteRows[0]?.value ?? 0),
      liked: likedRows.length > 0,
      favorited: favoritedRows.length > 0,
    };
  }

  return {
    mutateReaction: (input) =>
      database.db.transaction(async (transaction) => {
        const [state] = await transaction
          .select({
            userStatus: users.status,
            postStatus: posts.status,
            publishedAt: posts.publishedAt,
          })
          .from(users)
          .leftJoin(posts, eq(posts.id, input.postId))
          .where(eq(users.id, input.userId))
          .limit(1);
        if (!state || state.userStatus === "BANNED") return { status: "FORBIDDEN" };
        if (state.postStatus !== "PUBLISHED" || !state.publishedAt) {
          return { status: "POST_NOT_FOUND" };
        }

        if (input.kind === "LIKE") {
          if (input.active) {
            await transaction
              .insert(postLikes)
              .values({ postId: input.postId, userId: input.userId })
              .onConflictDoNothing();
          } else {
            await transaction
              .delete(postLikes)
              .where(and(eq(postLikes.postId, input.postId), eq(postLikes.userId, input.userId)));
          }
          const [row] = await transaction
            .select({ value: count() })
            .from(postLikes)
            .where(eq(postLikes.postId, input.postId));
          return {
            status: "SUCCESS",
            active: input.active,
            count: Number(row?.value ?? 0),
          };
        }

        if (input.active) {
          await transaction
            .insert(favorites)
            .values({ postId: input.postId, userId: input.userId })
            .onConflictDoNothing();
        } else {
          await transaction
            .delete(favorites)
            .where(and(eq(favorites.postId, input.postId), eq(favorites.userId, input.userId)));
        }
        const [row] = await transaction
          .select({ value: count() })
          .from(favorites)
          .where(eq(favorites.postId, input.postId));
        return {
          status: "SUCCESS",
          active: input.active,
          count: Number(row?.value ?? 0),
        };
      }),
    getSummary,
  };
}
