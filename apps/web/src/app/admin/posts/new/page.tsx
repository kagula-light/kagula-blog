import type { Metadata } from "next";

import { PostEditor } from "../../../../components/admin/post-editor";
import { createPostRepository } from "../../../../features/posts/server/post-repository";
import { getDatabase } from "../../../../server/database/get-database";
import { site } from "../../../../data/site";

export const metadata: Metadata = { title: `新建文章 | ${site.name}` };

export default async function NewPostPage() {
  const repository = createPostRepository(getDatabase());
  const [categories, tags] = await Promise.all([
    repository.listCategories(),
    repository.listTags(),
  ]);
  return <PostEditor post={null} categories={categories} tags={tags} />;
}
