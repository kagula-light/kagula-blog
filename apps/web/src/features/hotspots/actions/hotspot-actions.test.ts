import { beforeEach, describe, expect, it, vi } from "vitest";

import type { HotspotReviewInput, HotspotReviewResult } from "../server/hotspot-review-service";
import { hotspotReviewAction, type HotspotActionState } from "./hotspot-actions";

const candidateId = "0190f3c2-5710-7aca-b167-8f4b28ad77c3";
const session = {
  id: "admin-id",
  role: "ADMIN" as const,
  status: "ACTIVE" as const,
  sessionId: "session-id",
  username: "admin",
  displayName: "Administrator",
};
const mocks = vi.hoisted(() => ({
  getCurrentSession: vi.fn(),
  review: vi.fn<(input: HotspotReviewInput) => Promise<HotspotReviewResult>>(),
  revalidatePath: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("../../../server/auth/get-current-session", () => ({
  getCurrentSession: mocks.getCurrentSession,
}));
vi.mock("../../../server/database/get-database", () => ({
  getDatabase: vi.fn(() => ({ kind: "database" })),
}));
vi.mock("../server/hotspot-repository", () => ({
  createHotspotRepository: vi.fn(() => ({ reviewCandidate: vi.fn() })),
}));
vi.mock("../server/hotspot-review-service", async (importOriginal) => {
  const original = await importOriginal<typeof import("../server/hotspot-review-service")>();
  return { ...original, createHotspotReviewService: vi.fn(() => mocks.review) };
});

const initialState: HotspotActionState = { status: "IDLE" };

function createForm(
  operation: "APPROVE" | "REJECT" | "EXPIRE" | "REORDER",
  overrides: Readonly<{
    candidateId?: string;
    displayTitle?: string;
    publicOrder?: string;
  }> = {},
): FormData {
  const form = new FormData();
  form.set("candidateId", overrides.candidateId ?? candidateId);
  form.set("operation", operation);
  if (operation === "APPROVE" || operation === "REORDER") {
    form.set("displayTitle", overrides.displayTitle ?? "Curated title");
    form.set("publicOrder", overrides.publicOrder ?? "4");
  }
  return form;
}

describe("hotspotReviewAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCurrentSession.mockResolvedValue(session);
    mocks.review.mockResolvedValue({ status: "SUCCESS" });
  });

  it("returns validation errors before resolving the administrator session", async () => {
    await expect(
      hotspotReviewAction(
        initialState,
        createForm("APPROVE", { candidateId: "bad", displayTitle: "", publicOrder: "0" }),
      ),
    ).resolves.toEqual({ status: "ERROR", message: "热点审核请求无效" });
    expect(mocks.getCurrentSession).not.toHaveBeenCalled();
  });

  it("delegates a parsed approval command", async () => {
    await hotspotReviewAction(initialState, createForm("APPROVE"));
    expect(mocks.review).toHaveBeenCalledWith({
      actor: session,
      candidateId,
      operation: "APPROVE",
      displayTitle: "Curated title",
      publicOrder: 4,
    });
  });

  it.each(["REJECT", "EXPIRE"] as const)(
    "delegates %s without public metadata",
    async (operation) => {
      await hotspotReviewAction(initialState, createForm(operation));
      expect(mocks.review).toHaveBeenCalledWith({ actor: session, candidateId, operation });
    },
  );

  it.each([
    ["UNAUTHENTICATED", "管理员会话已失效，请重新登录"],
    ["FORBIDDEN", "当前账号无权审核热点"],
    ["CANDIDATE_NOT_FOUND", "热点候选不存在"],
    ["INVALID_TRANSITION", "热点状态已变化，请刷新后重试"],
    ["INVALID_INPUT", "热点审核请求无效"],
  ] as const)("maps %s to a safe message", async (status, message) => {
    if (status === "UNAUTHENTICATED") mocks.getCurrentSession.mockResolvedValue(null);
    mocks.review.mockResolvedValue({ status });
    await expect(hotspotReviewAction(initialState, createForm("REJECT"))).resolves.toEqual({
      status: "ERROR",
      message,
    });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("revalidates every current hotspot surface after success", async () => {
    await expect(hotspotReviewAction(initialState, createForm("REORDER"))).resolves.toEqual({
      status: "SUCCESS",
      message: "热点审核已保存",
    });
    expect(mocks.revalidatePath.mock.calls).toEqual([["/"], ["/hotspots"], ["/admin/hotspots"]]);
  });
});
