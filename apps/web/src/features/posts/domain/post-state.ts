export type PostStatus = "DRAFT" | "SCHEDULED" | "PUBLISHED" | "ARCHIVED";

export interface ResolvePostTransitionInput {
  readonly currentStatus: PostStatus;
  readonly targetStatus: PostStatus;
  readonly now: Date;
  readonly scheduledFor: Date | null;
  readonly publishedAt: Date | null;
}

export interface ResolvedPostTransition {
  readonly status: PostStatus;
  readonly scheduledFor: Date | null;
  readonly publishedAt: Date | null;
  readonly archivedAt: Date | null;
}

const allowedTransitions: Readonly<Record<PostStatus, readonly PostStatus[]>> = {
  DRAFT: ["SCHEDULED", "PUBLISHED"],
  SCHEDULED: ["DRAFT", "PUBLISHED"],
  PUBLISHED: ["ARCHIVED"],
  ARCHIVED: ["PUBLISHED"],
};

const slugPattern = /^[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)*$/u;

export function normalizePostSlug(value: string): string {
  const normalized = value
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/gu, "-")
    .replace(/-+/g, "-");

  if (normalized.length === 0 || normalized.length > 200 || !slugPattern.test(normalized)) {
    throw new Error("Post slug must contain letters, numbers, and single hyphens");
  }
  return normalized;
}

export function normalizePostTitle(value: string): string {
  const normalized = value.normalize("NFKC").trim();
  if (normalized.length === 0 || normalized.length > 200) {
    throw new Error("Post title must contain 1-200 characters");
  }
  return normalized;
}

export function resolvePostTransition({
  currentStatus,
  targetStatus,
  now,
  scheduledFor,
  publishedAt,
}: ResolvePostTransitionInput): ResolvedPostTransition {
  if (!allowedTransitions[currentStatus].includes(targetStatus)) {
    throw new Error(`Post transition from ${currentStatus} to ${targetStatus} is not allowed`);
  }

  if (targetStatus === "DRAFT") {
    return {
      status: "DRAFT",
      scheduledFor: null,
      publishedAt: null,
      archivedAt: null,
    };
  }

  if (targetStatus === "SCHEDULED") {
    if (!scheduledFor || !Number.isFinite(scheduledFor.getTime()) || scheduledFor <= now) {
      throw new Error("Scheduled publication must be in the future");
    }
    return {
      status: "SCHEDULED",
      scheduledFor,
      publishedAt: null,
      archivedAt: null,
    };
  }

  if (targetStatus === "PUBLISHED") {
    return {
      status: "PUBLISHED",
      scheduledFor: null,
      publishedAt: now,
      archivedAt: null,
    };
  }

  if (!publishedAt) {
    throw new Error("Published post must have a publication time before archival");
  }
  return {
    status: "ARCHIVED",
    scheduledFor: null,
    publishedAt,
    archivedAt: now,
  };
}
