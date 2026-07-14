import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ManagedPost } from "../server/post-service";
import { postAction } from "./post-actions";
import type { PostActionState } from "./post-action-state";

const postId = "0190f3c2-5710-7aca-b167-8f4b28ad77c3";
const categoryId = "0190f3c2-5710-7aca-b167-8f4b28ad77c1";
const session = {
  id: "admin-id",
  role: "ADMIN" as const,
  status: "ACTIVE" as const,
  sessionId: "session-id",
  username: "admin",
  displayName: "Admin",
};
const savedPost: ManagedPost = {
  id: postId,
  slug: "content-core",
  status: "DRAFT",
  version: 1,
  scheduledFor: null,
  publishedAt: null,
  archivedAt: null,
};

const mocks = vi.hoisted(() => ({
  getCurrentSession: vi.fn(),
  createDraft: vi.fn(),
  update: vi.fn(),
  revalidatePath: vi.fn(),
  redirect: vi.fn((destination: string): never => {
    throw new Error(`NEXT_REDIRECT:${destination}`);
  }),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("../../../server/auth/get-current-session", () => ({
  getCurrentSession: mocks.getCurrentSession,
}));
vi.mock("../../../server/database/get-database", () => ({
  getDatabase: vi.fn(() => ({ kind: "database" })),
}));
vi.mock("../server/post-repository", () => ({
  createPostRepository: vi.fn(() => ({
    findPost: vi.fn(),
    createPost: vi.fn(),
    updatePost: vi.fn(),
  })),
}));
vi.mock("../server/markdown", () => ({ renderMarkdown: vi.fn((value: string) => value) }));
vi.mock("../server/post-service", async (importOriginal) => {
  const original = await importOriginal<typeof import("../server/post-service")>();
  return {
    ...original,
    createPostService: vi.fn(() => ({ createDraft: mocks.createDraft, update: mocks.update })),
  };
});

const initialState: PostActionState = { status: "IDLE" };

function createPostForm(overrides: Readonly<Record<string, string>> = {}): FormData {
  const formData = new FormData();
  formData.set("command", "CREATE_DRAFT");
  formData.set("title", "Content core");
  formData.set("slug", "content-core");
  formData.set("excerpt", "A focused excerpt.");
  formData.set("markdown", "# Content core");
  formData.set("categoryId", categoryId);
  for (const [name, value] of Object.entries(overrides)) formData.set(name, value);
  return formData;
}

describe("postAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCurrentSession.mockResolvedValue(session);
    mocks.createDraft.mockResolvedValue(savedPost);
    mocks.update.mockResolvedValue(savedPost);
  });

  it("returns field errors before resolving a session", async () => {
    await expect(postAction(initialState, createPostForm({ title: "" }))).resolves.toMatchObject({
      status: "ERROR",
      fieldErrors: { title: expect.any(Array) },
    });
    expect(mocks.getCurrentSession).not.toHaveBeenCalled();
  });

  it("creates a draft and redirects to its editor", async () => {
    await expect(postAction(initialState, createPostForm())).rejects.toThrow(
      `NEXT_REDIRECT:/admin/posts/${postId}/edit?saved=1`,
    );
    expect(mocks.createDraft).toHaveBeenCalledWith(
      session,
      expect.objectContaining({ title: "Content core", categoryId }),
    );
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin/posts");
  });

  it.each([
    ["SAVE", undefined],
    ["PUBLISH", "PUBLISHED"],
    ["SCHEDULE", "SCHEDULED"],
    ["ARCHIVE", "ARCHIVED"],
    ["RETURN_TO_DRAFT", "DRAFT"],
  ] as const)("maps %s to service status %s", async (command, targetStatus) => {
    const form = createPostForm({ command, postId, expectedVersion: "1" });
    if (command === "SCHEDULE") form.set("scheduledFor", "2026-07-15T04:00:00.000Z");

    await expect(postAction(initialState, form)).rejects.toThrow(/NEXT_REDIRECT/);
    expect(mocks.update).toHaveBeenCalledWith(
      session,
      expect.objectContaining({
        postId,
        expectedVersion: 1,
        ...(targetStatus ? { targetStatus } : {}),
      }),
    );
  });

  it("returns a refresh message for a version conflict", async () => {
    mocks.update.mockRejectedValue(new Error("Post version conflict"));

    await expect(
      postAction(initialState, createPostForm({ command: "SAVE", postId, expectedVersion: "1" })),
    ).resolves.toEqual({ status: "ERROR", message: "文章已被其他操作更新，请刷新后重试" });
  });
});
