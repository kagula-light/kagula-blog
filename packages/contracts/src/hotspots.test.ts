import { describe, expect, it } from "vitest";

import {
  HOTSPOT_SOURCE_CODES,
  createHotspotFingerprint,
  normalizeHotspotCandidate,
} from "./hotspots";

const capturedAt = new Date("2026-07-15T01:00:00.000Z");

describe("hotspot candidate contract", () => {
  it("exposes the five approved V1 source codes", () => {
    expect(HOTSPOT_SOURCE_CODES).toEqual([
      "GITHUB_TRENDING",
      "HACKER_NEWS",
      "BILIBILI",
      "WEIBO",
      "BAIDU",
    ]);
  });

  it("normalizes titles, optional metadata, and tracking parameters", () => {
    expect(
      normalizeHotspotCandidate(
        {
          sourceCode: "BILIBILI",
          externalId: "  BV1example  ",
          title: "  ＡＩ\u200b   新进展  ",
          url: "https://www.bilibili.com/video/BV1example/?spm_id_from=333.1&utm_source=feed&p=1#reply",
          rank: 3,
          score: 1200,
          category: "  科技  ",
          capturedAt,
          rawFingerprint: "fixture-v1-row-3",
        },
        { allowedHosts: ["www.bilibili.com"] },
      ),
    ).toEqual({
      sourceCode: "BILIBILI",
      externalId: "BV1example",
      title: "AI 新进展",
      url: "https://www.bilibili.com/video/BV1example?p=1",
      normalizedUrl: "https://www.bilibili.com/video/BV1example?p=1",
      rank: 3,
      score: 1200,
      category: "科技",
      capturedAt,
      rawFingerprint: "fixture-v1-row-3",
      dedupeKey: "0f4233765ca7e4a4ac14ebc471c77fc3b8695f4d4baa5078cbb74b9da513db20",
    });
  });

  it("uses source and external ID as the stable fingerprint input", () => {
    expect(
      createHotspotFingerprint({
        sourceCode: "GITHUB_TRENDING",
        externalId: "repo:openai/codex",
        normalizedUrl: "https://github.com/openai/codex",
        title: "OpenAI Codex",
      }),
    ).toBe("4ff887c05ac5501e87e05c22a97c5490b3c5d109dd24e6b0daffa5aeb26f72ba");
  });

  it("falls back to normalized URL and title when external ID is absent", () => {
    expect(
      createHotspotFingerprint({
        sourceCode: "BAIDU",
        externalId: null,
        normalizedUrl: "https://top.baidu.com/board?tab=realtime",
        title: "人工 智能",
      }),
    ).toBe("291f0b1870123d1538324c2059d436461c71e3684646446ce51f17e5a4b1b167");
  });

  it.each([
    ["http://news.ycombinator.com/item?id=1", ["news.ycombinator.com"], "HTTPS"],
    ["https://evil.example/item?id=1", ["news.ycombinator.com"], "allowlist"],
    ["https://news.ycombinator.com.evil.example/item?id=1", ["news.ycombinator.com"], "allowlist"],
    ["https://user:secret@news.ycombinator.com/item?id=1", ["news.ycombinator.com"], "credentials"],
  ] as const)("rejects unsafe URL %s", (url, allowedHosts, message) => {
    expect(() =>
      normalizeHotspotCandidate(
        {
          sourceCode: "HACKER_NEWS",
          externalId: "1",
          title: "Safe title",
          url,
          rank: 1,
          capturedAt,
          rawFingerprint: "row-1",
        },
        { allowedHosts },
      ),
    ).toThrow(message);
  });

  it.each([
    [0, "rank"],
    [1.5, "rank"],
    [1001, "rank"],
  ] as const)("rejects rank %s", (rank, message) => {
    expect(() =>
      normalizeHotspotCandidate(
        {
          sourceCode: "WEIBO",
          externalId: "topic-1",
          title: "Safe title",
          url: "https://s.weibo.com/weibo?q=topic",
          rank,
          capturedAt,
          rawFingerprint: "row-1",
        },
        { allowedHosts: ["s.weibo.com"] },
      ),
    ).toThrow(message);
  });

  it("rejects dangerous title control characters", () => {
    expect(() =>
      normalizeHotspotCandidate(
        {
          sourceCode: "BAIDU",
          externalId: "topic-1",
          title: "unsafe\u0000title",
          url: "https://top.baidu.com/board?tab=realtime",
          rank: 1,
          capturedAt,
          rawFingerprint: "row-1",
        },
        { allowedHosts: ["top.baidu.com"] },
      ),
    ).toThrow("control");
  });
});
