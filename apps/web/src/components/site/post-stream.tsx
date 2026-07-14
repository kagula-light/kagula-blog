import Image from "next/image";
import Link from "next/link";

import { formatPublicDate } from "../../features/posts/server/public-post-presenter";
import type { PublicPostSummary } from "../../features/posts/server/public-post-repository";

export interface PostStreamItem {
  readonly post: PublicPostSummary;
  readonly coverUrl: string;
}

interface PostStreamProps {
  readonly items: readonly PostStreamItem[];
  readonly emptyMessage?: string;
}

export function PostStream({
  items,
  emptyMessage = "这片星图中还没有公开文章。",
}: PostStreamProps) {
  if (items.length === 0) {
    return (
      <div className="public-empty-state">
        <strong>尚无可读章节</strong>
        <p>{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="post-stream">
      {items.map(({ post, coverUrl }) => (
        <article key={post.id} className="post-stream-item">
          <Link className="post-stream-image" href={`/articles/${post.slug}`} tabIndex={-1}>
            <Image
              src={coverUrl}
              alt={post.cover?.altText ?? ""}
              fill
              sizes="(max-width: 640px) 34vw, 240px"
            />
          </Link>
          <div className="post-stream-copy">
            <div className="post-meta-line">
              <Link href={`/categories/${post.category.slug}`}>{post.category.name}</Link>
              <time dateTime={post.publishedAt.toISOString()}>
                {formatPublicDate(post.publishedAt)}
              </time>
            </div>
            <h3>
              <Link href={`/articles/${post.slug}`}>{post.title}</Link>
            </h3>
            <p>{post.excerpt}</p>
            {post.tags.length > 0 ? (
              <ul className="post-tag-list" aria-label="文章标签">
                {post.tags.slice(0, 3).map((tag) => (
                  <li key={tag.slug}>
                    <Link href={`/tags/${tag.slug}`}>#{tag.name}</Link>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </article>
      ))}
    </div>
  );
}
