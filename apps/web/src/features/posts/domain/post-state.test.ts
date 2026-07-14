import { describe, expect, it } from "vitest";

import {
  normalizePostSlug,
  normalizePostTitle,
  resolvePostTransition,
  type PostStatus,
} from "./post-state";

const now = new Date("2026-07-14T04:00:00.000Z");

describe("normalizePostSlug", () => {
  it.each([
    ["  My_First Post  ", "my-first-post"],
    ["AI 与 开发", "ai-与-开发"],
    ["release---notes", "release-notes"],
  ])("normalizes %s", (value, expected) => {
    expect(normalizePostSlug(value)).toBe(expected);
  });

  it.each(["", "../secret", "has/slash", "-", "a".repeat(201)])(
    "rejects unsupported slug %s",
    (value) => expect(() => normalizePostSlug(value)).toThrow(/slug/i),
  );
});

describe("normalizePostTitle", () => {
  it("trims a valid title", () => {
    expect(normalizePostTitle("  A focused title  ")).toBe("A focused title");
  });

  it.each(["", "   ", "a".repeat(201)])("rejects invalid title %s", (value) => {
    expect(() => normalizePostTitle(value)).toThrow(/title/i);
  });
});

describe("resolvePostTransition", () => {
  it.each<[PostStatus, PostStatus]>([
    ["DRAFT", "SCHEDULED"],
    ["DRAFT", "PUBLISHED"],
    ["SCHEDULED", "DRAFT"],
    ["SCHEDULED", "PUBLISHED"],
    ["PUBLISHED", "ARCHIVED"],
    ["ARCHIVED", "PUBLISHED"],
  ])("allows %s to become %s", (currentStatus, targetStatus) => {
    const result = resolvePostTransition({
      currentStatus,
      targetStatus,
      now,
      scheduledFor: targetStatus === "SCHEDULED" ? new Date("2026-07-15T04:00:00.000Z") : null,
      publishedAt:
        currentStatus === "PUBLISHED" || currentStatus === "ARCHIVED"
          ? new Date("2026-07-13T04:00:00.000Z")
          : null,
    });

    expect(result.status).toBe(targetStatus);
  });

  it.each<[PostStatus, PostStatus]>([
    ["DRAFT", "ARCHIVED"],
    ["SCHEDULED", "ARCHIVED"],
    ["PUBLISHED", "DRAFT"],
    ["PUBLISHED", "SCHEDULED"],
    ["ARCHIVED", "DRAFT"],
    ["ARCHIVED", "SCHEDULED"],
  ])("rejects %s to %s", (currentStatus, targetStatus) => {
    expect(() =>
      resolvePostTransition({
        currentStatus,
        targetStatus,
        now,
        scheduledFor: null,
        publishedAt: null,
      }),
    ).toThrow(/transition/i);
  });

  it.each([null, new Date("2026-07-14T04:00:00.000Z"), new Date("2026-07-14T03:59:59.000Z")])(
    "rejects a non-future schedule of %s",
    (scheduledFor) => {
      expect(() =>
        resolvePostTransition({
          currentStatus: "DRAFT",
          targetStatus: "SCHEDULED",
          now,
          scheduledFor,
          publishedAt: null,
        }),
      ).toThrow(/future/i);
    },
  );

  it("sets publication time and clears scheduling metadata", () => {
    expect(
      resolvePostTransition({
        currentStatus: "SCHEDULED",
        targetStatus: "PUBLISHED",
        now,
        scheduledFor: new Date("2026-07-15T04:00:00.000Z"),
        publishedAt: null,
      }),
    ).toEqual({
      status: "PUBLISHED",
      scheduledFor: null,
      publishedAt: now,
      archivedAt: null,
    });
  });

  it("preserves publication time when archiving", () => {
    const publishedAt = new Date("2026-07-13T04:00:00.000Z");

    expect(
      resolvePostTransition({
        currentStatus: "PUBLISHED",
        targetStatus: "ARCHIVED",
        now,
        scheduledFor: null,
        publishedAt,
      }),
    ).toEqual({
      status: "ARCHIVED",
      scheduledFor: null,
      publishedAt,
      archivedAt: now,
    });
  });

  it("clears schedule metadata when returning to draft", () => {
    expect(
      resolvePostTransition({
        currentStatus: "SCHEDULED",
        targetStatus: "DRAFT",
        now,
        scheduledFor: new Date("2026-07-15T04:00:00.000Z"),
        publishedAt: null,
      }),
    ).toEqual({
      status: "DRAFT",
      scheduledFor: null,
      publishedAt: null,
      archivedAt: null,
    });
  });
});
