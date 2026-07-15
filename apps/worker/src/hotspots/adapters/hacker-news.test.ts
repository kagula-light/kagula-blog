import { describe, expect, it } from "vitest";

import { createFixtureFetcher, readFixture } from "./adapter-test-support";
import { hackerNewsAdapter } from "./hacker-news";

const capturedAt = new Date("2026-07-15T02:00:00.000Z");

describe("Hacker News adapter", () => {
  it("maps top story metadata to stable discussion links", async () => {
    const top = await readFixture("hacker-news/normal-top.json");
    const items = JSON.parse(await readFixture("hacker-news/normal-items.json")) as Record<
      string,
      unknown
    >;
    const candidates = await hackerNewsAdapter.collect(
      createFixtureFetcher((url) => {
        if (url.endsWith("topstories.json")) return top;
        const id = /item\/(\d+)\.json$/u.exec(url)?.[1];
        return JSON.stringify(id ? items[id] : null);
      }),
      capturedAt,
    );
    expect(candidates).toHaveLength(2);
    expect(candidates[0]).toEqual({
      sourceCode: "HACKER_NEWS",
      externalId: "story:101",
      title: "A reliable systems article",
      url: "https://news.ycombinator.com/item?id=101",
      rank: 1,
      score: 321,
      capturedAt,
      rawFingerprint: expect.stringMatching(/^[a-f0-9]{64}$/u),
    });
  });

  it("accepts an empty top list", async () => {
    const body = await readFixture("hacker-news/empty.json");
    await expect(
      hackerNewsAdapter.collect(
        createFixtureFetcher(() => body),
        capturedAt,
      ),
    ).resolves.toEqual([]);
  });

  it("rejects an unknown top-list shape", async () => {
    const body = await readFixture("hacker-news/changed.json");
    await expect(
      hackerNewsAdapter.collect(
        createFixtureFetcher(() => body),
        capturedAt,
      ),
    ).rejects.toThrow("Hacker News response shape changed");
  });
});
