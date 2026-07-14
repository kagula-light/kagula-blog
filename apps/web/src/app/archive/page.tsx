import type { Metadata } from "next";
import Link from "next/link";

import { SiteFooter } from "../../components/site/site-footer";
import { SiteHeader } from "../../components/site/site-header";
import { site } from "../../data/site";
import { formatPublicDate } from "../../features/posts/server/public-post-presenter";
import {
  createPublicPostRepository,
  groupPublishedPostsByMonth,
} from "../../features/posts/server/public-post-repository";
import { getDatabase } from "../../server/database/get-database";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: `文章归档 | ${site.name}`,
  description: "按月份浏览神乐静无月公开发布的文章。",
};

export default async function ArchivePage() {
  const posts = await createPublicPostRepository(getDatabase()).listPublished(100);
  const groups = groupPublishedPostsByMonth(posts);

  return (
    <>
      <SiteHeader current="archive" />
      <main id="main-content" className="discovery-page" tabIndex={-1}>
        <nav className="article-breadcrumb" aria-label="面包屑">
          <Link href="/">首页</Link>
          <span aria-hidden="true">/</span>
          <span>文章归档</span>
        </nav>
        <header className="discovery-header">
          <h1>文章归档</h1>
          <p>按照公开时间整理的全部章节。草稿、定时与已归档内容不会出现在这里。</p>
        </header>
        {groups.length > 0 ? (
          <div className="archive-groups">
            {groups.map((group) => (
              <section key={group.key} aria-labelledby={`archive-${group.key}`}>
                <h2 id={`archive-${group.key}`}>{group.label}</h2>
                <ol>
                  {group.posts.map((post) => (
                    <li key={post.id}>
                      <time dateTime={post.publishedAt.toISOString()}>
                        {formatPublicDate(post.publishedAt)}
                      </time>
                      <Link href={`/articles/${post.slug}`}>{post.title}</Link>
                      <span>{post.category.name}</span>
                    </li>
                  ))}
                </ol>
              </section>
            ))}
          </div>
        ) : (
          <div className="public-empty-state">
            <strong>归档仍是空的</strong>
            <p>第一篇公开文章发布后，会自动出现在这里。</p>
          </div>
        )}
      </main>
      <SiteFooter year={new Date().getUTCFullYear()} />
    </>
  );
}
