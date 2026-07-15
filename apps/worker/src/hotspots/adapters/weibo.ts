import { z } from "zod";

import { createRawFingerprint, sourceShapeChanged, type HotspotAdapter } from "./adapter";

const hotSearchResponseSchema = z.object({
  ok: z.literal(1),
  data: z.object({
    realtime: z.array(
      z.object({
        word: z.string().trim().min(1),
        word_scheme: z.string().trim().min(1).optional(),
        raw_hot: z.number().int().nonnegative().optional(),
        category: z.string().trim().min(1).optional(),
      }),
    ),
  }),
});

export const weiboAdapter: HotspotAdapter = {
  sourceCode: "WEIBO",
  collect: async (fetcher, capturedAt) => {
    try {
      const { body } = await fetcher.fetchText({
        url: "https://weibo.com/ajax/side/hotSearch",
        allowedHosts: ["weibo.com"],
        acceptedContentTypes: ["application/json"],
      });
      const rawResponse: unknown = JSON.parse(body);
      const response = hotSearchResponseSchema.parse(rawResponse);
      return response.data.realtime.slice(0, 30).map((topic, index) => {
        const searchTerm = topic.word_scheme ?? topic.word;
        return {
          sourceCode: "WEIBO",
          externalId: searchTerm,
          title: topic.word,
          url: `https://s.weibo.com/weibo?q=${encodeURIComponent(searchTerm)}`,
          rank: index + 1,
          ...(topic.raw_hot === undefined ? {} : { score: topic.raw_hot }),
          ...(topic.category ? { category: topic.category } : {}),
          capturedAt,
          rawFingerprint: createRawFingerprint(response.data.realtime[index]),
        };
      });
    } catch (error) {
      throw sourceShapeChanged("Weibo", error);
    }
  },
};
