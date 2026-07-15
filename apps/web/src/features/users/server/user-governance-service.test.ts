import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PermissionIdentity } from "../../../server/permissions/policy";
import {
  canTransitionCommentStatus,
  canTransitionUserStatus,
  createCommentModerationService,
  createUserGovernanceService,
} from "./user-governance-service";

const actor = (
  role: PermissionIdentity["role"],
  status: PermissionIdentity["status"] = "ACTIVE",
): PermissionIdentity => ({ id: "admin-id", role, status });

describe("user governance policy", () => {
  it.each([
    ["ACTIVE", "MUTED", true],
    ["ACTIVE", "BANNED", true],
    ["MUTED", "ACTIVE", true],
    ["MUTED", "BANNED", true],
    ["BANNED", "ACTIVE", true],
    ["ACTIVE", "ACTIVE", false],
    ["MUTED", "MUTED", false],
    ["BANNED", "BANNED", false],
    ["BANNED", "MUTED", false],
  ] as const)("maps user transition %s -> %s to %s", (current, target, expected) => {
    expect(canTransitionUserStatus(current, target)).toBe(expected);
  });

  const changeUserStatus = vi.fn();
  const govern = createUserGovernanceService({
    changeUserStatus,
    clock: () => new Date("2026-07-14T10:00:00.000Z"),
  });

  beforeEach(() => {
    vi.clearAllMocks();
    changeUserStatus.mockResolvedValue({ status: "SUCCESS" });
  });

  it.each([
    [null, "UNAUTHENTICATED"],
    [actor("USER"), "FORBIDDEN"],
    [actor("ADMIN", "BANNED"), "FORBIDDEN"],
  ] as const)("rejects actor %j with %s", async (identity, status) => {
    await expect(
      govern({ actor: identity, targetUserId: "reader-id", targetStatus: "MUTED" }),
    ).resolves.toEqual({ status });
    expect(changeUserStatus).not.toHaveBeenCalled();
  });

  it("refuses administrator self-ban", async () => {
    await expect(
      govern({ actor: actor("ADMIN"), targetUserId: "admin-id", targetStatus: "BANNED" }),
    ).resolves.toEqual({ status: "SELF_GOVERNANCE" });
    expect(changeUserStatus).not.toHaveBeenCalled();
  });

  it.each(["MUTED", "BANNED", "ACTIVE"] as const)(
    "delegates target status %s with actor and time",
    async (targetStatus) => {
      await govern({ actor: actor("ADMIN"), targetUserId: "reader-id", targetStatus });
      expect(changeUserStatus).toHaveBeenLastCalledWith({
        actorUserId: "admin-id",
        targetUserId: "reader-id",
        targetStatus,
        changedAt: new Date("2026-07-14T10:00:00.000Z"),
      });
    },
  );
});

describe("comment moderation policy", () => {
  it.each([
    ["PENDING", "APPROVED", true],
    ["PENDING", "REJECTED", true],
    ["APPROVED", "DELETED", true],
    ["REJECTED", "DELETED", true],
    ["PENDING", "DELETED", false],
    ["APPROVED", "REJECTED", false],
    ["REJECTED", "APPROVED", false],
    ["DELETED", "APPROVED", false],
  ] as const)("maps comment transition %s -> %s to %s", (current, target, expected) => {
    expect(canTransitionCommentStatus(current, target)).toBe(expected);
  });

  const moderateComment = vi.fn();
  const moderate = createCommentModerationService({
    moderateComment,
    clock: () => new Date("2026-07-14T10:00:00.000Z"),
  });

  beforeEach(() => {
    vi.clearAllMocks();
    moderateComment.mockResolvedValue({ status: "SUCCESS" });
  });

  it.each([
    [null, "UNAUTHENTICATED"],
    [actor("USER"), "FORBIDDEN"],
  ] as const)("rejects actor %j with %s", async (identity, status) => {
    await expect(
      moderate({ actor: identity, commentId: "comment-id", targetStatus: "APPROVED" }),
    ).resolves.toEqual({ status });
    expect(moderateComment).not.toHaveBeenCalled();
  });

  it.each(["APPROVED", "REJECTED", "DELETED"] as const)(
    "delegates moderation target %s",
    async (targetStatus) => {
      await moderate({ actor: actor("ADMIN"), commentId: "comment-id", targetStatus });
      expect(moderateComment).toHaveBeenLastCalledWith({
        actorUserId: "admin-id",
        commentId: "comment-id",
        targetStatus,
        changedAt: new Date("2026-07-14T10:00:00.000Z"),
      });
    },
  );
});
