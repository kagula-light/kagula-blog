import { load } from "cheerio";

import type { HotspotCandidateInput } from "@kagula/contracts/hotspots";

import { createRawFingerprint, sourceShapeChanged, type HotspotAdapter } from "./adapter";

const sourceUrl = "https://github.com/trending";

function parseScore(value: string): number | undefined {
  const match = /([\d,]+)\s+stars?\s+today/iu.exec(value);
  if (!match?.[1]) return undefined;
  const score = Number.parseInt(match[1].replaceAll(",", ""), 10);
  return Number.isSafeInteger(score) ? score : undefined;
}

export const githubTrendingAdapter: HotspotAdapter = {
  sourceCode: "GITHUB_TRENDING",
  collect: async (fetcher, capturedAt) => {
    const { body } = await fetcher.fetchText({
      url: sourceUrl,
      allowedHosts: ["github.com"],
      acceptedContentTypes: ["text/html"],
    });
    const $ = load(body);
    if ($("main").length !== 1) throw sourceShapeChanged("GitHub Trending");

    const candidates: HotspotCandidateInput[] = [];
    $("article.Box-row")
      .slice(0, 30)
      .each((index, element) => {
        const row = $(element);
        const anchor = row.find("h2 a").first();
        const href = anchor.attr("href")?.trim();
        const title = anchor.text().replace(/\s+/gu, " ").trim();
        if (!href || !/^\/[^/]+\/[^/]+\/?$/u.test(href) || !title) {
          throw sourceShapeChanged("GitHub Trending");
        }
        const repository = href.replace(/^\//u, "").replace(/\/$/u, "");
        const language = row.find('[itemprop="programmingLanguage"]').first().text().trim();
        const score = parseScore(row.find(".float-sm-right").first().text());
        candidates.push({
          sourceCode: "GITHUB_TRENDING",
          externalId: `repo:${repository}`,
          title,
          url: `https://github.com/${repository}`,
          rank: index + 1,
          ...(score === undefined ? {} : { score }),
          ...(language ? { category: language } : {}),
          capturedAt,
          rawFingerprint: createRawFingerprint(row.html() ?? ""),
        });
      });
    return candidates;
  },
};
