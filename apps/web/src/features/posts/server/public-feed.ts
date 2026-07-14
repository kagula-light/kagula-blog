import type { PublicPostSummary } from "./public-post-repository";

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

interface CreateRssFeedInput {
  readonly siteUrl: string;
  readonly siteName: string;
  readonly description: string;
  readonly posts: readonly PublicPostSummary[];
}

export function createRssFeed({
  siteUrl,
  siteName,
  description,
  posts,
}: CreateRssFeedInput): string {
  const canonicalSiteUrl = new URL("/", siteUrl).toString();
  const items = posts
    .map((post) => {
      const articleUrl = new URL(`/articles/${encodeURIComponent(post.slug)}`, canonicalSiteUrl);
      return [
        "    <item>",
        `      <title>${escapeXml(post.title)}</title>`,
        `      <link>${escapeXml(articleUrl.toString())}</link>`,
        `      <guid isPermaLink="true">${escapeXml(articleUrl.toString())}</guid>`,
        `      <description>${escapeXml(post.excerpt)}</description>`,
        `      <pubDate>${post.publishedAt.toUTCString()}</pubDate>`,
        `      <category>${escapeXml(post.category.name)}</category>`,
        "    </item>",
      ].join("\n");
    })
    .join("\n");

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0">',
    "  <channel>",
    `    <title>${escapeXml(siteName)}</title>`,
    `    <link>${escapeXml(canonicalSiteUrl)}</link>`,
    `    <description>${escapeXml(description)}</description>`,
    "    <language>zh-CN</language>",
    items,
    "  </channel>",
    "</rss>",
    "",
  ].join("\n");
}
