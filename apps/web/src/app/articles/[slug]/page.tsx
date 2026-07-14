import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";

import { ArticleLayout } from "../../../components/article/article-layout";
import { SiteFooter } from "../../../components/site/site-footer";
import { SiteHeader } from "../../../components/site/site-header";
import { site } from "../../../data/site";
import { extractHeadingOutline } from "../../../features/posts/server/markdown";
import {
  getPublicPostCoverUrl,
  selectAdjacentPosts,
} from "../../../features/posts/server/public-post-presenter";
import { createPublicPostRepository } from "../../../features/posts/server/public-post-repository";
import { createReactionRepository } from "../../../features/reactions/server/reaction-repository";
import { getCurrentSession } from "../../../server/auth/get-current-session";
import { getServerEnv } from "../../../server/config/env";
import { getDatabase } from "../../../server/database/get-database";

export const dynamic = "force-dynamic";

interface ArticlePageProps {
  readonly params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: ArticlePageProps): Promise<Metadata> {
  const { slug } = await params;
  const repository = createPublicPostRepository(getDatabase());
  const resolution = await repository.resolveSlug(slug);
  if (resolution.kind !== "POST") return { title: `文章未找到 | ${site.name}` };
  const env = getServerEnv();
  const post = resolution.post;
  const canonical = new URL(`/articles/${post.slug}`, env.APP_URL);
  const coverUrl = getPublicPostCoverUrl(post, env.R2_PUBLIC_BASE_URL);

  return {
    title: `${post.seoTitle ?? post.title} | ${site.name}`,
    description: post.seoDescription ?? post.excerpt,
    alternates: { canonical },
    openGraph: {
      type: "article",
      title: post.seoTitle ?? post.title,
      description: post.seoDescription ?? post.excerpt,
      url: canonical,
      publishedTime: post.publishedAt.toISOString(),
      modifiedTime: post.updatedAt.toISOString(),
      authors: [site.author],
      images: [{ url: new URL(coverUrl, env.APP_URL).toString() }],
    },
  };
}

export default async function ArticlePage({ params }: ArticlePageProps) {
  const { slug } = await params;
  const repository = createPublicPostRepository(getDatabase());
  const resolution = await repository.resolveSlug(slug);
  if (resolution.kind === "REDIRECT") permanentRedirect(`/articles/${resolution.slug}`);
  if (resolution.kind === "NOT_FOUND") notFound();

  const env = getServerEnv();
  const post = resolution.post;
  const [posts, session] = await Promise.all([repository.listPublished(100), getCurrentSession()]);
  const reactions = await createReactionRepository(getDatabase()).getSummary(
    post.id,
    session?.id ?? null,
  );
  const canonicalUrl = new URL(`/articles/${post.slug}`, env.APP_URL).toString();
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.seoDescription ?? post.excerpt,
    datePublished: post.publishedAt.toISOString(),
    dateModified: post.updatedAt.toISOString(),
    author: { "@type": "Person", name: site.author },
    mainEntityOfPage: canonicalUrl,
    image: new URL(getPublicPostCoverUrl(post, env.R2_PUBLIC_BASE_URL), env.APP_URL).toString(),
  };

  return (
    <>
      <SiteHeader current="articles" />
      <ArticleLayout
        post={post}
        coverUrl={getPublicPostCoverUrl(post, env.R2_PUBLIC_BASE_URL)}
        outline={extractHeadingOutline(post.renderedHtml)}
        adjacent={selectAdjacentPosts(posts, post.id)}
        reactions={reactions}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structuredData).replaceAll("<", "\\u003c"),
        }}
      />
      <SiteFooter year={new Date().getUTCFullYear()} />
    </>
  );
}
