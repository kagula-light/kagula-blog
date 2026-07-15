import { describe, expect, it } from "vitest";

import { baiduAdapter } from "./baidu";
import { createFixtureFetcher, readFixture } from "./adapter-test-support";

const capturedAt = new Date("2026-07-15T02:00:00.000Z");

describe("Baidu adapter", () => {
  it("maps realtime board metadata in source order", async () => {
    const body = await readFixture("baidu/normal.html");
    const candidates = await baiduAdapter.collect(
      createFixtureFetcher(() => body),
      capturedAt,
    );
    expect(candidates).toHaveLength(2);
    expect(candidates[0]).toEqual({
      sourceCode: "BAIDU",
      externalId: "https://www.baidu.com/s?wd=AI%20%E5%B7%A5%E7%A8%8B",
      title: "AI 工程进入新阶段",
      url: "https://www.baidu.com/s?wd=AI%20%E5%B7%A5%E7%A8%8B",
      rank: 1,
      score: 998877,
      capturedAt,
      rawFingerprint: expect.stringMatching(/^[a-f0-9]{64}$/u),
    });
  });

  it("accepts an empty valid board", async () => {
    const body = await readFixture("baidu/empty.html");
    await expect(
      baiduAdapter.collect(
        createFixtureFetcher(() => body),
        capturedAt,
      ),
    ).resolves.toEqual([]);
  });

  it("rejects an unknown page shape", async () => {
    const body = await readFixture("baidu/changed.html");
    await expect(
      baiduAdapter.collect(
        createFixtureFetcher(() => body),
        capturedAt,
      ),
    ).rejects.toThrow("Baidu response shape changed");
  });
});
