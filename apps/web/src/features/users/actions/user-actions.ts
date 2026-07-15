"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getCurrentSession } from "../../../server/auth/get-current-session";
import { getDatabase } from "../../../server/database/get-database";
import {
  createUserGovernanceService,
  createCommentModerationService,
} from "../server/user-governance-service";
import { createUserRepository } from "../server/user-repository";

export interface GovernanceActionState {
  readonly status: "IDLE" | "SUCCESS" | "ERROR";
  readonly message?: string;
}

const userStatusSchema = z.object({
  targetUserId: z.uuid(),
  targetStatus: z.enum(["ACTIVE", "MUTED", "BANNED"]),
});

const commentModerationSchema = z.object({
  commentId: z.uuid(),
  targetStatus: z.enum(["APPROVED", "REJECTED", "DELETED"]),
});

export async function userStatusAction(
  _previousState: GovernanceActionState,
  formData: FormData,
): Promise<GovernanceActionState> {
  const validation = userStatusSchema.safeParse({
    targetUserId: formData.get("targetUserId"),
    targetStatus: formData.get("targetStatus"),
  });
  if (!validation.success) return { status: "ERROR", message: "用户状态请求无效" };

  const actor = await getCurrentSession();
  const repository = createUserRepository(getDatabase());
  const govern = createUserGovernanceService({
    changeUserStatus: repository.changeUserStatus,
    clock: () => new Date(),
  });
  const result = await govern({ actor, ...validation.data });

  if (result.status === "UNAUTHENTICATED") {
    return { status: "ERROR", message: "管理员会话已失效，请重新登录" };
  }
  if (result.status === "FORBIDDEN") {
    return { status: "ERROR", message: "当前账号无权修改该用户" };
  }
  if (result.status === "SELF_GOVERNANCE") {
    return { status: "ERROR", message: "不能封禁当前管理员账号" };
  }
  if (result.status === "USER_NOT_FOUND") {
    return { status: "ERROR", message: "用户不存在或已被删除" };
  }
  if (result.status === "INVALID_TRANSITION") {
    return { status: "ERROR", message: "用户状态已经变化，请刷新后重试" };
  }

  revalidatePath("/admin/users");
  return { status: "SUCCESS", message: "用户状态已更新" };
}

export async function commentModerationAction(
  _previousState: GovernanceActionState,
  formData: FormData,
): Promise<GovernanceActionState> {
  const validation = commentModerationSchema.safeParse({
    commentId: formData.get("commentId"),
    targetStatus: formData.get("targetStatus"),
  });
  if (!validation.success) return { status: "ERROR", message: "评论审核请求无效" };

  const actor = await getCurrentSession();
  const repository = createUserRepository(getDatabase());
  const moderate = createCommentModerationService({
    moderateComment: repository.moderateComment,
    clock: () => new Date(),
  });
  const result = await moderate({ actor, ...validation.data });

  if (result.status === "UNAUTHENTICATED") {
    return { status: "ERROR", message: "管理员会话已失效，请重新登录" };
  }
  if (result.status === "FORBIDDEN") {
    return { status: "ERROR", message: "当前账号无权审核评论" };
  }
  if (result.status === "COMMENT_NOT_FOUND") {
    return { status: "ERROR", message: "评论不存在或已被删除" };
  }
  if (result.status === "INVALID_TRANSITION") {
    return { status: "ERROR", message: "评论状态已经变化，请刷新后重试" };
  }

  revalidatePath("/admin/comments");
  revalidatePath("/articles/[slug]", "page");
  return { status: "SUCCESS", message: "评论审核状态已更新" };
}
