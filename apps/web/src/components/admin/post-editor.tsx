"use client";

import { useActionState } from "react";

import { postAction } from "../../features/posts/actions/post-actions";
import type { PostActionState } from "../../features/posts/actions/post-action-state";
import type { PostEditorData, TaxonomyItem } from "../../features/posts/server/post-repository";

interface PostEditorProps {
  readonly post: PostEditorData | null;
  readonly categories: readonly TaxonomyItem[];
  readonly tags: readonly TaxonomyItem[];
}

const initialState: PostActionState = { status: "IDLE" };

function dateTimeValue(value: Date | null): string {
  return value ? value.toISOString().slice(0, 16) : "";
}

export function PostEditor({ post, categories, tags }: PostEditorProps) {
  const [state, formAction, pending] = useActionState(postAction, initialState);
  const isNew = post === null;

  return (
    <form className="post-editor" action={formAction}>
      {post ? <input type="hidden" name="postId" value={post.id} /> : null}
      {post ? <input type="hidden" name="expectedVersion" value={post.version} /> : null}

      <div className="post-editor-toolbar">
        <div>
          <p className="admin-eyebrow">{isNew ? "新建文章" : "编辑文章"}</p>
          <h1>{isNew ? "写下新的章节" : post.title}</h1>
        </div>
        <div className="post-editor-toolbar-actions">
          {!isNew ? (
            <a className="secondary-button" href={`/admin/posts/${post.id}/preview`}>
              预览
            </a>
          ) : null}
          <button
            className="secondary-button"
            name="command"
            value={isNew ? "CREATE_DRAFT" : "SAVE"}
            disabled={pending}
            type="submit"
          >
            {pending ? "保存中" : "保存草稿"}
          </button>
          {!isNew && post.status !== "PUBLISHED" ? (
            <button
              className="primary-button post-editor-publish"
              name="command"
              value="PUBLISH"
              disabled={pending}
              type="submit"
            >
              发布
            </button>
          ) : null}
          {!isNew && post.status === "DRAFT" ? (
            <button
              className="secondary-button"
              name="command"
              value="SCHEDULE"
              disabled={pending}
              type="submit"
            >
              排期
            </button>
          ) : null}
          {!isNew && post.status === "SCHEDULED" ? (
            <button
              className="secondary-button"
              name="command"
              value="RETURN_TO_DRAFT"
              disabled={pending}
              type="submit"
            >
              撤回草稿
            </button>
          ) : null}
          {!isNew && post.status === "PUBLISHED" ? (
            <button
              className="secondary-button"
              name="command"
              value="ARCHIVE"
              disabled={pending}
              type="submit"
            >
              归档
            </button>
          ) : null}
        </div>
      </div>

      {state.status === "ERROR" ? (
        <p className="form-error" role="alert">
          {state.message ?? "请修正表单中的问题"}
        </p>
      ) : null}

      <div className="post-editor-grid">
        <div className="post-editor-main">
          <label className="admin-field">
            <span>标题</span>
            <input name="title" defaultValue={post?.title ?? ""} required />
            {state.fieldErrors?.title ? <small>{state.fieldErrors.title[0]}</small> : null}
          </label>
          <label className="admin-field">
            <span>文章路径</span>
            <input name="slug" defaultValue={post?.slug ?? ""} required />
            {state.fieldErrors?.slug ? <small>{state.fieldErrors.slug[0]}</small> : null}
          </label>
          <label className="admin-field">
            <span>摘要</span>
            <textarea name="excerpt" defaultValue={post?.excerpt ?? ""} rows={3} required />
            {state.fieldErrors?.excerpt ? <small>{state.fieldErrors.excerpt[0]}</small> : null}
          </label>
          <label className="admin-field">
            <span>Markdown 正文</span>
            <textarea
              className="post-markdown-input"
              name="markdown"
              defaultValue={post?.markdown ?? ""}
              rows={24}
              required
            />
            {state.fieldErrors?.markdown ? <small>{state.fieldErrors.markdown[0]}</small> : null}
          </label>
        </div>

        <aside className="post-editor-sidebar" aria-label="文章设置">
          <fieldset className="admin-fieldset">
            <legend>发布设置</legend>
            <label className="admin-field">
              <span>分类</span>
              <select
                name="categoryId"
                defaultValue={post?.categoryId ?? categories[0]?.id ?? ""}
                required
              >
                <option value="" disabled>
                  选择分类
                </option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="admin-field">
              <span>定时发布时间（UTC）</span>
              <input
                name="scheduledFor"
                type="datetime-local"
                defaultValue={dateTimeValue(post?.scheduledFor ?? null)}
              />
            </label>
          </fieldset>

          <fieldset className="admin-fieldset">
            <legend>标签</legend>
            <div className="admin-tag-list">
              {tags.map((tag) => (
                <label key={tag.id} className="admin-check">
                  <input
                    name="tagIds"
                    type="checkbox"
                    value={tag.id}
                    defaultChecked={post?.tagIds.includes(tag.id)}
                  />
                  <span>{tag.name}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <label className="admin-field">
            <span>手动 AI 摘要</span>
            <textarea name="aiSummary" defaultValue={post?.aiSummary ?? ""} rows={5} />
          </label>
          <label className="admin-field">
            <span>SEO 标题</span>
            <input name="seoTitle" defaultValue={post?.seoTitle ?? ""} />
          </label>
          <label className="admin-field">
            <span>SEO 描述</span>
            <textarea name="seoDescription" defaultValue={post?.seoDescription ?? ""} rows={3} />
          </label>
        </aside>
      </div>
    </form>
  );
}
