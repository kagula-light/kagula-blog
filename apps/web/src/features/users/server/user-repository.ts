import type { DatabaseClient } from "@kagula/database/client";
import { auditLogs, comments, posts, sessions, users } from "@kagula/database/schema";
import { and, desc, eq, ilike, isNull, or } from "drizzle-orm";

import type { UserStatus } from "../../../server/permissions/policy";
import {
  canTransitionCommentStatus,
  canTransitionUserStatus,
  type CommentModerationMutation,
  type CommentModerationResult,
  type ModeratedCommentStatus,
  type UserGovernanceResult,
  type UserStatusMutation,
} from "./user-governance-service";

export interface UserListFilter {
  readonly query?: string;
  readonly status?: UserStatus;
  readonly limit?: number;
}

export interface UserListItem {
  readonly id: string;
  readonly username: string;
  readonly displayName: string;
  readonly role: "ADMIN" | "USER";
  readonly status: UserStatus;
  readonly createdAt: Date;
  readonly lastLoginAt: Date | null;
}

export interface ModerationCommentFilter {
  readonly status?: ModeratedCommentStatus;
  readonly limit?: number;
}

export interface ModerationCommentItem {
  readonly id: string;
  readonly postId: string;
  readonly postTitle: string;
  readonly postSlug: string;
  readonly authorUserId: string;
  readonly authorDisplayName: string;
  readonly body: string;
  readonly status: ModeratedCommentStatus;
  readonly createdAt: Date;
  readonly moderatedAt: Date | null;
}

type RepositoryUserGovernanceResult = Exclude<
  UserGovernanceResult,
  { status: "UNAUTHENTICATED" | "SELF_GOVERNANCE" }
>;
type RepositoryCommentModerationResult = Exclude<
  CommentModerationResult,
  { status: "UNAUTHENTICATED" }
>;

export interface UserRepository {
  readonly listUsers: (filter?: UserListFilter) => Promise<readonly UserListItem[]>;
  readonly listModerationComments: (
    filter?: ModerationCommentFilter,
  ) => Promise<readonly ModerationCommentItem[]>;
  readonly changeUserStatus: (input: UserStatusMutation) => Promise<RepositoryUserGovernanceResult>;
  readonly moderateComment: (
    input: CommentModerationMutation,
  ) => Promise<RepositoryCommentModerationResult>;
}

const userAuditAction = {
  ACTIVE: "USER_REACTIVATED",
  MUTED: "USER_MUTED",
  BANNED: "USER_BANNED",
} as const;

const commentAuditAction = {
  APPROVED: "COMMENT_APPROVED",
  REJECTED: "COMMENT_REJECTED",
  DELETED: "COMMENT_DELETED",
} as const;

function clampLimit(limit: number | undefined): number {
  return Math.min(Math.max(limit ?? 100, 1), 200);
}

export function createUserRepository(database: DatabaseClient): UserRepository {
  return {
    listUsers: async (filter = {}) => {
      const query = filter.query?.trim();
      const where = and(
        filter.status ? eq(users.status, filter.status) : undefined,
        query
          ? or(ilike(users.username, `%${query}%`), ilike(users.displayName, `%${query}%`))
          : undefined,
      );
      return database.db
        .select({
          id: users.id,
          username: users.username,
          displayName: users.displayName,
          role: users.role,
          status: users.status,
          createdAt: users.createdAt,
          lastLoginAt: users.lastLoginAt,
        })
        .from(users)
        .where(where)
        .orderBy(desc(users.createdAt))
        .limit(clampLimit(filter.limit));
    },

    listModerationComments: async (filter = {}) =>
      database.db
        .select({
          id: comments.id,
          postId: comments.postId,
          postTitle: posts.title,
          postSlug: posts.slug,
          authorUserId: comments.authorUserId,
          authorDisplayName: users.displayName,
          body: comments.body,
          status: comments.status,
          createdAt: comments.createdAt,
          moderatedAt: comments.moderatedAt,
        })
        .from(comments)
        .innerJoin(posts, eq(posts.id, comments.postId))
        .innerJoin(users, eq(users.id, comments.authorUserId))
        .where(filter.status ? eq(comments.status, filter.status) : undefined)
        .orderBy(desc(comments.createdAt))
        .limit(clampLimit(filter.limit)),

    changeUserStatus: (input) =>
      database.db.transaction(async (transaction) => {
        const [actor] = await transaction
          .select({ role: users.role, status: users.status })
          .from(users)
          .where(eq(users.id, input.actorUserId))
          .limit(1);
        if (!actor || actor.role !== "ADMIN" || actor.status === "BANNED") {
          return { status: "FORBIDDEN" };
        }

        const [target] = await transaction
          .select({ role: users.role, status: users.status })
          .from(users)
          .where(eq(users.id, input.targetUserId))
          .limit(1);
        if (!target) return { status: "USER_NOT_FOUND" };
        if (target.role === "ADMIN" || input.actorUserId === input.targetUserId) {
          return { status: "FORBIDDEN" };
        }
        if (!canTransitionUserStatus(target.status, input.targetStatus)) {
          return { status: "INVALID_TRANSITION" };
        }

        const [updated] = await transaction
          .update(users)
          .set({ status: input.targetStatus, updatedAt: input.changedAt })
          .where(and(eq(users.id, input.targetUserId), eq(users.status, target.status)))
          .returning({ id: users.id });
        if (!updated) return { status: "INVALID_TRANSITION" };

        if (input.targetStatus === "BANNED") {
          await transaction
            .update(sessions)
            .set({ revokedAt: input.changedAt })
            .where(and(eq(sessions.userId, input.targetUserId), isNull(sessions.revokedAt)));
        }

        await transaction.insert(auditLogs).values({
          actorUserId: input.actorUserId,
          action: userAuditAction[input.targetStatus],
          resourceType: "USER",
          resourceId: input.targetUserId,
          summary: { previousStatus: target.status, status: input.targetStatus },
          createdAt: input.changedAt,
        });
        return { status: "SUCCESS" };
      }),

    moderateComment: (input) =>
      database.db.transaction(async (transaction) => {
        const [actor] = await transaction
          .select({ role: users.role, status: users.status })
          .from(users)
          .where(eq(users.id, input.actorUserId))
          .limit(1);
        if (!actor || actor.role !== "ADMIN" || actor.status === "BANNED") {
          return { status: "FORBIDDEN" };
        }

        const [comment] = await transaction
          .select({ status: comments.status })
          .from(comments)
          .where(eq(comments.id, input.commentId))
          .limit(1);
        if (!comment) return { status: "COMMENT_NOT_FOUND" };
        if (!canTransitionCommentStatus(comment.status, input.targetStatus)) {
          return { status: "INVALID_TRANSITION" };
        }

        const [updated] = await transaction
          .update(comments)
          .set({
            status: input.targetStatus,
            moderatedByUserId: input.actorUserId,
            moderatedAt: input.changedAt,
            updatedAt: input.changedAt,
            deletedAt: input.targetStatus === "DELETED" ? input.changedAt : null,
          })
          .where(and(eq(comments.id, input.commentId), eq(comments.status, comment.status)))
          .returning({ id: comments.id });
        if (!updated) return { status: "INVALID_TRANSITION" };

        await transaction.insert(auditLogs).values({
          actorUserId: input.actorUserId,
          action: commentAuditAction[input.targetStatus],
          resourceType: "COMMENT",
          resourceId: input.commentId,
          summary: { previousStatus: comment.status, status: input.targetStatus },
          createdAt: input.changedAt,
        });
        return { status: "SUCCESS" };
      }),
  };
}
