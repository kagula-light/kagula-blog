"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getCurrentSession } from "../../../server/auth/get-current-session";
import { getDatabase } from "../../../server/database/get-database";
import { renderMarkdown } from "../server/markdown";
import { createPostRepository } from "../server/post-repository";
import { createPostService } from "../server/post-service";
import { type PostActionState, validatePostActionInput } from "./post-action-state";

const targetStatusByCommand = {
  PUBLISH: "PUBLISHED",
  SCHEDULE: "SCHEDULED",
  ARCHIVE: "ARCHIVED",
  RETURN_TO_DRAFT: "DRAFT",
} as const;

export async function postAction(
  _previousState: PostActionState,
  formData: FormData,
): Promise<PostActionState> {
  const validation = validatePostActionInput(formData);
  if (!validation.success) return validation.state;

  const session = await getCurrentSession();
  if (!session) return { status: "ERROR", message: "请先登录管理员账号" };

  const repository = createPostRepository(getDatabase());
  const service = createPostService({
    ...repository,
    renderMarkdown,
    clock: () => new Date(),
  });
  const { data } = validation;

  let result;
  try {
    if (data.command === "CREATE_DRAFT") {
      result = await service.createDraft(session, data.content);
    } else {
      result = await service.update(session, {
        postId: data.postId as string,
        expectedVersion: data.expectedVersion as number,
        content: data.content,
        ...(data.command === "SCHEDULE" ? { scheduledFor: data.scheduledFor } : {}),
        ...(data.command in targetStatusByCommand
          ? {
              targetStatus:
                targetStatusByCommand[data.command as keyof typeof targetStatusByCommand],
            }
          : {}),
      });
    }
  } catch (error) {
    if (error instanceof Error && /version|stale/i.test(error.message)) {
      return { status: "ERROR", message: "文章已被其他操作更新，请刷新后重试" };
    }
    return { status: "ERROR", message: "文章保存失败，请检查内容后重试" };
  }

  revalidatePath("/admin/posts");
  revalidatePath(`/admin/posts/${result.id}/edit`);
  revalidatePath(`/admin/posts/${result.id}/preview`);
  redirect(`/admin/posts/${result.id}/edit?saved=1`);
}
