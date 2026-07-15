import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PermissionIdentity } from "../../../server/permissions/policy";
import { createCommentService } from "./comment-service";

const postId = "0190f3c2-5710-7aca-b167-8f4b28ad77c3";
const identity = (status: PermissionIdentity["status"]): PermissionIdentity => ({
  id: `user-${status.toLowerCase()}`,
  role: "USER",
  status,
});

describe("comment service", () => {
  const createPendingComment = vi.fn();
  const clock = vi.fn(() => new Date("2026-07-14T10:00:00.000Z"));
  const submit = createCommentService({ createPendingComment, clock });

  beforeEach(() => {
    vi.clearAllMocks();
    createPendingComment.mockResolvedValue({ status: "CREATED", id: "comment-id" });
  });

  it("rejects an anonymous visitor before the repository", async () => {
    await expect(submit({ actor: null, postId, body: "hello" })).resolves.toEqual({
      status: "UNAUTHENTICATED",
    });
    expect(createPendingComment).not.toHaveBeenCalled();
  });

  it.each(["MUTED", "BANNED"] as const)("rejects a %s actor", async (status) => {
    await expect(submit({ actor: identity(status), postId, body: "hello" })).resolves.toEqual({
      status: "FORBIDDEN",
    });
    expect(createPendingComment).not.toHaveBeenCalled();
  });

  it("normalizes NFKC, line endings, and outer whitespace", async () => {
    const actor = identity("ACTIVE");

    await expect(submit({ actor, postId, body: "  Ｈｅｌｌｏ\r\n星图  " })).resolves.toEqual({
      status: "SUCCESS",
      id: "comment-id",
    });
    expect(createPendingComment).toHaveBeenCalledWith({
      authorUserId: actor.id,
      postId,
      body: "Hello\n星图",
      createdAt: new Date("2026-07-14T10:00:00.000Z"),
    });
  });

  it.each(["", "   ", "a".repeat(2001), "hello\u0000world", "hello\u0007world"])(
    "rejects invalid body %j",
    async (body) => {
      await expect(submit({ actor: identity("ACTIVE"), postId, body })).resolves.toEqual({
        status: "INVALID_INPUT",
      });
      expect(createPendingComment).not.toHaveBeenCalled();
    },
  );

  it.each([
    [1, "x"],
    [2000, "x".repeat(2000)],
  ] as const)("accepts body boundary length %i", async (_length, body) => {
    await expect(submit({ actor: identity("ACTIVE"), postId, body })).resolves.toEqual({
      status: "SUCCESS",
      id: "comment-id",
    });
  });

  it.each(["FORBIDDEN", "POST_NOT_FOUND"] as const)(
    "preserves repository result %s",
    async (status) => {
      createPendingComment.mockResolvedValue({ status });
      await expect(submit({ actor: identity("ACTIVE"), postId, body: "hello" })).resolves.toEqual({
        status,
      });
    },
  );
});
