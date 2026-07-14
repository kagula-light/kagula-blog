"use server";

import { z } from "zod";

import { getCurrentSession } from "../../../server/auth/get-current-session";
import { getDatabase } from "../../../server/database/get-database";
import { createReactionRepository } from "../server/reaction-repository";
import { createReactionService, type ReactionCommand } from "../server/reaction-service";

export interface ReactionActionState {
  readonly status: "IDLE" | "SUCCESS" | "ERROR";
  readonly command?: ReactionCommand;
  readonly active?: boolean;
  readonly count?: number;
  readonly message?: string;
}

const reactionActionSchema = z.object({
  postId: z.uuid(),
  command: z.enum(["LIKE", "UNLIKE", "FAVORITE", "UNFAVORITE"]),
});

export async function reactionAction(
  _previousState: ReactionActionState,
  formData: FormData,
): Promise<ReactionActionState> {
  const validation = reactionActionSchema.safeParse({
    postId: formData.get("postId"),
    command: formData.get("command"),
  });
  if (!validation.success) return { status: "ERROR", message: "互动请求无效" };

  const session = await getCurrentSession();
  const repository = createReactionRepository(getDatabase());
  const react = createReactionService({ mutateReaction: repository.mutateReaction });
  const result = await react({
    actor: session,
    postId: validation.data.postId,
    command: validation.data.command,
  });

  if (result.status === "UNAUTHENTICATED") {
    return { status: "ERROR", message: "登录后可以点赞和收藏" };
  }
  if (result.status === "FORBIDDEN") {
    return { status: "ERROR", message: "当前账号不能执行此操作" };
  }
  if (result.status === "POST_NOT_FOUND") {
    return { status: "ERROR", message: "文章不存在或尚未公开" };
  }
  return {
    status: "SUCCESS",
    command: validation.data.command,
    active: result.active,
    count: result.count,
  };
}
