import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ReactionResult } from "../server/reaction-service";
import { reactionAction } from "./reaction-actions";
import type { ReactionActionState } from "./reaction-actions";

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
  react: vi.fn<
    (
      input: Readonly<{
        actor: typeof session | null;
        postId: string;
        command: "LIKE" | "UNLIKE" | "FAVORITE" | "UNFAVORITE";
      }>,
    ) => Promise<ReactionResult>
  >(),
}));

vi.mock("../../../server/auth/get-current-session", () => ({
  getCurrentSession: mocks.getCurrentSession,
}));
vi.mock("../../../server/database/get-database", () => ({
  getDatabase: vi.fn(() => ({ kind: "database" })),
}));
vi.mock("../server/reaction-repository", () => ({
  createReactionRepository: vi.fn(() => ({ mutateReaction: vi.fn() })),
}));
vi.mock("../server/reaction-service", async (importOriginal) => {
  const original = await importOriginal<typeof import("../server/reaction-service")>();
  return { ...original, createReactionService: vi.fn(() => mocks.react) };
});

const initialState: ReactionActionState = { status: "IDLE" };

function form(command = "LIKE", id = postId): FormData {
  const data = new FormData();
  data.set("command", command);
  data.set("postId", id);
  return data;
}

describe("reactionAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCurrentSession.mockResolvedValue(session);
  });

  it("rejects malformed input before resolving a session", async () => {
    await expect(reactionAction(initialState, form("INVALID", "bad"))).resolves.toEqual({
      status: "ERROR",
      message: "互动请求无效",
    });
    expect(mocks.getCurrentSession).not.toHaveBeenCalled();
  });

  it("returns a login message for an anonymous visitor", async () => {
    mocks.getCurrentSession.mockResolvedValue(null);
    mocks.react.mockResolvedValue({ status: "UNAUTHENTICATED" });

    await expect(reactionAction(initialState, form())).resolves.toEqual({
      status: "ERROR",
      message: "登录后可以点赞和收藏",
    });
  });

  it.each([
    ["FORBIDDEN", "当前账号不能执行此操作"],
    ["POST_NOT_FOUND", "文章不存在或尚未公开"],
  ] as const)("maps %s to a safe message", async (status, message) => {
    mocks.react.mockResolvedValue({ status });
    await expect(reactionAction(initialState, form())).resolves.toEqual({
      status: "ERROR",
      message,
    });
  });

  it("returns the committed count and active state", async () => {
    mocks.react.mockResolvedValue({ status: "SUCCESS", active: true, count: 7 });

    await expect(reactionAction(initialState, form("FAVORITE"))).resolves.toEqual({
      status: "SUCCESS",
      command: "FAVORITE",
      active: true,
      count: 7,
    });
    expect(mocks.react).toHaveBeenCalledWith({
      actor: session,
      postId,
      command: "FAVORITE",
    });
  });
});
