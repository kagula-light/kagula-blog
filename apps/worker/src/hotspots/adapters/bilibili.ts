import { z } from "zod";

import { createRawFingerprint, sourceShapeChanged, type HotspotAdapter } from "./adapter";

const popularResponseSchema = z.object({
  code: z.literal(0),
  data: z.object({
    list: z.array(
      z.object({
        bvid: z.string().trim().min(1),
        title: z.string().trim().min(1),
        tname: z.string().trim().min(1).optional(),
        stat: z.object({ view: z.number().int().nonnegative() }),
      }),
    ),
  }),
});

export const bilibiliAdapter: HotspotAdapter = {
  sourceCode: "BILIBILI",
  collect: async (fetcher, capturedAt) => {
    try {
      const { body } = await fetcher.fetchText({
        url: "https://api.bilibili.com/x/web-interface/popular?pn=1&ps=30",
        allowedHosts: ["api.bilibili.com"],
        acceptedContentTypes: ["application/json"],
      });
      const rawResponse: unknown = JSON.parse(body);
      const response = popularResponseSchema.parse(rawResponse);
      return response.data.list.slice(0, 30).map((video, index) => ({
        sourceCode: "BILIBILI",
        externalId: video.bvid,
        title: video.title,
        url: `https://www.bilibili.com/video/${video.bvid}`,
        rank: index + 1,
        score: video.stat.view,
        ...(video.tname ? { category: video.tname } : {}),
        capturedAt,
        rawFingerprint: createRawFingerprint(response.data.list[index]),
      }));
    } catch (error) {
      throw sourceShapeChanged("Bilibili", error);
    }
  },
};
