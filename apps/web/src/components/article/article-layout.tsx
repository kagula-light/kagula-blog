import Image from "next/image";
import Link from "next/link";

import type { HeadingOutlineItem } from "../../features/posts/server/markdown";
import { formatPublicDate } from "../../features/posts/server/public-post-presenter";
import type { AdjacentPosts } from "../../features/posts/server/public-post-presenter";
import type { PublicPostDetail } from "../../features/posts/server/public-post-repository";
import type { ReactionSummary } from "../../features/reactions/server/reaction-repository";
import { ArticleToc } from "./article-toc";
import { PostActions } from "./post-actions";

interface ArticleLayoutProps {
  readonly post: PublicPostDetail;
  readonly coverUrl: string;
  readonly outline: readonly HeadingOutlineItem[];
  readonly adjacent: AdjacentPosts;
  readonly reactions: ReactionSummary;
}

export function ArticleLayout({
  post,
  coverUrl,
  outline,
  adjacent,
  reactions,
}: ArticleLayoutProps) {
  return (
    <main id="main-content" className="article-page" tabIndex={-1}>
      <nav className="article-breadcrumb" aria-label="面包屑">
        <Link href="/">首页</Link>
        <span aria-hidden="true">/</span>
        <Link href={`/categories/${post.category.slug}`}>{post.category.name}</Link>
      </nav>

      <article>
        <header className="article-header">
          <div className="post-meta-line">
            <Link href={`/categories/${post.category.slug}`}>{post.category.name}</Link>
            <time dateTime={post.publishedAt.toISOString()}>
              {formatPublicDate(post.publishedAt)}
            </time>
            <span>{post.readingMinutes} 分钟阅读</span>
          </div>
          <h1>{post.title}</h1>
          <p>{post.excerpt}</p>
        </header>

        <div className="article-cover">
          <Image
            src={coverUrl}
            alt={post.cover?.altText ?? `${post.title}的文章封面`}
            fill
            priority
            sizes="(max-width: 768px) 100vw, 1200px"
          />
        </div>

        <div className="article-reading-grid">
          <div className="article-main-column">
            <ArticleToc items={outline} variant="mobile" />
            {post.aiSummary ? (
              <section className="article-summary" aria-labelledby="article-summary-title">
                <h2 id="article-summary-title">本章摘要</h2>
                <p>{post.aiSummary}</p>
              </section>
            ) : null}
            <div
              className="post-rendered-content article-prose"
              dangerouslySetInnerHTML={{ __html: post.renderedHtml }}
            />
            <footer className="article-footer">
              {post.tags.length > 0 ? (
                <ul className="post-tag-list" aria-label="文章标签">
                  {post.tags.map((tag) => (
                    <li key={tag.slug}>
                      <Link href={`/tags/${tag.slug}`}>#{tag.name}</Link>
                    </li>
                  ))}
                </ul>
              ) : null}
              <p>除特别说明外，本站原创内容采用 CC BY-NC-SA 4.0 许可。</p>
            </footer>
            <PostActions
              postId={post.id}
              initialSummary={reactions}
              loginHref={`/login?next=${encodeURIComponent(`/articles/${post.slug}`)}`}
            />
            <nav className="article-adjacent" aria-label="相邻文章">
              <div>
                <span>上一篇</span>
                {adjacent.newer ? (
                  <Link href={`/articles/${adjacent.newer.slug}`}>{adjacent.newer.title}</Link>
                ) : (
                  <p>已经是最新章节</p>
                )}
              </div>
              <div>
                <span>下一篇</span>
                {adjacent.older ? (
                  <Link href={`/articles/${adjacent.older.slug}`}>{adjacent.older.title}</Link>
                ) : (
                  <p>已经抵达书库起点</p>
                )}
              </div>
            </nav>
          </div>

          <aside className="article-side-column" aria-label="作者与目录">
            <section className="author-note">
              <Image src="/brand/kagura-avatar.webp" alt="" width={88} height={88} />
              <div>
                <p>执笔者</p>
                <h2>神乐静无月</h2>
              </div>
              <p>记录代码如何运转，也记录人在代码之外如何生活。</p>
            </section>
            <ArticleToc items={outline} variant="desktop" />
          </aside>
        </div>
      </article>
    </main>
  );
}
