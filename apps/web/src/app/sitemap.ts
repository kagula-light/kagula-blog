import type { MetadataRoute } from "next";

import { createPublicPostRepository } from "../features/posts/server/public-post-repository";
import { getServerEnv } from "../server/config/env";
import { getDatabase } from "../server/database/get-database";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const env = getServerEnv();
  const posts = await createPublicPostRepository(getDatabase()).listPublished(100);
  const staticRoutes = ["/", "/archive", "/search", "/hotspots"].map((path) => ({
    url: new URL(path, env.APP_URL).toString(),
    lastModified: new Date(),
  }));
  return [
    ...staticRoutes,
    ...posts.map((post) => ({
      url: new URL(`/articles/${post.slug}`, env.APP_URL).toString(),
      lastModified: post.updatedAt,
    })),
  ];
}
