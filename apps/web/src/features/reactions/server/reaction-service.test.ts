import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PermissionIdentity } from "../../../server/permissions/policy";
import { createReactionService, type ReactionResult } from "./reaction-service";

const postId = "0190f3c2-5710-7aca-b167-8f4b28ad77c3";
const identity = (status: PermissionIdentity["status"]): PermissionIdentity => ({
  id: `user-${status.toLowerCase()}`,
  role: "USER",
  status,
});

describe("reaction service", () => {
  const mutateReaction = vi.fn<
    (
      input: Readonly<{
        userId: string;
        postId: string;
        kind: "LIKE" | "FAVORITE";
        active: boolean;
      }>,
    ) => Promise<Exclude<ReactionResult, { status: "UNAUTHENTICATED" }>>
  >();
  const react = createReactionService({ mutateReaction });

  beforeEach(() => vi.clearAllMocks());

  it("rejects an unauthenticated command before the repository", async () => {
    await expect(react({ actor: null, postId, command: "LIKE" })).resolves.toEqual({
      status: "UNAUTHENTICATED",
    });
    expect(mutateReaction).not.toHaveBeenCalled();
  });

  it("rejects a banned actor before mutation", async () => {
    await expect(
      react({ actor: identity("BANNED"), postId, command: "FAVORITE" }),
    ).resolves.toEqual({ status: "FORBIDDEN" });
    expect(mutateReaction).not.toHaveBeenCalled();
  });

  it.each(["ACTIVE", "MUTED"] as const)(
    "allows a %s actor to like and favorite",
    async (status) => {
      mutateReaction.mockResolvedValue({ status: "SUCCESS", active: true, count: 1 });
      const actor = identity(status);

      await expect(react({ actor, postId, command: "LIKE" })).resolves.toEqual({
        status: "SUCCESS",
        active: true,
        count: 1,
      });
      expect(mutateReaction).toHaveBeenLastCalledWith({
        userId: actor.id,
        postId,
        kind: "LIKE",
        active: true,
      });

      await react({ actor, postId, command: "FAVORITE" });
      expect(mutateReaction).toHaveBeenLastCalledWith({
        userId: actor.id,
        postId,
        kind: "FAVORITE",
        active: true,
      });
    },
  );

  it.each([
    ["LIKE", "LIKE", true],
    ["UNLIKE", "LIKE", false],
    ["FAVORITE", "FAVORITE", true],
    ["UNFAVORITE", "FAVORITE", false],
  ] as const)("maps %s to %s active=%s", async (command, kind, active) => {
    mutateReaction.mockResolvedValue({ status: "SUCCESS", active, count: active ? 1 : 0 });
    const actor = identity("ACTIVE");

    await react({ actor, postId, command });

    expect(mutateReaction).toHaveBeenCalledWith({ userId: actor.id, postId, kind, active });
  });

  it.each(["FORBIDDEN", "POST_NOT_FOUND"] as const)(
    "preserves repository result %s",
    async (status) => {
      mutateReaction.mockResolvedValue({ status });
      await expect(react({ actor: identity("ACTIVE"), postId, command: "LIKE" })).resolves.toEqual({
        status,
      });
    },
  );
});
