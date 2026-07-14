import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PermissionIdentity } from "../../../server/permissions/policy";
import {
  createPostService,
  type EditablePostContent,
  type ManagedPost,
  type PostServiceDependencies,
} from "./post-service";

const now = new Date("2026-07-14T04:00:00.000Z");
const activeAdmin: PermissionIdentity = { id: "admin-id", role: "ADMIN", status: "ACTIVE" };
const content: EditablePostContent = {
  title: "  Content Core  ",
  slug: "Content_Core",
  excerpt: "  A focused excerpt.  ",
  markdown: "# Content core\n\nThe body.",
  aiSummary: "  Manual summary.  ",
  categoryId: "category-id",
  tagIds: ["tag-a", "tag-a", "tag-b"],
  coverMediaId: null,
  seoTitle: null,
  seoDescription: null,
  socialMediaId: null,
};
const draft: ManagedPost = {
  id: "post-id",
  slug: "content-core",
  status: "DRAFT",
  version: 1,
  scheduledFor: null,
  publishedAt: null,
  archivedAt: null,
};

function createDependencies(
  overrides: Partial<PostServiceDependencies> = {},
): PostServiceDependencies {
  return {
    findPost: vi.fn(async () => draft),
    createPost: vi.fn(async (input) => ({
      id: "post-id",
      slug: input.content.slug,
      status: input.lifecycle.status,
      version: input.revisionNumber,
      scheduledFor: input.lifecycle.scheduledFor,
      publishedAt: input.lifecycle.publishedAt,
      archivedAt: input.lifecycle.archivedAt,
    })),
    updatePost: vi.fn(async (input) => ({
      id: input.postId,
      slug: input.content.slug,
      status: input.lifecycle.status,
      version: input.revisionNumber,
      scheduledFor: input.lifecycle.scheduledFor,
      publishedAt: input.lifecycle.publishedAt,
      archivedAt: input.lifecycle.archivedAt,
    })),
    renderMarkdown: vi.fn((markdown) => `<h1>${markdown}</h1>`),
    clock: () => now,
    ...overrides,
  };
}

describe("post service", () => {
  beforeEach(() => vi.restoreAllMocks());

  it.each<PermissionIdentity | null>([
    null,
    { id: "user-id", role: "USER", status: "ACTIVE" },
    { id: "admin-id", role: "ADMIN", status: "BANNED" },
    { id: "admin-id", role: "ADMIN", status: "MUTED" },
  ])("rejects content creation by %j", async (actor) => {
    const dependencies = createDependencies();
    const service = createPostService(dependencies);

    await expect(service.createDraft(actor, content)).rejects.toThrow(/active administrator/i);
    expect(dependencies.createPost).not.toHaveBeenCalled();
  });

  it("creates a normalized draft and its first revision", async () => {
    const dependencies = createDependencies();
    const service = createPostService(dependencies);

    await expect(service.createDraft(activeAdmin, content)).resolves.toMatchObject({
      slug: "content-core",
      status: "DRAFT",
      version: 1,
    });
    expect(dependencies.createPost).toHaveBeenCalledWith({
      actorId: "admin-id",
      occurredAt: now,
      revisionNumber: 1,
      content: {
        ...content,
        title: "Content Core",
        slug: "content-core",
        excerpt: "A focused excerpt.",
        aiSummary: "Manual summary.",
        tagIds: ["tag-a", "tag-b"],
        renderedHtml: "<h1># Content core\n\nThe body.</h1>",
        readingMinutes: 1,
        summarySource: "MANUAL",
      },
      lifecycle: {
        status: "DRAFT",
        scheduledFor: null,
        publishedAt: null,
        archivedAt: null,
      },
      auditAction: "POST_CREATED",
    });
  });

  it("rejects empty required content before persistence", async () => {
    const dependencies = createDependencies();
    const service = createPostService(dependencies);

    await expect(service.createDraft(activeAdmin, { ...content, markdown: "   " })).rejects.toThrow(
      /markdown/i,
    );
    expect(dependencies.createPost).not.toHaveBeenCalled();
  });

  it("rejects a stale editor version", async () => {
    const dependencies = createDependencies();
    const service = createPostService(dependencies);

    await expect(
      service.update(activeAdmin, {
        postId: "post-id",
        expectedVersion: 2,
        content,
      }),
    ).rejects.toThrow(/version/i);
    expect(dependencies.updatePost).not.toHaveBeenCalled();
  });

  it("saves a published post without changing its lifecycle", async () => {
    const publishedAt = new Date("2026-07-13T04:00:00.000Z");
    const dependencies = createDependencies({
      findPost: vi.fn(async (): Promise<ManagedPost> => ({
        ...draft,
        status: "PUBLISHED",
        publishedAt,
      })),
    });
    const service = createPostService(dependencies);

    await service.update(activeAdmin, {
      postId: "post-id",
      expectedVersion: 1,
      content: { ...content, slug: "new-slug" },
    });

    expect(dependencies.updatePost).toHaveBeenCalledWith(
      expect.objectContaining({
        postId: "post-id",
        previousSlug: "content-core",
        expectedVersion: 1,
        revisionNumber: 2,
        lifecycle: {
          status: "PUBLISHED",
          scheduledFor: null,
          publishedAt,
          archivedAt: null,
        },
        auditAction: "POST_UPDATED",
      }),
    );
  });

  it("publishes a draft immediately", async () => {
    const dependencies = createDependencies();
    const service = createPostService(dependencies);

    await service.update(activeAdmin, {
      postId: "post-id",
      expectedVersion: 1,
      content,
      targetStatus: "PUBLISHED",
    });

    expect(dependencies.updatePost).toHaveBeenCalledWith(
      expect.objectContaining({
        lifecycle: {
          status: "PUBLISHED",
          scheduledFor: null,
          publishedAt: now,
          archivedAt: null,
        },
        auditAction: "POST_PUBLISHED",
      }),
    );
  });

  it("schedules a draft for a future time", async () => {
    const scheduledFor = new Date("2026-07-15T04:00:00.000Z");
    const dependencies = createDependencies();
    const service = createPostService(dependencies);

    await service.update(activeAdmin, {
      postId: "post-id",
      expectedVersion: 1,
      content,
      targetStatus: "SCHEDULED",
      scheduledFor,
    });

    expect(dependencies.updatePost).toHaveBeenCalledWith(
      expect.objectContaining({
        lifecycle: {
          status: "SCHEDULED",
          scheduledFor,
          publishedAt: null,
          archivedAt: null,
        },
        auditAction: "POST_SCHEDULED",
      }),
    );
  });

  it("archives a published post", async () => {
    const publishedAt = new Date("2026-07-13T04:00:00.000Z");
    const dependencies = createDependencies({
      findPost: vi.fn(async (): Promise<ManagedPost> => ({
        ...draft,
        status: "PUBLISHED",
        publishedAt,
      })),
    });
    const service = createPostService(dependencies);

    await service.update(activeAdmin, {
      postId: "post-id",
      expectedVersion: 1,
      content,
      targetStatus: "ARCHIVED",
    });

    expect(dependencies.updatePost).toHaveBeenCalledWith(
      expect.objectContaining({
        lifecycle: {
          status: "ARCHIVED",
          scheduledFor: null,
          publishedAt,
          archivedAt: now,
        },
        auditAction: "POST_ARCHIVED",
      }),
    );
  });
});
