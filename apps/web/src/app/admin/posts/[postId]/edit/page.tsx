import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PostEditor } from "../../../../../components/admin/post-editor";
import { createPostRepository } from "../../../../../features/posts/server/post-repository";
import { getDatabase } from "../../../../../server/database/get-database";
import { site } from "../../../../../data/site";

interface EditPostPageProps {
  readonly params: Promise<{ postId: string }>;
}

export async function generateMetadata({ params }: EditPostPageProps): Promise<Metadata> {
  const { postId } = await params;
  const post = await createPostRepository(getDatabase()).findPost(postId);
  return { title: post ? `编辑：${post.slug} | ${site.name}` : `编辑文章 | ${site.name}` };
}

export default async function EditPostPage({ params }: EditPostPageProps) {
  const { postId } = await params;
  const repository = createPostRepository(getDatabase());
  const [post, categories, tags] = await Promise.all([
    repository.findPostEditor(postId),
    repository.listCategories(),
    repository.listTags(),
  ]);
  if (!post) notFound();
  return <PostEditor post={post} categories={categories} tags={tags} />;
}
