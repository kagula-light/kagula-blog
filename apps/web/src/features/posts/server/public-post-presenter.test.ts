import { describe, expect, it } from "vitest";

import {
  createPublicAssetUrl,
  formatPublicDate,
  getPublicPostCoverUrl,
  selectAdjacentPosts,
} from "./public-post-presenter";
import type { PublicPostSummary } from "./public-post-repository";

function post(id: string, publishedAt: string): PublicPostSummary {
  return {
    id,
    title: id,
    slug: id,
    excerpt: `${id} excerpt`,
    aiSummary: null,
    readingMinutes: 3,
    publishedAt: new Date(publishedAt),
    updatedAt: new Date(publishedAt),
    category: { name: "技术", slug: "technology" },
    tags: [],
    cover: null,
  };
}

describe("formatPublicDate", () => {
  it("formats dates in the configured Chinese timezone", () => {
    expect(formatPublicDate(new Date("2026-07-14T16:30:00.000Z"))).toBe("2026年7月15日");
  });
});

describe("createPublicAssetUrl", () => {
  it("encodes each object-key segment without changing path boundaries", () => {
    expect(createPublicAssetUrl("https://assets.example.com/base/", "posts/星空 cover.webp")).toBe(
      "https://assets.example.com/base/posts/%E6%98%9F%E7%A9%BA%20cover.webp",
    );
  });

  it("uses the local fallback when a post has no ready cover", () => {
    expect(
      getPublicPostCoverUrl(
        post("plain", "2026-07-14T00:00:00.000Z"),
        "https://assets.example.com",
      ),
    ).toBe("/brand/default-cover.webp");
  });
});

describe("selectAdjacentPosts", () => {
  it("selects newer and older neighbors from a descending public stream", () => {
    const posts = [
      post("newer", "2026-07-15T00:00:00.000Z"),
      post("current", "2026-07-14T00:00:00.000Z"),
      post("older", "2026-07-13T00:00:00.000Z"),
    ];

    expect(selectAdjacentPosts(posts, "current")).toEqual({
      newer: expect.objectContaining({ id: "newer" }),
      older: expect.objectContaining({ id: "older" }),
    });
  });
});
