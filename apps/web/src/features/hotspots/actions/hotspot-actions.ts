"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getCurrentSession } from "../../../server/auth/get-current-session";
import { getDatabase } from "../../../server/database/get-database";
import { createHotspotRepository } from "../server/hotspot-repository";
import { createHotspotReviewService } from "../server/hotspot-review-service";

export interface HotspotActionState {
  readonly status: "IDLE" | "SUCCESS" | "ERROR";
  readonly message?: string;
}

const publicMetadata = {
  displayTitle: z.string().trim().min(1).max(180),
  publicOrder: z.coerce.number().int().min(1).max(1_000),
};
const hotspotReviewSchema = z.discriminatedUnion("operation", [
  z.object({ candidateId: z.uuid(), operation: z.literal("APPROVE"), ...publicMetadata }),
  z.object({ candidateId: z.uuid(), operation: z.literal("REORDER"), ...publicMetadata }),
  z.object({ candidateId: z.uuid(), operation: z.literal("REJECT") }),
  z.object({ candidateId: z.uuid(), operation: z.literal("EXPIRE") }),
]);

const errorMessages = {
  UNAUTHENTICATED: "管理员会话已失效，请重新登录",
  FORBIDDEN: "当前账号无权审核热点",
  CANDIDATE_NOT_FOUND: "热点候选不存在",
  INVALID_TRANSITION: "热点状态已变化，请刷新后重试",
  INVALID_INPUT: "热点审核请求无效",
} as const;

export async function hotspotReviewAction(
  _previousState: HotspotActionState,
  formData: FormData,
): Promise<HotspotActionState> {
  const validation = hotspotReviewSchema.safeParse({
    candidateId: formData.get("candidateId"),
    operation: formData.get("operation"),
    displayTitle: formData.get("displayTitle"),
    publicOrder: formData.get("publicOrder"),
  });
  if (!validation.success) return { status: "ERROR", message: "热点审核请求无效" };

  const actor = await getCurrentSession();
  const repository = createHotspotRepository(getDatabase());
  const review = createHotspotReviewService({
    reviewCandidate: repository.reviewCandidate,
    clock: () => new Date(),
  });
  const result = await review({ actor, ...validation.data });
  if (result.status !== "SUCCESS") {
    return { status: "ERROR", message: errorMessages[result.status] };
  }

  revalidatePath("/");
  revalidatePath("/hotspots");
  revalidatePath("/admin/hotspots");
  return { status: "SUCCESS", message: "热点审核已保存" };
}
