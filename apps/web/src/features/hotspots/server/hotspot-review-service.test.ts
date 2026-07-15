import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PermissionIdentity } from "../../../server/permissions/policy";
import {
  canTransitionHotspotStatus,
  createHotspotReviewService,
  type HotspotReviewMutation,
  type HotspotReviewRepositoryResult,
} from "./hotspot-review-service";

const changedAt = new Date("2026-07-15T08:00:00.000Z");
const candidateId = "0190f3c2-5710-7aca-b167-8f4b28ad77c3";
const actor = (
  role: PermissionIdentity["role"],
  status: PermissionIdentity["status"] = "ACTIVE",
): PermissionIdentity => ({ id: "admin-id", role, status });

describe("hotspot review policy", () => {
  it.each([
    ["PENDING", "APPROVE", true],
    ["PENDING", "REJECT", true],
    ["PENDING", "EXPIRE", false],
    ["PENDING", "REORDER", false],
    ["APPROVED", "EXPIRE", true],
    ["APPROVED", "REORDER", true],
    ["APPROVED", "APPROVE", false],
    ["APPROVED", "REJECT", false],
    ["REJECTED", "APPROVE", false],
    ["EXPIRED", "REORDER", false],
  ] as const)("maps %s with %s to %s", (current, operation, expected) => {
    expect(canTransitionHotspotStatus(current, operation)).toBe(expected);
  });

  const reviewCandidate =
    vi.fn<(input: HotspotReviewMutation) => Promise<HotspotReviewRepositoryResult>>();
  const review = createHotspotReviewService({
    reviewCandidate,
    clock: () => changedAt,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    reviewCandidate.mockResolvedValue({ status: "SUCCESS" });
  });

  it.each([
    [null, "UNAUTHENTICATED"],
    [actor("USER"), "FORBIDDEN"],
    [actor("ADMIN", "BANNED"), "FORBIDDEN"],
  ] as const)("rejects actor %j with %s", async (identity, status) => {
    await expect(
      review({
        actor: identity,
        candidateId,
        operation: "APPROVE",
        displayTitle: "Approved title",
        publicOrder: 1,
      }),
    ).resolves.toEqual({ status });
    expect(reviewCandidate).not.toHaveBeenCalled();
  });

  it("normalizes approval metadata and sets a 24-hour expiry", async () => {
    await expect(
      review({
        actor: actor("ADMIN"),
        candidateId,
        operation: "APPROVE",
        displayTitle: "  Ｋａｇｕｒａ\u200B   release  ",
        publicOrder: 3,
      }),
    ).resolves.toEqual({ status: "SUCCESS" });
    expect(reviewCandidate).toHaveBeenCalledWith({
      actorUserId: "admin-id",
      candidateId,
      operation: "APPROVE",
      displayTitle: "Kagura release",
      publicOrder: 3,
      changedAt,
      expiresAt: new Date("2026-07-16T08:00:00.000Z"),
    });
  });

  it("normalizes reordered titles without extending expiry", async () => {
    await review({
      actor: actor("ADMIN"),
      candidateId,
      operation: "REORDER",
      displayTitle: "  Curated title  ",
      publicOrder: 9,
    });
    expect(reviewCandidate).toHaveBeenCalledWith({
      actorUserId: "admin-id",
      candidateId,
      operation: "REORDER",
      displayTitle: "Curated title",
      publicOrder: 9,
      changedAt,
    });
  });

  it.each([
    ["", 1],
    ["a".repeat(181), 1],
    ["unsafe\u0000title", 1],
    ["valid", 0],
    ["valid", 1.5],
    ["valid", 1_001],
  ] as const)("rejects invalid public metadata %j / %s", async (displayTitle, publicOrder) => {
    await expect(
      review({
        actor: actor("ADMIN"),
        candidateId,
        operation: "APPROVE",
        displayTitle,
        publicOrder,
      }),
    ).resolves.toEqual({ status: "INVALID_INPUT" });
    expect(reviewCandidate).not.toHaveBeenCalled();
  });

  it.each(["REJECT", "EXPIRE"] as const)(
    "delegates %s without public metadata",
    async (operation) => {
      await review({ actor: actor("ADMIN"), candidateId, operation });
      expect(reviewCandidate).toHaveBeenCalledWith({
        actorUserId: "admin-id",
        candidateId,
        operation,
        changedAt,
      });
    },
  );

  it.each(["CANDIDATE_NOT_FOUND", "INVALID_TRANSITION"] as const)(
    "preserves repository result %s",
    async (status) => {
      reviewCandidate.mockResolvedValueOnce({ status });
      await expect(
        review({ actor: actor("ADMIN"), candidateId, operation: "REJECT" }),
      ).resolves.toEqual({ status });
    },
  );
});
