import type { Metadata } from "next";

import { DiscoveryPage } from "../../../components/site/discovery-page";
import type { PostStreamItem } from "../../../components/site/post-stream";
import { site } from "../../../data/site";
import { getPublicPostCoverUrl } from "../../../features/posts/server/public-post-presenter";
import { createPublicPostRepository } from "../../../features/posts/server/public-post-repository";
import { getServerEnv } from "../../../server/config/env";
import { getDatabase } from "../../../server/database/get-database";

export const dynamic = "force-dynamic";

interface CategoryPageProps {
  readonly params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: CategoryPageProps): Promise<Metadata> {
  const { slug } = await params;
  return { title: `分类：${slug} | ${site.name}`, robots: { index: true, follow: true } };
}

export default async function CategoryPage({ params }: CategoryPageProps) {
  const { slug } = await params;
  const env = getServerEnv();
  const posts = await createPublicPostRepository(getDatabase()).listByCategory(slug);
  const categoryName = posts[0]?.category.name ?? slug;
  const items: PostStreamItem[] = posts.map((post) => ({
    post,
    coverUrl: getPublicPostCoverUrl(post, env.R2_PUBLIC_BASE_URL),
  }));

  return (
    <DiscoveryPage
      title={`分类：${categoryName}`}
      description="同一主题下公开发布的文章。"
      items={items}
      emptyMessage="这个分类下暂时没有公开文章。"
    />
  );
}
