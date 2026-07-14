import { describe, expect, it } from "vitest";

import { createRssFeed } from "./public-feed";
import type { PublicPostSummary } from "./public-post-repository";

const post: PublicPostSummary = {
  id: "post-1",
  title: "TypeScript < AI",
  slug: "typescript-ai",
  excerpt: "Safety & clarity",
  aiSummary: null,
  readingMinutes: 4,
  publishedAt: new Date("2026-07-14T00:00:00.000Z"),
  updatedAt: new Date("2026-07-14T00:00:00.000Z"),
  category: { name: "AI", slug: "ai" },
  tags: [],
  cover: null,
};

describe("createRssFeed", () => {
  it("emits canonical URLs and escapes XML content", () => {
    const xml = createRssFeed({
      siteUrl: "https://blog.example.com/",
      siteName: "神乐的无月之境",
      description: "技术 & 随笔",
      posts: [post],
    });

    expect(xml).toContain("<title>TypeScript &lt; AI</title>");
    expect(xml).toContain("<description>Safety &amp; clarity</description>");
    expect(xml).toContain("https://blog.example.com/articles/typescript-ai");
  });
});
