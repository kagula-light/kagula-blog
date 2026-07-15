import { z } from "zod";

import type { HotspotCandidateInput } from "@kagula/contracts/hotspots";

import { createRawFingerprint, sourceShapeChanged, type HotspotAdapter } from "./adapter";

const apiRoot = "https://hacker-news.firebaseio.com/v0";
const topStoriesSchema = z.array(z.number().int().positive());
const storySchema = z.object({
  id: z.number().int().positive(),
  type: z.literal("story"),
  title: z.string().trim().min(1),
  score: z.number().int().nonnegative().optional(),
  dead: z.boolean().optional(),
  deleted: z.boolean().optional(),
});

export const hackerNewsAdapter: HotspotAdapter = {
  sourceCode: "HACKER_NEWS",
  collect: async (fetcher, capturedAt) => {
    try {
      const topDocument = await fetcher.fetchText({
        url: `${apiRoot}/topstories.json`,
        allowedHosts: ["hacker-news.firebaseio.com"],
        acceptedContentTypes: ["application/json"],
      });
      const storyIds = topStoriesSchema.parse(JSON.parse(topDocument.body)).slice(0, 30);
      const candidates: HotspotCandidateInput[] = [];

      for (const [index, storyId] of storyIds.entries()) {
        const itemDocument = await fetcher.fetchText({
          url: `${apiRoot}/item/${storyId}.json`,
          allowedHosts: ["hacker-news.firebaseio.com"],
          acceptedContentTypes: ["application/json"],
        });
        const rawStory: unknown = JSON.parse(itemDocument.body);
        const story = storySchema.parse(rawStory);
        if (story.id !== storyId || story.dead || story.deleted) continue;
        candidates.push({
          sourceCode: "HACKER_NEWS",
          externalId: `story:${story.id}`,
          title: story.title,
          url: `https://news.ycombinator.com/item?id=${story.id}`,
          rank: index + 1,
          ...(story.score === undefined ? {} : { score: story.score }),
          capturedAt,
          rawFingerprint: createRawFingerprint(rawStory),
        });
      }
      return candidates;
    } catch (error) {
      if (error instanceof Error && error.message === "Hacker News response shape changed") {
        throw error;
      }
      throw sourceShapeChanged("Hacker News", error);
    }
  },
};
