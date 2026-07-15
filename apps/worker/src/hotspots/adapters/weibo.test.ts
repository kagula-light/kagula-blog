import { describe, expect, it } from "vitest";

import { createFixtureFetcher, readFixture } from "./adapter-test-support";
import { weiboAdapter } from "./weibo";

const capturedAt = new Date("2026-07-15T02:00:00.000Z");

describe("Weibo adapter", () => {
  it("maps hot-search metadata to public search links", async () => {
    const body = await readFixture("weibo/normal.json");
    const candidates = await weiboAdapter.collect(
      createFixtureFetcher(() => body),
      capturedAt,
    );
    expect(candidates).toHaveLength(2);
    expect(candidates[0]).toEqual({
      sourceCode: "WEIBO",
      externalId: "#人工智能新进展#",
      title: "人工智能新进展",
      url: "https://s.weibo.com/weibo?q=%23%E4%BA%BA%E5%B7%A5%E6%99%BA%E8%83%BD%E6%96%B0%E8%BF%9B%E5%B1%95%23",
      rank: 1,
      score: 987654,
      category: "科技",
      capturedAt,
      rawFingerprint: expect.stringMatching(/^[a-f0-9]{64}$/u),
    });
  });

  it("accepts an empty valid list", async () => {
    const body = await readFixture("weibo/empty.json");
    await expect(
      weiboAdapter.collect(
        createFixtureFetcher(() => body),
        capturedAt,
      ),
    ).resolves.toEqual([]);
  });

  it("rejects an unknown response shape", async () => {
    const body = await readFixture("weibo/changed.json");
    await expect(
      weiboAdapter.collect(
        createFixtureFetcher(() => body),
        capturedAt,
      ),
    ).rejects.toThrow("Weibo response shape changed");
  });
});
