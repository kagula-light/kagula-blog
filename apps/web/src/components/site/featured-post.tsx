import Image from "next/image";
import Link from "next/link";

import { formatPublicDate } from "../../features/posts/server/public-post-presenter";
import type { PublicPostSummary } from "../../features/posts/server/public-post-repository";

interface FeaturedPostProps {
  readonly post: PublicPostSummary;
  readonly coverUrl: string;
}

export function FeaturedPost({ post, coverUrl }: FeaturedPostProps) {
  return (
    <article className="featured-post">
      <Link className="featured-post-image" href={`/articles/${post.slug}`} tabIndex={-1}>
        <Image
          src={coverUrl}
          alt={post.cover?.altText ?? `${post.title}的文章封面`}
          fill
          priority
          sizes="(max-width: 768px) 100vw, 58vw"
        />
      </Link>
      <div className="featured-post-copy">
        <div className="post-meta-line">
          <Link href={`/categories/${post.category.slug}`}>{post.category.name}</Link>
          <time dateTime={post.publishedAt.toISOString()}>
            {formatPublicDate(post.publishedAt)}
          </time>
          <span>{post.readingMinutes} 分钟阅读</span>
        </div>
        <h2>
          <Link href={`/articles/${post.slug}`}>{post.title}</Link>
        </h2>
        <p>{post.excerpt}</p>
        <Link className="featured-post-enter" href={`/articles/${post.slug}`}>
          阅读这一章 <span aria-hidden="true">→</span>
        </Link>
      </div>
    </article>
  );
}
