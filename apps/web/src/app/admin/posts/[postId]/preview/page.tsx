import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { createPostRepository } from "../../../../../features/posts/server/post-repository";
import { getDatabase } from "../../../../../server/database/get-database";
import { site } from "../../../../../data/site";

interface PreviewPostPageProps {
  readonly params: Promise<{ postId: string }>;
}

export async function generateMetadata({ params }: PreviewPostPageProps): Promise<Metadata> {
  const { postId } = await params;
  const post = await createPostRepository(getDatabase()).findPostEditor(postId);
  return { title: post ? `预览：${post.title} | ${site.name}` : `预览文章 | ${site.name}` };
}

export default async function PreviewPostPage({ params }: PreviewPostPageProps) {
  const { postId } = await params;
  const post = await createPostRepository(getDatabase()).findPostEditor(postId);
  if (!post) notFound();
  return (
    <article className="admin-preview" aria-labelledby="preview-title">
      <div className="admin-preview-meta">
        <a href={`/admin/posts/${post.id}/edit`}>返回编辑</a>
        <span>{post.status}</span>
      </div>
      <p className="admin-eyebrow">文章预览</p>
      <h1 id="preview-title">{post.title}</h1>
      <p className="admin-preview-excerpt">{post.excerpt}</p>
      <div
        className="post-rendered-content"
        dangerouslySetInnerHTML={{ __html: post.renderedHtml }}
      />
    </article>
  );
}
