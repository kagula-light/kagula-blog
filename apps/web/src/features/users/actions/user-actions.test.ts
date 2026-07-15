import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  commentModerationAction,
  type GovernanceActionState,
  userStatusAction,
} from "./user-actions";

const admin = {
  id: "0190f3c2-5710-7aca-b167-8f4b28ad77c3",
  role: "ADMIN" as const,
  status: "ACTIVE" as const,
  sessionId: "session-id",
  username: "admin",
  displayName: "Admin",
};
const targetUserId = "0190f3c2-5710-7aca-b167-8f4b28ad77c4";
const commentId = "0190f3c2-5710-7aca-b167-8f4b28ad77c5";
const mocks = vi.hoisted(() => ({
  getCurrentSession: vi.fn(),
  govern: vi.fn(),
  moderate: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("../../../server/auth/get-current-session", () => ({
  getCurrentSession: mocks.getCurrentSession,
}));
vi.mock("../../../server/database/get-database", () => ({
  getDatabase: vi.fn(() => ({ kind: "database" })),
}));
vi.mock("../server/user-repository", () => ({
  createUserRepository: vi.fn(() => ({
    changeUserStatus: vi.fn(),
    moderateComment: vi.fn(),
  })),
}));
vi.mock("../server/user-governance-service", () => ({
  createUserGovernanceService: vi.fn(() => mocks.govern),
  createCommentModerationService: vi.fn(() => mocks.moderate),
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

const initialState: GovernanceActionState = { status: "IDLE" };

function userForm(status = "MUTED", id = targetUserId): FormData {
  const formData = new FormData();
  formData.set("targetUserId", id);
  formData.set("targetStatus", status);
  return formData;
}

function commentForm(status = "APPROVED", id = commentId): FormData {
  const formData = new FormData();
  formData.set("commentId", id);
  formData.set("targetStatus", status);
  return formData;
}

describe("user governance actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCurrentSession.mockResolvedValue(admin);
  });

  it("rejects invalid user input before session resolution", async () => {
    await expect(userStatusAction(initialState, userForm("OWNER", "bad"))).resolves.toEqual({
      status: "ERROR",
      message: "用户状态请求无效",
    });
    expect(mocks.getCurrentSession).not.toHaveBeenCalled();
  });

  it.each([
    ["UNAUTHENTICATED", "管理员会话已失效，请重新登录"],
    ["FORBIDDEN", "当前账号无权修改该用户"],
    ["SELF_GOVERNANCE", "不能封禁当前管理员账号"],
    ["USER_NOT_FOUND", "用户不存在或已被删除"],
    ["INVALID_TRANSITION", "用户状态已经变化，请刷新后重试"],
  ] as const)("maps user result %s", async (status, message) => {
    mocks.govern.mockResolvedValue({ status });
    await expect(userStatusAction(initialState, userForm())).resolves.toEqual({
      status: "ERROR",
      message,
    });
  });

  it("updates a user and revalidates the list", async () => {
    mocks.govern.mockResolvedValue({ status: "SUCCESS" });
    await expect(userStatusAction(initialState, userForm())).resolves.toEqual({
      status: "SUCCESS",
      message: "用户状态已更新",
    });
    expect(mocks.govern).toHaveBeenCalledWith({
      actor: admin,
      targetUserId,
      targetStatus: "MUTED",
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin/users");
  });

  it("rejects invalid comment input before session resolution", async () => {
    await expect(
      commentModerationAction(initialState, commentForm("PENDING", "bad")),
    ).resolves.toEqual({ status: "ERROR", message: "评论审核请求无效" });
    expect(mocks.getCurrentSession).not.toHaveBeenCalled();
  });

  it.each([
    ["UNAUTHENTICATED", "管理员会话已失效，请重新登录"],
    ["FORBIDDEN", "当前账号无权审核评论"],
    ["COMMENT_NOT_FOUND", "评论不存在或已被删除"],
    ["INVALID_TRANSITION", "评论状态已经变化，请刷新后重试"],
  ] as const)("maps comment result %s", async (status, message) => {
    mocks.moderate.mockResolvedValue({ status });
    await expect(commentModerationAction(initialState, commentForm())).resolves.toEqual({
      status: "ERROR",
      message,
    });
  });

  it("moderates a comment and revalidates admin and public pages", async () => {
    mocks.moderate.mockResolvedValue({ status: "SUCCESS" });
    await expect(commentModerationAction(initialState, commentForm())).resolves.toEqual({
      status: "SUCCESS",
      message: "评论审核状态已更新",
    });
    expect(mocks.moderate).toHaveBeenCalledWith({
      actor: admin,
      commentId,
      targetStatus: "APPROVED",
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin/comments");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/articles/[slug]", "page");
  });
});
