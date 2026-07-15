"use server";

import { z } from "zod";

import { getCurrentSession } from "../../../server/auth/get-current-session";
import { getDatabase } from "../../../server/database/get-database";
import { createCommentRepository } from "../server/comment-repository";
import { createCommentService } from "../server/comment-service";

export interface CommentActionState {
  readonly status: "IDLE" | "SUCCESS" | "ERROR";
  readonly message?: string;
  readonly fieldErrors?: Readonly<{
    postId?: readonly string[];
    body?: readonly string[];
  }>;
}

const commentActionSchema = z.object({
  postId: z.uuid("文章标识无效"),
  body: z.preprocess(
    (value) => (typeof value === "string" ? value : ""),
    z.string().trim().min(1, "请输入评论内容").max(2_000, "评论不能超过 2000 个字符"),
  ),
});

export async function commentAction(
  _previousState: CommentActionState,
  formData: FormData,
): Promise<CommentActionState> {
  const validation = commentActionSchema.safeParse({
    postId: formData.get("postId"),
    body: formData.get("body"),
  });
  if (!validation.success) {
    const fieldErrors = z.flattenError(validation.error).fieldErrors;
    return {
      status: "ERROR",
      fieldErrors: {
        ...(fieldErrors.postId ? { postId: fieldErrors.postId } : {}),
        ...(fieldErrors.body ? { body: fieldErrors.body } : {}),
      },
    };
  }

  const session = await getCurrentSession();
  const repository = createCommentRepository(getDatabase());
  const submit = createCommentService({
    createPendingComment: repository.createPendingComment,
    clock: () => new Date(),
  });
  const result = await submit({
    actor: session,
    postId: validation.data.postId,
    body: validation.data.body,
  });

  if (result.status === "UNAUTHENTICATED") {
    return { status: "ERROR", message: "登录后可以提交评论" };
  }
  if (result.status === "FORBIDDEN") {
    return { status: "ERROR", message: "当前账号不能提交评论" };
  }
  if (result.status === "POST_NOT_FOUND") {
    return { status: "ERROR", message: "文章不存在或尚未公开" };
  }
  if (result.status === "INVALID_INPUT") {
    return { status: "ERROR", message: "评论内容无效" };
  }
  return { status: "SUCCESS", message: "评论已提交，等待审核" };
}
