import { describe, expect, it } from "vitest";

import { createFixtureFetcher, readFixture } from "./adapter-test-support";
import { githubTrendingAdapter } from "./github-trending";

const capturedAt = new Date("2026-07-15T02:00:00.000Z");

describe("GitHub Trending adapter", () => {
  it("maps repository metadata in source order", async () => {
    const body = await readFixture("github-trending/normal.html");
    const candidates = await githubTrendingAdapter.collect(
      createFixtureFetcher(() => body),
      capturedAt,
    );
    expect(candidates).toHaveLength(2);
    expect(candidates[0]).toEqual({
      sourceCode: "GITHUB_TRENDING",
      externalId: "repo:openai/codex",
      title: "openai / codex",
      url: "https://github.com/openai/codex",
      rank: 1,
      score: 1234,
      category: "Rust",
      capturedAt,
      rawFingerprint: expect.stringMatching(/^[a-f0-9]{64}$/u),
    });
  });

  it("accepts an empty valid page", async () => {
    const body = await readFixture("github-trending/empty.html");
    await expect(
      githubTrendingAdapter.collect(
        createFixtureFetcher(() => body),
        capturedAt,
      ),
    ).resolves.toEqual([]);
  });

  it("rejects an unknown page shape", async () => {
    const body = await readFixture("github-trending/changed.html");
    await expect(
      githubTrendingAdapter.collect(
        createFixtureFetcher(() => body),
        capturedAt,
      ),
    ).rejects.toThrow("GitHub Trending response shape changed");
  });
});
