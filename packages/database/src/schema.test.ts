import { getTableColumns, getTableName } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import {
  auditLogs,
  categories,
  credentials,
  mediaAssets,
  mediaAssetStatus,
  posts,
  postRevisions,
  postSlugRedirects,
  postStatus,
  postTags,
  sessions,
  tags,
  userRole,
  users,
  userStatus,
} from "./schema";

describe("identity schema", () => {
  it("defines stable user role and status enums", () => {
    expect(userRole.enumValues).toEqual(["ADMIN", "USER"]);
    expect(userStatus.enumValues).toEqual(["ACTIVE", "MUTED", "BANNED"]);
  });

  it.each([
    [users, "users"],
    [credentials, "credentials"],
    [sessions, "sessions"],
    [auditLogs, "audit_logs"],
  ] as const)("maps a domain table to %s", (table, expectedName) => {
    expect(getTableName(table)).toBe(expectedName);
  });

  it("contains the required identity columns", () => {
    expect(Object.keys(getTableColumns(users))).toEqual(
      expect.arrayContaining([
        "id",
        "username",
        "normalizedUsername",
        "displayName",
        "role",
        "status",
        "createdAt",
        "updatedAt",
        "lastLoginAt",
      ]),
    );
    expect(Object.keys(getTableColumns(credentials))).toEqual([
      "userId",
      "passwordHash",
      "passwordUpdatedAt",
    ]);
    expect(Object.keys(getTableColumns(sessions))).toEqual(
      expect.arrayContaining([
        "id",
        "userId",
        "tokenDigest",
        "expiresAt",
        "lastActivityAt",
        "revokedAt",
        "createdAt",
      ]),
    );
    expect(Object.keys(getTableColumns(auditLogs))).toEqual(
      expect.arrayContaining([
        "id",
        "actorUserId",
        "action",
        "resourceType",
        "resourceId",
        "requestId",
        "summary",
        "createdAt",
      ]),
    );
  });
});

describe("content schema", () => {
  it("defines stable post and media states", () => {
    expect(postStatus.enumValues).toEqual(["DRAFT", "SCHEDULED", "PUBLISHED", "ARCHIVED"]);
    expect(mediaAssetStatus.enumValues).toEqual(["PENDING", "READY", "DELETED"]);
  });

  it.each([
    [categories, "categories"],
    [tags, "tags"],
    [mediaAssets, "media_assets"],
    [posts, "posts"],
    [postTags, "post_tags"],
    [postRevisions, "post_revisions"],
    [postSlugRedirects, "post_slug_redirects"],
  ] as const)("maps a content table to %s", (table, expectedName) => {
    expect(getTableName(table)).toBe(expectedName);
  });

  it("contains the required post publication and ownership columns", () => {
    expect(Object.keys(getTableColumns(posts))).toEqual(
      expect.arrayContaining([
        "id",
        "title",
        "slug",
        "excerpt",
        "markdown",
        "renderedHtml",
        "aiSummary",
        "coverMediaId",
        "categoryId",
        "status",
        "scheduledFor",
        "publishedAt",
        "archivedAt",
        "readingMinutes",
        "seoTitle",
        "seoDescription",
        "socialMediaId",
        "createdByUserId",
        "updatedByUserId",
        "version",
        "createdAt",
        "updatedAt",
      ]),
    );
  });

  it("contains immutable revision snapshots and media metadata", () => {
    expect(Object.keys(getTableColumns(postRevisions))).toEqual(
      expect.arrayContaining([
        "id",
        "postId",
        "revisionNumber",
        "title",
        "slug",
        "markdown",
        "renderedHtml",
        "status",
        "editorUserId",
        "createdAt",
      ]),
    );
    expect(Object.keys(getTableColumns(mediaAssets))).toEqual(
      expect.arrayContaining([
        "id",
        "ownerUserId",
        "objectKey",
        "mimeType",
        "byteSize",
        "width",
        "height",
        "checksumSha256",
        "altText",
        "status",
        "createdAt",
        "updatedAt",
        "deletedAt",
      ]),
    );
  });
});
