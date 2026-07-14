import type { MetadataRoute } from "next";

import { getServerEnv } from "../server/config/env";

export const dynamic = "force-dynamic";

export default function robots(): MetadataRoute.Robots {
  const env = getServerEnv();
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin/", "/api/"] }],
    sitemap: new URL("/sitemap.xml", env.APP_URL).toString(),
  };
}
