import { normalizeHotspotCandidate, type HotspotSourceCode } from "@kagula/contracts/hotspots";

import { baiduAdapter } from "./adapters/baidu";
import { bilibiliAdapter } from "./adapters/bilibili";
import { githubTrendingAdapter } from "./adapters/github-trending";
import { hackerNewsAdapter } from "./adapters/hacker-news";
import type { HotspotAdapter } from "./adapters/adapter";
import { weiboAdapter } from "./adapters/weibo";
import type {
  HotspotCollectionRepository,
  HotspotSourceConfiguration,
  SourceCollectionResult,
} from "./hotspot-repository";
import { createSourceFetcher, type SourceFetcher } from "./source-fetcher";

const defaultAdapters: readonly HotspotAdapter[] = [
  githubTrendingAdapter,
  hackerNewsAdapter,
  bilibiliAdapter,
  weiboAdapter,
  baiduAdapter,
];

const publicHosts: Readonly<Record<HotspotSourceCode, readonly string[]>> = {
  GITHUB_TRENDING: ["github.com"],
  HACKER_NEWS: ["news.ycombinator.com"],
  BILIBILI: ["www.bilibili.com"],
  WEIBO: ["s.weibo.com"],
  BAIDU: ["www.baidu.com"],
};

export interface HotspotCollectionSummary {
  readonly attemptedSourceCount: number;
  readonly succeededSourceCount: number;
  readonly failedSourceCount: number;
  readonly lockedSourceCount: number;
  readonly skippedSourceCount: number;
  readonly candidateCount: number;
}

export interface CollectHotspotsDependencies {
  readonly repository: HotspotCollectionRepository;
  readonly adapters?: readonly HotspotAdapter[];
  readonly createFetcher?: (source: HotspotSourceConfiguration) => SourceFetcher;
  readonly now?: Date;
}

function createSourceBoundFetcher(source: HotspotSourceConfiguration): SourceFetcher {
  const fetcher = createSourceFetcher({ timeoutMs: source.timeoutMs });
  return {
    fetchText: (request) => {
      const configuredHost = source.allowedHost.toLowerCase();
      if (!request.allowedHosts.some((host) => host.toLowerCase() === configuredHost)) {
        throw new Error("adapter source host does not match the configured allowlist");
      }
      return fetcher.fetchText({ ...request, allowedHosts: [source.allowedHost] });
    },
  };
}

export async function collectHotspots({
  repository,
  adapters = defaultAdapters,
  createFetcher = createSourceBoundFetcher,
  now = new Date(),
}: CollectHotspotsDependencies): Promise<HotspotCollectionSummary> {
  const sources = await repository.listSources();
  const adapterBySource = new Map(adapters.map((adapter) => [adapter.sourceCode, adapter]));
  let attemptedSourceCount = 0;
  let succeededSourceCount = 0;
  let failedSourceCount = 0;
  let lockedSourceCount = 0;
  let skippedSourceCount = 0;
  let candidateCount = 0;

  for (const source of sources) {
    if (!source.enabled) {
      skippedSourceCount += 1;
      continue;
    }
    const adapter = adapterBySource.get(source.code);
    let result: SourceCollectionResult;
    try {
      result = await repository.runSourceCollection({
        source,
        attemptedAt: now,
        collect: async () => {
          if (!adapter) throw new Error(`hotspot adapter is unavailable for ${source.code}`);
          const candidates = await adapter.collect(createFetcher(source), now);
          return candidates.map((candidate) =>
            normalizeHotspotCandidate(candidate, { allowedHosts: publicHosts[source.code] }),
          );
        },
      });
    } catch {
      attemptedSourceCount += 1;
      failedSourceCount += 1;
      continue;
    }

    if (result.status === "LOCKED") {
      lockedSourceCount += 1;
      continue;
    }
    attemptedSourceCount += 1;
    if (result.status === "FAILED") {
      failedSourceCount += 1;
      continue;
    }
    succeededSourceCount += 1;
    candidateCount += result.candidateCount;
  }

  return {
    attemptedSourceCount,
    succeededSourceCount,
    failedSourceCount,
    lockedSourceCount,
    skippedSourceCount,
    candidateCount,
  };
}
