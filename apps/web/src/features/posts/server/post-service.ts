import type { PermissionIdentity } from "../../../server/permissions/policy";
import {
  normalizePostSlug,
  normalizePostTitle,
  resolvePostTransition,
  type PostStatus,
  type ResolvedPostTransition,
} from "../domain/post-state";

export interface EditablePostContent {
  readonly title: string;
  readonly slug: string;
  readonly excerpt: string;
  readonly markdown: string;
  readonly aiSummary: string | null;
  readonly categoryId: string;
  readonly tagIds: readonly string[];
  readonly coverMediaId: string | null;
  readonly seoTitle: string | null;
  readonly seoDescription: string | null;
  readonly socialMediaId: string | null;
}

export interface PreparedPostContent extends EditablePostContent {
  readonly renderedHtml: string;
  readonly readingMinutes: number;
  readonly summarySource: "NONE" | "MANUAL";
}

export interface ManagedPost {
  readonly id: string;
  readonly slug: string;
  readonly status: PostStatus;
  readonly version: number;
  readonly scheduledFor: Date | null;
  readonly publishedAt: Date | null;
  readonly archivedAt: Date | null;
}

export type PostAuditAction =
  | "POST_CREATED"
  | "POST_UPDATED"
  | "POST_SCHEDULED"
  | "POST_PUBLISHED"
  | "POST_ARCHIVED"
  | "POST_RETURNED_TO_DRAFT";

export interface CreatePostPersistenceInput {
  readonly actorId: string;
  readonly occurredAt: Date;
  readonly revisionNumber: 1;
  readonly content: PreparedPostContent;
  readonly lifecycle: ResolvedPostTransition;
  readonly auditAction: "POST_CREATED";
}

export interface UpdatePostPersistenceInput {
  readonly postId: string;
  readonly previousSlug: string;
  readonly expectedVersion: number;
  readonly actorId: string;
  readonly occurredAt: Date;
  readonly revisionNumber: number;
  readonly content: PreparedPostContent;
  readonly lifecycle: ResolvedPostTransition;
  readonly auditAction: Exclude<PostAuditAction, "POST_CREATED">;
}

export interface PostServiceDependencies {
  readonly findPost: (postId: string) => Promise<ManagedPost | null>;
  readonly createPost: (input: CreatePostPersistenceInput) => Promise<ManagedPost>;
  readonly updatePost: (input: UpdatePostPersistenceInput) => Promise<ManagedPost>;
  readonly renderMarkdown: (markdown: string) => string;
  readonly clock: () => Date;
}

export interface UpdatePostInput {
  readonly postId: string;
  readonly expectedVersion: number;
  readonly content: EditablePostContent;
  readonly targetStatus?: PostStatus;
  readonly scheduledFor?: Date | null;
}

function assertActiveAdministrator(
  identity: PermissionIdentity | null,
): asserts identity is PermissionIdentity {
  if (identity?.role !== "ADMIN" || identity.status !== "ACTIVE") {
    throw new Error("An active administrator is required to manage posts");
  }
}

function normalizeOptionalText(value: string | null, maximumLength: number, label: string) {
  if (value === null) return null;
  const normalized = value.normalize("NFKC").trim();
  if (normalized.length === 0) return null;
  if (normalized.length > maximumLength) {
    throw new Error(`${label} exceeds ${maximumLength} characters`);
  }
  return normalized;
}

function calculateReadingMinutes(markdown: string): number {
  const cjkCharacters = markdown.match(
    /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/gu,
  );
  const withoutCjk = markdown.replace(
    /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/gu,
    " ",
  );
  const words = withoutCjk.match(/[\p{L}\p{N}]+/gu);
  const readingUnits = (cjkCharacters?.length ?? 0) + (words?.length ?? 0);
  return Math.max(1, Math.ceil(readingUnits / 300));
}

