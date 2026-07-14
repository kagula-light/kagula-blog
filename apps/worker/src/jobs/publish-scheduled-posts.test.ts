import { describe, expect, it, vi } from "vitest";

import { publishScheduledPosts, type ScheduledPostPublisher } from "./publish-scheduled-posts";

const now = new Date("2026-07-14T04:00:00.000Z");

describe("publishScheduledPosts", () => {
  it("returns zero when there are no due posts", async () => {
    const publisher: ScheduledPostPublisher = {
      publishDuePosts: vi.fn(async () => 0),
    };

    await expect(publishScheduledPosts(publisher, now)).resolves.toBe(0);
    expect(publisher.publishDuePosts).toHaveBeenCalledWith(now);
  });

  it("reports the number of posts published by the transactional repository", async () => {
    const publisher: ScheduledPostPublisher = {
      publishDuePosts: vi.fn(async () => 3),
    };

    await expect(publishScheduledPosts(publisher, now)).resolves.toBe(3);
  });

  it("lets the scheduler retry after a repository failure", async () => {
    const publisher: ScheduledPostPublisher = {
      publishDuePosts: vi
        .fn<() => Promise<number>>()
        .mockRejectedValueOnce(new Error("database unavailable"))
        .mockResolvedValueOnce(1),
    };

    await expect(publishScheduledPosts(publisher, now)).rejects.toThrow("database unavailable");
    await expect(publishScheduledPosts(publisher, new Date(now.getTime() + 60_000))).resolves.toBe(
      1,
    );
  });
});
