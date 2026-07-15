import type { HotspotCandidateInput, HotspotSourceCode } from "@kagula/contracts/hotspots";
import { describe, expect, it, vi } from "vitest";

import type { HotspotAdapter } from "./adapters/adapter";
import { collectHotspots } from "./collect-hotspots";
import type {
  HotspotCollectionRepository,
  HotspotSourceConfiguration,
  SourceCollectionRequest,
} from "./hotspot-repository";
import type { SourceFetcher } from "./source-fetcher";

const now = new Date("2026-07-15T06:00:00.000Z");

function createSource(
  code: HotspotSourceCode,
  overrides: Partial<HotspotSourceConfiguration> = {},
): HotspotSourceConfiguration {
  return {
    id: `source-${code}`,
    code,
    enabled: true,
    allowedHost: "github.com",
    timeoutMs: 8_000,
    ...overrides,
  };
}

function createCandidate(sourceCode: HotspotSourceCode, title: string): HotspotCandidateInput {
  const urls: Readonly<Record<HotspotSourceCode, string>> = {
    GITHUB_TRENDING: "https://github.com/kagula-light/kagula-blog",
    HACKER_NEWS: "https://news.ycombinator.com/item?id=101",
    BILIBILI: "https://www.bilibili.com/video/BV1example",
    WEIBO: "https://s.weibo.com/weibo?q=example",
    BAIDU: "https://www.baidu.com/s?wd=example",
  };
  return {
    sourceCode,
    externalId: title,
    title,
    url: urls[sourceCode],
    rank: 1,
    capturedAt: now,
    rawFingerprint: "a".repeat(64),
  };
}

function createAdapter(
  sourceCode: HotspotSourceCode,
  collect: HotspotAdapter["collect"],
): HotspotAdapter {
  return { sourceCode, collect };
}

function createRepository(
  sources: readonly HotspotSourceConfiguration[],
  options: { readonly lockedSources?: ReadonlySet<HotspotSourceCode> } = {},
): HotspotCollectionRepository & {
  readonly requests: SourceCollectionRequest[];
} {
  const requests: SourceCollectionRequest[] = [];
  return {
    requests,
    listSources: async () => sources,
    runSourceCollection: async (request) => {
      requests.push(request);
      if (options.lockedSources?.has(request.source.code)) return { status: "LOCKED" };
      try {
        const candidates = await request.collect();
        return { status: "SUCCEEDED", candidateCount: candidates.length };
      } catch (error) {
        return {
          status: "FAILED",
          errorSummary: error instanceof Error ? error.message : "unknown source failure",
        };
      }
    },
  };
}

const unusedFetcher: SourceFetcher = {
  fetchText: async () => {
    throw new Error("fixture fetcher should not be called");
  },
};

describe("collectHotspots", () => {
  it("continues collecting after one source fails", async () => {
    const repository = createRepository([
      createSource("GITHUB_TRENDING"),
      createSource("BAIDU", { allowedHost: "top.baidu.com" }),
    ]);
    const baiduCollect = vi.fn(async () => [createCandidate("BAIDU", "Baidu item")]);

    const result = await collectHotspots({
      repository,
      adapters: [
        createAdapter("GITHUB_TRENDING", async () => {
          throw new Error("GitHub Trending response shape changed");
        }),
        createAdapter("BAIDU", baiduCollect),
      ],
      createFetcher: () => unusedFetcher,
      now,
    });

    expect(baiduCollect).toHaveBeenCalledOnce();
    expect(result).toEqual({
      attemptedSourceCount: 2,
      succeededSourceCount: 1,
      failedSourceCount: 1,
      lockedSourceCount: 0,
      skippedSourceCount: 0,
      candidateCount: 1,
    });
  });

  it("skips disabled sources without creating a fetcher", async () => {
    const repository = createRepository([
      createSource("WEIBO", { enabled: false, allowedHost: "weibo.com" }),
    ]);
    const createFetcher = vi.fn(() => unusedFetcher);
    const collect = vi.fn(async () => [createCandidate("WEIBO", "Weibo item")]);

    const result = await collectHotspots({
      repository,
      adapters: [createAdapter("WEIBO", collect)],
      createFetcher,
      now,
    });

    expect(createFetcher).not.toHaveBeenCalled();
    expect(collect).not.toHaveBeenCalled();
    expect(repository.requests).toHaveLength(0);
    expect(result.skippedSourceCount).toBe(1);
  });

  it("does not call the adapter when another run holds the source lock", async () => {
    const repository = createRepository([createSource("BILIBILI")], {
      lockedSources: new Set(["BILIBILI"]),
    });
    const collect = vi.fn(async () => [createCandidate("BILIBILI", "Video")]);

    const result = await collectHotspots({
      repository,
      adapters: [createAdapter("BILIBILI", collect)],
      createFetcher: () => unusedFetcher,
      now,
    });

    expect(collect).not.toHaveBeenCalled();
    expect(result.lockedSourceCount).toBe(1);
    expect(result.attemptedSourceCount).toBe(0);
  });

  it("normalizes candidates before handing the batch to the repository", async () => {
    const repository = createRepository([createSource("GITHUB_TRENDING")]);

    await collectHotspots({
      repository,
      adapters: [
        createAdapter("GITHUB_TRENDING", async () => [
          {
            ...createCandidate("GITHUB_TRENDING", "  Kagura\u200B  Blog  "),
            url: "https://github.com/kagula-light/kagula-blog?utm_source=test",
          },
        ]),
      ],
      createFetcher: () => unusedFetcher,
      now,
    });

    const candidates = await repository.requests[0]?.collect();
    expect(candidates?.[0]).toMatchObject({
      title: "Kagura Blog",
      normalizedUrl: "https://github.com/kagula-light/kagula-blog",
      sourceCode: "GITHUB_TRENDING",
    });
  });

  it("records a missing adapter as an isolated source failure", async () => {
    const repository = createRepository([createSource("HACKER_NEWS")]);

    const result = await collectHotspots({
      repository,
      adapters: [],
      createFetcher: () => unusedFetcher,
      now,
    });

    expect(result.failedSourceCount).toBe(1);
    expect(result.succeededSourceCount).toBe(0);
  });
});
