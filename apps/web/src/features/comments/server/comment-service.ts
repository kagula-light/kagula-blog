import { canCreateComment, type PermissionIdentity } from "../../../server/permissions/policy";

export interface PendingCommentCreation {
  readonly authorUserId: string;
  readonly postId: string;
  readonly body: string;
  readonly createdAt: Date;
}

export type PendingCommentCreationResult =
  | { readonly status: "CREATED"; readonly id: string }
  | { readonly status: "FORBIDDEN" }
  | { readonly status: "POST_NOT_FOUND" };

export type CommentSubmissionResult =
  | { readonly status: "SUCCESS"; readonly id: string }
  | { readonly status: "UNAUTHENTICATED" }
  | { readonly status: "FORBIDDEN" }
  | { readonly status: "POST_NOT_FOUND" }
  | { readonly status: "INVALID_INPUT" };

export interface CommentServiceDependencies {
  readonly createPendingComment: (
    input: PendingCommentCreation,
  ) => Promise<PendingCommentCreationResult>;
  readonly clock: () => Date;
}

export interface CommentSubmissionInput {
  readonly actor: PermissionIdentity | null;
  readonly postId: string;
  readonly body: string;
}

const forbiddenControlCharacter = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u;

export function normalizeCommentBody(value: string): string | null {
  const normalized = value.normalize("NFKC").replace(/\r\n?/g, "\n").trim();
  const length = [...normalized].length;
  if (length < 1 || length > 2_000 || forbiddenControlCharacter.test(normalized)) return null;
  return normalized;
}

export function createCommentService(
  dependencies: CommentServiceDependencies,
): (input: CommentSubmissionInput) => Promise<CommentSubmissionResult> {
  return async ({ actor, postId, body }) => {
    if (!actor) return { status: "UNAUTHENTICATED" };
    if (!canCreateComment(actor)) return { status: "FORBIDDEN" };

    const normalizedBody = normalizeCommentBody(body);
    if (!normalizedBody) return { status: "INVALID_INPUT" };
    const result = await dependencies.createPendingComment({
      authorUserId: actor.id,
      postId,
      body: normalizedBody,
      createdAt: dependencies.clock(),
    });
    if (result.status !== "CREATED") return result;
    return { status: "SUCCESS", id: result.id };
  };
}
