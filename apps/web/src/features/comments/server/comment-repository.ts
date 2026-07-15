import type { DatabaseClient } from "@kagura/database/client";
import { comments, posts, users } from "@kagura/database/schema";
import { and, asc, eq, isNull } from "drizzle-orm";

import type { PendingCommentCreation, PendingCommentCreationResult } from "./comment-service";

export interface ApprovedComment {
  readonly id: string;
  readonly body: string;
  readonly authorDisplayName: string;
  readonly createdAt: Date;
}

export interface CommentRepository {
  readonly createPendingComment: (
    input: PendingCommentCreation,
  ) => Promise<PendingCommentCreationResult>;
  readonly listApproved: (postId: string) => Promise<readonly ApprovedComment[]>;
}

export function createCommentRepository(database: DatabaseClient): CommentRepository {
  return {
    createPendingComment: (input) =>
      database.db.transaction(async (transaction) => {
        const [state] = await transaction
          .select({
            userStatus: users.status,
            postStatus: posts.status,
            publishedAt: posts.publishedAt,
          })
          .from(users)
          .leftJoin(posts, eq(posts.id, input.postId))
          .where(eq(users.id, input.authorUserId))
          .limit(1);
        if (!state || state.userStatus !== "ACTIVE") return { status: "FORBIDDEN" };
        if (state.postStatus !== "PUBLISHED" || !state.publishedAt) {
          return { status: "POST_NOT_FOUND" };
        }

        const [created] = await transaction
          .insert(comments)
          .values({
            postId: input.postId,
            authorUserId: input.authorUserId,
            body: input.body,
            status: "PENDING",
            createdAt: input.createdAt,
            updatedAt: input.createdAt,
          })
          .returning({ id: comments.id });
        if (!created) throw new Error("Pending comment insert returned no identifier");
        return { status: "CREATED", id: created.id };
      }),
    listApproved: (postId) =>
      database.db
        .select({
          id: comments.id,
          body: comments.body,
          authorDisplayName: users.displayName,
          createdAt: comments.createdAt,
        })
        .from(comments)
        .innerJoin(users, eq(users.id, comments.authorUserId))
        .where(
          and(
            eq(comments.postId, postId),
            eq(comments.status, "APPROVED"),
            isNull(comments.deletedAt),
          ),
        )
        .orderBy(asc(comments.createdAt)),
  };
}
