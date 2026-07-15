import {
  canAccessAdmin,
  type PermissionIdentity,
  type UserStatus,
} from "../../../server/permissions/policy";

export type ModeratedCommentStatus = "PENDING" | "APPROVED" | "REJECTED" | "DELETED";
export type CommentModerationTarget = "APPROVED" | "REJECTED" | "DELETED";

export function canTransitionUserStatus(current: UserStatus, target: UserStatus): boolean {
  if (current === "ACTIVE") return target === "MUTED" || target === "BANNED";
  if (current === "MUTED") return target === "ACTIVE" || target === "BANNED";
  return target === "ACTIVE";
}

export function canTransitionCommentStatus(
  current: ModeratedCommentStatus,
  target: CommentModerationTarget,
): boolean {
  if (current === "PENDING") return target === "APPROVED" || target === "REJECTED";
  if (current === "APPROVED" || current === "REJECTED") return target === "DELETED";
  return false;
}

export interface UserStatusMutation {
  readonly actorUserId: string;
  readonly targetUserId: string;
  readonly targetStatus: UserStatus;
  readonly changedAt: Date;
}

export type UserGovernanceResult =
  | { readonly status: "SUCCESS" }
  | { readonly status: "UNAUTHENTICATED" }
  | { readonly status: "FORBIDDEN" }
  | { readonly status: "SELF_GOVERNANCE" }
  | { readonly status: "USER_NOT_FOUND" }
  | { readonly status: "INVALID_TRANSITION" };

export interface UserGovernanceDependencies {
  readonly changeUserStatus: (
    input: UserStatusMutation,
  ) => Promise<Exclude<UserGovernanceResult, { status: "UNAUTHENTICATED" | "SELF_GOVERNANCE" }>>;
  readonly clock: () => Date;
}

export interface UserGovernanceInput {
  readonly actor: PermissionIdentity | null;
  readonly targetUserId: string;
  readonly targetStatus: UserStatus;
}

export function createUserGovernanceService(
  dependencies: UserGovernanceDependencies,
): (input: UserGovernanceInput) => Promise<UserGovernanceResult> {
  return async ({ actor, targetUserId, targetStatus }) => {
    if (!actor) return { status: "UNAUTHENTICATED" };
    if (!canAccessAdmin(actor)) return { status: "FORBIDDEN" };
    if (actor.id === targetUserId && targetStatus === "BANNED") {
      return { status: "SELF_GOVERNANCE" };
    }
    return dependencies.changeUserStatus({
      actorUserId: actor.id,
      targetUserId,
      targetStatus,
      changedAt: dependencies.clock(),
    });
  };
}

export interface CommentModerationMutation {
  readonly actorUserId: string;
  readonly commentId: string;
  readonly targetStatus: CommentModerationTarget;
  readonly changedAt: Date;
}

export type CommentModerationResult =
  | { readonly status: "SUCCESS" }
  | { readonly status: "UNAUTHENTICATED" }
  | { readonly status: "FORBIDDEN" }
  | { readonly status: "COMMENT_NOT_FOUND" }
  | { readonly status: "INVALID_TRANSITION" };

export interface CommentModerationDependencies {
  readonly moderateComment: (
    input: CommentModerationMutation,
  ) => Promise<Exclude<CommentModerationResult, { status: "UNAUTHENTICATED" }>>;
  readonly clock: () => Date;
}

export interface CommentModerationInput {
  readonly actor: PermissionIdentity | null;
  readonly commentId: string;
  readonly targetStatus: CommentModerationTarget;
}

export function createCommentModerationService(
  dependencies: CommentModerationDependencies,
): (input: CommentModerationInput) => Promise<CommentModerationResult> {
  return async ({ actor, commentId, targetStatus }) => {
    if (!actor) return { status: "UNAUTHENTICATED" };
    if (!canAccessAdmin(actor)) return { status: "FORBIDDEN" };
    return dependencies.moderateComment({
      actorUserId: actor.id,
      commentId,
      targetStatus,
      changedAt: dependencies.clock(),
    });
  };
}
