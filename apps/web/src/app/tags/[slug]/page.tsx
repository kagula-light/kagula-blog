import type { Metadata } from "next";

import { DiscoveryPage } from "../../../components/site/discovery-page";
import type { PostStreamItem } from "../../../components/site/post-stream";
import { site } from "../../../data/site";
import { getPublicPostCoverUrl } from "../../../features/posts/server/public-post-presenter";
import { createPublicPostRepository } from "../../../features/posts/server/public-post-repository";
import { getServerEnv } from "../../../server/config/env";
import { getDatabase } from "../../../server/database/get-database";

export const dynamic = "force-dynamic";

interface TagPageProps {
  readonly params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: TagPageProps): Promise<Metadata> {
  const { slug } = await params;
  return { title: `标签：${slug} | ${site.name}` };
}

export default async function TagPage({ params }: TagPageProps) {
  const { slug } = await params;
  const env = getServerEnv();
  const posts = await createPublicPostRepository(getDatabase()).listByTag(slug);
  const tagName = posts.flatMap((post) => post.tags).find((tag) => tag.slug === slug)?.name ?? slug;
  const items: PostStreamItem[] = posts.map((post) => ({
    post,
    coverUrl: getPublicPostCoverUrl(post, env.R2_PUBLIC_BASE_URL),
  }));

  return (
    <DiscoveryPage
      title={`标签：${tagName}`}
      description="沿着这枚标签继续阅读。"
      items={items}
      emptyMessage="这枚标签下暂时没有公开文章。"
    />
  );
}
