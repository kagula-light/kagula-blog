import type { Metadata } from "next";

import { DiscoveryPage } from "../../components/site/discovery-page";
import type { PostStreamItem } from "../../components/site/post-stream";
import { site } from "../../data/site";
import { getPublicPostCoverUrl } from "../../features/posts/server/public-post-presenter";
import {
  createPublicPostRepository,
  type PublicPostSummary,
} from "../../features/posts/server/public-post-repository";
import { getServerEnv } from "../../server/config/env";
import { getDatabase } from "../../server/database/get-database";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: `搜索 | ${site.name}`, robots: { index: false } };

interface SearchPageProps {
  readonly searchParams: Promise<{ q?: string | readonly string[] }>;
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const rawQuery = (await searchParams).q;
  const query = typeof rawQuery === "string" ? rawQuery : (rawQuery?.[0] ?? "");
  const env = getServerEnv();
  let posts: readonly PublicPostSummary[] = [];
  let message = "输入关键词后开始寻找公开文章。";
  try {
    posts = query ? [...(await createPublicPostRepository(getDatabase()).search(query))] : [];
    if (query) message = `没有找到与“${query}”相关的公开文章。`;
  } catch {
    message = "关键词过长，请缩短后重新搜索。";
  }
  const items: PostStreamItem[] = posts.map((post) => ({
    post,
    coverUrl: getPublicPostCoverUrl(post, env.R2_PUBLIC_BASE_URL),
  }));

  return (
    <DiscoveryPage
      title={query ? `搜索：${query}` : "搜索书库"}
      description="只检索已经公开发布的标题、摘要与正文。"
      items={items}
      emptyMessage={message}
      searchQuery={query}
    />
  );
}
