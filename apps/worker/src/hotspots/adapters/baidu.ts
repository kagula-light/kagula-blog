import { load } from "cheerio";

import type { HotspotCandidateInput } from "@kagula/contracts/hotspots";

import { createRawFingerprint, sourceShapeChanged, type HotspotAdapter } from "./adapter";

export const baiduAdapter: HotspotAdapter = {
  sourceCode: "BAIDU",
  collect: async (fetcher, capturedAt) => {
    const { body } = await fetcher.fetchText({
      url: "https://top.baidu.com/board?tab=realtime",
      allowedHosts: ["top.baidu.com"],
      acceptedContentTypes: ["text/html"],
    });
    const $ = load(body);
    if ($("main").length !== 1) throw sourceShapeChanged("Baidu");

    const candidates: HotspotCandidateInput[] = [];
    $('[class^="category-wrap_"]')
      .slice(0, 30)
      .each((index, element) => {
        const row = $(element);
        const anchor = row.find('a[class^="title_"]').first();
        const href = anchor.attr("href")?.trim();
        const title = anchor.text().replace(/\s+/gu, " ").trim();
        const scoreText = row
          .find('[class^="hot-index_"]')
          .first()
          .text()
          .replaceAll(",", "")
          .trim();
        const score = Number.parseInt(scoreText, 10);
        if (!href || !title || !Number.isSafeInteger(score) || score < 0) {
          throw sourceShapeChanged("Baidu");
        }
        const url = new URL(href, "https://www.baidu.com").toString();
        candidates.push({
          sourceCode: "BAIDU",
          externalId: url,
          title,
          url,
          rank: index + 1,
          score,
          capturedAt,
          rawFingerprint: createRawFingerprint(row.html() ?? ""),
        });
      });
    return candidates;
  },
};
