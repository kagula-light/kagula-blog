import type { Metadata } from "next";

import { PostList } from "../../../components/admin/post-list";
import { createPostRepository } from "../../../features/posts/server/post-repository";
import { getDatabase } from "../../../server/database/get-database";
import { site } from "../../../data/site";

export const metadata: Metadata = { title: `文章 | ${site.name}` };

export default async function AdminPostsPage() {
  const posts = await createPostRepository(getDatabase()).listPosts();
  return (
    <section className="admin-content-page" aria-labelledby="posts-title">
      <div className="admin-page-heading">
        <div>
          <p className="admin-eyebrow">内容工作台</p>
          <h1 id="posts-title">文章</h1>
          <p>管理 Markdown 草稿、排期与已发布内容。</p>
        </div>
        <a className="primary-button admin-link-button" href="/admin/posts/new">
          新建文章
        </a>
      </div>
      <PostList posts={posts} />
    </section>
  );
}
