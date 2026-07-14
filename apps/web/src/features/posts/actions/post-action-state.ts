import { z } from "zod";

import { normalizePostSlug } from "../domain/post-state";
import type { EditablePostContent } from "../server/post-service";

export type PostActionCommand =
  "CREATE_DRAFT" | "SAVE" | "PUBLISH" | "SCHEDULE" | "ARCHIVE" | "RETURN_TO_DRAFT";

export interface PostActionState {
  readonly status: "IDLE" | "ERROR";
  readonly message?: string;
  readonly fieldErrors?: Readonly<Record<string, readonly string[]>>;
}

export interface ValidPostActionInput {
  readonly command: PostActionCommand;
  readonly postId: string | null;
  readonly expectedVersion: number | null;
  readonly scheduledFor: Date | null;
  readonly content: EditablePostContent;
}

export type PostActionValidation =
  | { readonly success: true; readonly data: ValidPostActionInput }
  | { readonly success: false; readonly state: PostActionState };

const nullableString = (maximumLength: number) =>
  z.preprocess(
    (value) => (typeof value === "string" && value.trim() ? value : null),
    z.string().max(maximumLength).nullable(),
  );

const nullableUuid = z.preprocess(
  (value) => (typeof value === "string" && value.trim() ? value : null),
  z.uuid().nullable(),
);

const postActionSchema = z
  .object({
    command: z.enum(["CREATE_DRAFT", "SAVE", "PUBLISH", "SCHEDULE", "ARCHIVE", "RETURN_TO_DRAFT"]),
    postId: nullableUuid,
    expectedVersion: z.preprocess(
      (value) => (typeof value === "string" && value.trim() ? value : null),
      z.coerce.number().int().positive().nullable(),
    ),
    scheduledFor: z.preprocess(
      (value) => (typeof value === "string" && value.trim() ? value : null),
      z.coerce.date().nullable(),
    ),
    title: z.string().trim().min(1, "请输入文章标题").max(200, "标题不能超过 200 个字符"),
    slug: z
      .string()
      .trim()
      .refine(
        (value) => {
          try {
            normalizePostSlug(value);
            return true;
          } catch {
            return false;
          }
        },
        { message: "请输入有效的文章路径" },
      ),
    excerpt: z.string().trim().min(1, "请输入文章摘要").max(1_000, "摘要不能超过 1000 个字符"),
    markdown: z
      .string()
      .trim()
      .min(1, "请输入 Markdown 正文")
      .max(1_000_000, "正文不能超过 1000000 个字符"),
    aiSummary: nullableString(2_000),
    categoryId: z.uuid("请选择有效分类"),
    tagIds: z.array(z.uuid("标签无效")).max(30, "标签不能超过 30 个"),
    coverMediaId: nullableUuid,
    seoTitle: nullableString(200),
    seoDescription: nullableString(320),
    socialMediaId: nullableUuid,
  })
  .superRefine((value, context) => {
    if (value.command !== "CREATE_DRAFT") {
      if (!value.postId) {
        context.addIssue({ code: "custom", path: ["postId"], message: "文章标识无效" });
      }
      if (!value.expectedVersion) {
        context.addIssue({ code: "custom", path: ["expectedVersion"], message: "文章版本无效" });
      }
    }
    if (value.command === "SCHEDULE" && !value.scheduledFor) {
      context.addIssue({ code: "custom", path: ["scheduledFor"], message: "请选择发布时间" });
    }
  });

export function validatePostActionInput(formData: FormData): PostActionValidation {
  const result = postActionSchema.safeParse({
    command: formData.get("command"),
    postId: formData.get("postId"),
    expectedVersion: formData.get("expectedVersion"),
    scheduledFor: formData.get("scheduledFor"),
    title: formData.get("title"),
    slug: formData.get("slug"),
    excerpt: formData.get("excerpt"),
    markdown: formData.get("markdown"),
    aiSummary: formData.get("aiSummary"),
    categoryId: formData.get("categoryId"),
    tagIds: formData.getAll("tagIds"),
    coverMediaId: formData.get("coverMediaId"),
    seoTitle: formData.get("seoTitle"),
    seoDescription: formData.get("seoDescription"),
    socialMediaId: formData.get("socialMediaId"),
  });

  if (!result.success) {
    return {
      success: false,
      state: {
        status: "ERROR",
        fieldErrors: z.flattenError(result.error).fieldErrors,
      },
    };
  }

  return {
    success: true,
    data: {
      command: result.data.command,
      postId: result.data.postId,
      expectedVersion: result.data.expectedVersion,
      scheduledFor: result.data.scheduledFor,
      content: {
        title: result.data.title,
        slug: result.data.slug,
        excerpt: result.data.excerpt,
        markdown: result.data.markdown,
        aiSummary: result.data.aiSummary,
        categoryId: result.data.categoryId,
        tagIds: result.data.tagIds,
        coverMediaId: result.data.coverMediaId,
        seoTitle: result.data.seoTitle,
        seoDescription: result.data.seoDescription,
        socialMediaId: result.data.socialMediaId,
      },
    },
  };
}
