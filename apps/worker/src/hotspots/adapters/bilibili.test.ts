import { describe, expect, it } from "vitest";

import { createFixtureFetcher, readFixture } from "./adapter-test-support";
import { bilibiliAdapter } from "./bilibili";

const capturedAt = new Date("2026-07-15T02:00:00.000Z");

describe("Bilibili adapter", () => {
  it("maps popular video metadata without copying media", async () => {
    const body = await readFixture("bilibili/normal.json");
    const candidates = await bilibiliAdapter.collect(
      createFixtureFetcher(() => body),
      capturedAt,
    );
    expect(candidates).toHaveLength(2);
    expect(candidates[0]).toEqual({
      sourceCode: "BILIBILI",
      externalId: "BV1example",
      title: "AI 工具的工程实践",
      url: "https://www.bilibili.com/video/BV1example",
      rank: 1,
      score: 880000,
      category: "科技",
      capturedAt,
      rawFingerprint: expect.stringMatching(/^[a-f0-9]{64}$/u),
    });
  });

  it("accepts an empty valid list", async () => {
    const body = await readFixture("bilibili/empty.json");
    await expect(
      bilibiliAdapter.collect(
        createFixtureFetcher(() => body),
        capturedAt,
      ),
    ).resolves.toEqual([]);
  });

  it("rejects an unknown response shape", async () => {
    const body = await readFixture("bilibili/changed.json");
    await expect(
      bilibiliAdapter.collect(
        createFixtureFetcher(() => body),
        capturedAt,
      ),
    ).rejects.toThrow("Bilibili response shape changed");
  });
});
