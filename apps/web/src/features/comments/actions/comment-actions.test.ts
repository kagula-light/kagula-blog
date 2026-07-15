import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CommentSubmissionResult } from "../server/comment-service";
import { commentAction, type CommentActionState } from "./comment-actions";

const postId = "0190f3c2-5710-7aca-b167-8f4b28ad77c3";
const session = {
  id: "reader-id",
  role: "USER" as const,
  status: "ACTIVE" as const,
  sessionId: "session-id",
  username: "reader",
  displayName: "Reader",
};
const mocks = vi.hoisted(() => ({
  getCurrentSession: vi.fn(),
  submit:
    vi.fn<
      (
        input: Readonly<{ actor: typeof session | null; postId: string; body: string }>,
      ) => Promise<CommentSubmissionResult>
    >(),
}));

vi.mock("../../../server/auth/get-current-session", () => ({
  getCurrentSession: mocks.getCurrentSession,
}));
vi.mock("../../../server/database/get-database", () => ({
  getDatabase: vi.fn(() => ({ kind: "database" })),
}));
vi.mock("../server/comment-repository", () => ({
  createCommentRepository: vi.fn(() => ({ createPendingComment: vi.fn() })),
}));
vi.mock("../server/comment-service", async (importOriginal) => {
  const original = await importOriginal<typeof import("../server/comment-service")>();
  return { ...original, createCommentService: vi.fn(() => mocks.submit) };
});

const initialState: CommentActionState = { status: "IDLE" };

function form(body = "等待审核", id = postId): FormData {
  const data = new FormData();
  data.set("postId", id);
  data.set("body", body);
  return data;
}

describe("commentAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCurrentSession.mockResolvedValue(session);
  });

  it("returns field errors before resolving a session", async () => {
    await expect(commentAction(initialState, form("", "bad"))).resolves.toEqual({
      status: "ERROR",
      fieldErrors: {
        postId: ["文章标识无效"],
        body: ["请输入评论内容"],
      },
    });
    expect(mocks.getCurrentSession).not.toHaveBeenCalled();
  });

  it.each([
    ["UNAUTHENTICATED", "登录后可以提交评论"],
    ["FORBIDDEN", "当前账号不能提交评论"],
    ["POST_NOT_FOUND", "文章不存在或尚未公开"],
    ["INVALID_INPUT", "评论内容无效"],
  ] as const)("maps %s to a safe message", async (status, message) => {
    if (status === "UNAUTHENTICATED") mocks.getCurrentSession.mockResolvedValue(null);
    mocks.submit.mockResolvedValue({ status });

    await expect(commentAction(initialState, form())).resolves.toEqual({
      status: "ERROR",
      message,
    });
  });

  it("returns the pending moderation confirmation", async () => {
    mocks.submit.mockResolvedValue({ status: "SUCCESS", id: "comment-id" });

    await expect(commentAction(initialState, form())).resolves.toEqual({
      status: "SUCCESS",
      message: "评论已提交，等待审核",
    });
    expect(mocks.submit).toHaveBeenCalledWith({
      actor: session,
      postId,
      body: "等待审核",
    });
  });
});
