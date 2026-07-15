import { canAccessAdmin, type PermissionIdentity } from "../../../server/permissions/policy";

export type HotspotCandidateStatus = "PENDING" | "APPROVED" | "REJECTED" | "EXPIRED";
export type HotspotReviewOperation = "APPROVE" | "REJECT" | "EXPIRE" | "REORDER";

export function canTransitionHotspotStatus(
  current: HotspotCandidateStatus,
  operation: HotspotReviewOperation,
): boolean {
  if (current === "PENDING") return operation === "APPROVE" || operation === "REJECT";
  if (current === "APPROVED") return operation === "EXPIRE" || operation === "REORDER";
  return false;
}

interface HotspotReviewMutationBase {
  readonly actorUserId: string;
  readonly candidateId: string;
  readonly changedAt: Date;
}

export type HotspotReviewMutation =
  | (HotspotReviewMutationBase &
      Readonly<{
        operation: "APPROVE";
        displayTitle: string;
        publicOrder: number;
        expiresAt: Date;
      }>)
  | (HotspotReviewMutationBase &
      Readonly<{
        operation: "REORDER";
        displayTitle: string;
        publicOrder: number;
      }>)
  | (HotspotReviewMutationBase &
      Readonly<{
        operation: "REJECT" | "EXPIRE";
      }>);

export type HotspotReviewRepositoryResult =
  | Readonly<{ status: "SUCCESS" }>
  | Readonly<{ status: "FORBIDDEN" }>
  | Readonly<{ status: "CANDIDATE_NOT_FOUND" }>
  | Readonly<{ status: "INVALID_TRANSITION" }>;

export type HotspotReviewResult =
  | HotspotReviewRepositoryResult
  | Readonly<{ status: "UNAUTHENTICATED" }>
  | Readonly<{ status: "INVALID_INPUT" }>;

export interface HotspotReviewDependencies {
  readonly reviewCandidate: (
    input: HotspotReviewMutation,
  ) => Promise<HotspotReviewRepositoryResult>;
  readonly clock: () => Date;
}

interface HotspotReviewInputBase {
  readonly actor: PermissionIdentity | null;
  readonly candidateId: string;
}

export type HotspotReviewInput =
  | (HotspotReviewInputBase &
      Readonly<{
        operation: "APPROVE" | "REORDER";
        displayTitle: string;
        publicOrder: number;
      }>)
  | (HotspotReviewInputBase & Readonly<{ operation: "REJECT" | "EXPIRE" }>);

const invisibleCharacters = /[\u200B-\u200F\u2060\uFEFF]/gu;
const dangerousControlCharacters = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/u;

function normalizeDisplayTitle(value: string): string | null {
  const normalized = value
    .normalize("NFKC")
    .replace(invisibleCharacters, "")
    .trim()
    .replace(/\s+/gu, " ");
  if (
    dangerousControlCharacters.test(normalized) ||
    [...normalized].length < 1 ||
    [...normalized].length > 180
  ) {
    return null;
  }
  return normalized;
}

export function createHotspotReviewService(
  dependencies: HotspotReviewDependencies,
): (input: HotspotReviewInput) => Promise<HotspotReviewResult> {
  return async (input) => {
    if (!input.actor) return { status: "UNAUTHENTICATED" };
    if (!canAccessAdmin(input.actor)) return { status: "FORBIDDEN" };

    const changedAt = dependencies.clock();
    if (input.operation === "APPROVE" || input.operation === "REORDER") {
      const displayTitle = normalizeDisplayTitle(input.displayTitle);
      if (
        !displayTitle ||
        !Number.isInteger(input.publicOrder) ||
        input.publicOrder < 1 ||
        input.publicOrder > 1_000
      ) {
        return { status: "INVALID_INPUT" };
      }
      if (input.operation === "APPROVE") {
        return dependencies.reviewCandidate({
          actorUserId: input.actor.id,
          candidateId: input.candidateId,
          operation: "APPROVE",
          displayTitle,
          publicOrder: input.publicOrder,
          changedAt,
          expiresAt: new Date(changedAt.getTime() + 24 * 60 * 60 * 1_000),
        });
      }
      return dependencies.reviewCandidate({
        actorUserId: input.actor.id,
        candidateId: input.candidateId,
        operation: "REORDER",
        displayTitle,
        publicOrder: input.publicOrder,
        changedAt,
      });
    }

    return dependencies.reviewCandidate({
      actorUserId: input.actor.id,
      candidateId: input.candidateId,
      operation: input.operation,
      changedAt,
    });
  };
}