function prepareContent(
  content: EditablePostContent,
  renderMarkdown: (markdown: string) => string,
): PreparedPostContent {
  const excerpt = content.excerpt.normalize("NFKC").trim();
  if (excerpt.length === 0 || excerpt.length > 1_000) {
    throw new Error("Post excerpt must contain 1-1000 characters");
  }

  const markdown = content.markdown.trim();
  if (markdown.length === 0 || markdown.length > 1_000_000) {
    throw new Error("Post Markdown must contain 1-1000000 characters");
  }

  const categoryId = content.categoryId.trim();
  if (!categoryId) throw new Error("Post category is required");
  const tagIds = [...new Set(content.tagIds.map((tagId) => tagId.trim()))];
  if (tagIds.some((tagId) => tagId.length === 0)) {
    throw new Error("Post tag identifiers cannot be empty");
  }

  const aiSummary = normalizeOptionalText(content.aiSummary, 2_000, "AI summary");
  return {
    ...content,
    title: normalizePostTitle(content.title),
    slug: normalizePostSlug(content.slug),
    excerpt,
    markdown,
    aiSummary,
    categoryId,
    tagIds,
    seoTitle: normalizeOptionalText(content.seoTitle, 200, "SEO title"),
    seoDescription: normalizeOptionalText(content.seoDescription, 320, "SEO description"),
    renderedHtml: renderMarkdown(markdown),
    readingMinutes: calculateReadingMinutes(markdown),
    summarySource: aiSummary ? "MANUAL" : "NONE",
  };
}

function auditActionFor(
  targetStatus: PostStatus | undefined,
): Exclude<PostAuditAction, "POST_CREATED"> {
  if (targetStatus === "SCHEDULED") return "POST_SCHEDULED";
  if (targetStatus === "PUBLISHED") return "POST_PUBLISHED";
  if (targetStatus === "ARCHIVED") return "POST_ARCHIVED";
  if (targetStatus === "DRAFT") return "POST_RETURNED_TO_DRAFT";
  return "POST_UPDATED";
}

export function createPostService(dependencies: PostServiceDependencies) {
  return {
    createDraft: async (
      actor: PermissionIdentity | null,
      content: EditablePostContent,
    ): Promise<ManagedPost> => {
      assertActiveAdministrator(actor);
      const occurredAt = dependencies.clock();
      return dependencies.createPost({
        actorId: actor.id,
        occurredAt,
        revisionNumber: 1,
        content: prepareContent(content, dependencies.renderMarkdown),
        lifecycle: {
          status: "DRAFT",
          scheduledFor: null,
          publishedAt: null,
          archivedAt: null,
        },
        auditAction: "POST_CREATED",
      });
    },

    update: async (
      actor: PermissionIdentity | null,
      input: UpdatePostInput,
    ): Promise<ManagedPost> => {
      assertActiveAdministrator(actor);
      const existing = await dependencies.findPost(input.postId);
      if (!existing) throw new Error("Post was not found");
      if (existing.version !== input.expectedVersion) {
        throw new Error("Post version is stale; reload before saving");
      }

      const occurredAt = dependencies.clock();
      const lifecycle = input.targetStatus
        ? resolvePostTransition({
            currentStatus: existing.status,
            targetStatus: input.targetStatus,
            now: occurredAt,
            scheduledFor: input.scheduledFor ?? null,
            publishedAt: existing.publishedAt,
          })
        : {
            status: existing.status,
            scheduledFor: existing.scheduledFor,
            publishedAt: existing.publishedAt,
            archivedAt: existing.archivedAt,
          };

      return dependencies.updatePost({
        postId: existing.id,
        previousSlug: existing.slug,
        expectedVersion: existing.version,
        actorId: actor.id,
        occurredAt,
        revisionNumber: existing.version + 1,
        content: prepareContent(input.content, dependencies.renderMarkdown),
        lifecycle,
        auditAction: auditActionFor(input.targetStatus),
      });
    },
  };
}
