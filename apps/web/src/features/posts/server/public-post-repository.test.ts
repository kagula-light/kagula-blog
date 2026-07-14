import { describe, expect, it } from "vitest";

import {
  groupPublishedPostsByMonth,
  normalizePublicSearchQuery,
  type PublicPostSummary,
} from "./public-post-repository";

function post(overrides: Partial<PublicPostSummary> = {}): PublicPostSummary {
  return {
    id: "post-id",
    title: "Post title",
    slug: "post-title",
    excerpt: "Excerpt",
    aiSummary: null,
    readingMinutes: 3,
    publishedAt: new Date("2026-07-14T04:00:00.000Z"),
    updatedAt: new Date("2026-07-14T04:00:00.000Z"),
    category: { name: "未分类", slug: "uncategorized" },
    tags: [],
    cover: null,
    ...overrides,
  };
}

describe("normalizePublicSearchQuery", () => {
  it("normalizes width and surrounding whitespace", () => {
    expect(normalizePublicSearchQuery("  ＡＩ 工具  ")).toBe("AI 工具");
  });

  it.each(["", "   "])("returns null for empty query %j", (query) => {
    expect(normalizePublicSearchQuery(query)).toBeNull();
  });

  it("rejects an unbounded query", () => {
    expect(() => normalizePublicSearchQuery("a".repeat(101))).toThrow(/search/i);
  });
});

describe("groupPublishedPostsByMonth", () => {
  it("groups descending posts by UTC year and month", () => {
    const groups = groupPublishedPostsByMonth([
      post({ id: "july", publishedAt: new Date("2026-07-14T04:00:00.000Z") }),
      post({ id: "june", publishedAt: new Date("2026-06-30T23:00:00.000Z") }),
    ]);

    expect(groups).toEqual([
      { key: "2026-07", label: "2026 年 7 月", posts: [expect.objectContaining({ id: "july" })] },
      { key: "2026-06", label: "2026 年 6 月", posts: [expect.objectContaining({ id: "june" })] },
    ]);
  });
});
