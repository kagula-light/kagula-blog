import { site } from "../../data/site";
import { createRssFeed } from "../../features/posts/server/public-feed";
import { createPublicPostRepository } from "../../features/posts/server/public-post-repository";
import { getServerEnv } from "../../server/config/env";
import { getDatabase } from "../../server/database/get-database";

export const dynamic = "force-dynamic";

export async function GET() {
  const env = getServerEnv();
  const posts = await createPublicPostRepository(getDatabase()).listPublished(50);
  const feed = createRssFeed({
    siteUrl: env.APP_URL,
    siteName: site.name,
    description: `${site.author}的技术、AI 与个人随笔空间`,
    posts,
  });
  return new Response(feed, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=300, stale-while-revalidate=3600",
    },
  });
}
