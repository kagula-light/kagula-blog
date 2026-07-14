import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { users } from "./identity";

export const postStatus = pgEnum("post_status", ["DRAFT", "SCHEDULED", "PUBLISHED", "ARCHIVED"]);
export const postSummarySource = pgEnum("post_summary_source", ["NONE", "MANUAL", "GENERATED"]);
export const mediaAssetStatus = pgEnum("media_asset_status", ["PENDING", "READY", "DELETED"]);

export const categories = pgTable(
  "categories",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 80 }).notNull(),
    slug: varchar("slug", { length: 96 }).notNull(),
    description: text("description"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex("categories_slug_unique").on(table.slug)],
);

export const tags = pgTable(
  "tags",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 80 }).notNull(),
    slug: varchar("slug", { length: 96 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex("tags_slug_unique").on(table.slug)],
);

export const mediaAssets = pgTable(
  "media_assets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ownerUserId: uuid("owner_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    objectKey: varchar("object_key", { length: 512 }).notNull(),
    mimeType: varchar("mime_type", { length: 100 }).notNull(),
    byteSize: bigint("byte_size", { mode: "number" }).notNull(),
    width: integer("width").notNull(),
    height: integer("height").notNull(),
    checksumSha256: varchar("checksum_sha256", { length: 64 }).notNull(),
    altText: varchar("alt_text", { length: 240 }),
    status: mediaAssetStatus("status").default("PENDING").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "date" }),
  },
  (table) => [
    uniqueIndex("media_assets_object_key_unique").on(table.objectKey),
    index("media_assets_owner_status_idx").on(table.ownerUserId, table.status),
    check("media_assets_byte_size_positive", sql`${table.byteSize} > 0`),
    check("media_assets_dimensions_positive", sql`${table.width} > 0 AND ${table.height} > 0`),
  ],
);

export const posts = pgTable(
  "posts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    title: varchar("title", { length: 200 }).notNull(),
    slug: varchar("slug", { length: 200 }).notNull(),
    excerpt: text("excerpt").notNull(),
    markdown: text("markdown").notNull(),
    renderedHtml: text("rendered_html").notNull(),
    aiSummary: text("ai_summary"),
    summarySource: postSummarySource("summary_source").default("NONE").notNull(),
    coverMediaId: uuid("cover_media_id").references(() => mediaAssets.id, {
      onDelete: "restrict",
    }),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "restrict" }),
    status: postStatus("status").default("DRAFT").notNull(),
    scheduledFor: timestamp("scheduled_for", { withTimezone: true, mode: "date" }),
    publishedAt: timestamp("published_at", { withTimezone: true, mode: "date" }),
    archivedAt: timestamp("archived_at", { withTimezone: true, mode: "date" }),
    readingMinutes: integer("reading_minutes").notNull(),
    seoTitle: varchar("seo_title", { length: 200 }),
    seoDescription: varchar("seo_description", { length: 320 }),
    socialMediaId: uuid("social_media_id").references(() => mediaAssets.id, {
      onDelete: "restrict",
    }),
    createdByUserId: uuid("created_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    updatedByUserId: uuid("updated_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    version: integer("version").default(1).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("posts_slug_unique").on(table.slug),
    index("posts_status_published_idx").on(table.status, table.publishedAt),
    index("posts_scheduled_due_idx").on(table.status, table.scheduledFor),
    check(
      "posts_scheduled_time_required",
      sql`${table.status} <> 'SCHEDULED' OR ${table.scheduledFor} IS NOT NULL`,
    ),
    check(
      "posts_published_time_required",
      sql`${table.status} <> 'PUBLISHED' OR ${table.publishedAt} IS NOT NULL`,
    ),
    check(
      "posts_archived_time_required",
      sql`${table.status} <> 'ARCHIVED' OR ${table.archivedAt} IS NOT NULL`,
    ),
    check("posts_reading_minutes_positive", sql`${table.readingMinutes} > 0`),
    check("posts_version_positive", sql`${table.version} > 0`),
  ],
);

export const postTags = pgTable(
  "post_tags",
  {
    postId: uuid("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({ columns: [table.postId, table.tagId], name: "post_tags_pk" }),
    index("post_tags_tag_idx").on(table.tagId),
  ],
);

export const postRevisions = pgTable(
  "post_revisions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    postId: uuid("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    revisionNumber: integer("revision_number").notNull(),
    title: varchar("title", { length: 200 }).notNull(),
    slug: varchar("slug", { length: 200 }).notNull(),
    excerpt: text("excerpt").notNull(),
    markdown: text("markdown").notNull(),
    renderedHtml: text("rendered_html").notNull(),
    aiSummary: text("ai_summary"),
    summarySource: postSummarySource("summary_source").notNull(),
    coverMediaId: uuid("cover_media_id").references(() => mediaAssets.id, {
      onDelete: "restrict",
    }),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "restrict" }),
    status: postStatus("status").notNull(),
    scheduledFor: timestamp("scheduled_for", { withTimezone: true, mode: "date" }),
    publishedAt: timestamp("published_at", { withTimezone: true, mode: "date" }),
    archivedAt: timestamp("archived_at", { withTimezone: true, mode: "date" }),
    readingMinutes: integer("reading_minutes").notNull(),
    seoTitle: varchar("seo_title", { length: 200 }),
    seoDescription: varchar("seo_description", { length: 320 }),
    socialMediaId: uuid("social_media_id").references(() => mediaAssets.id, {
      onDelete: "restrict",
    }),
    editorUserId: uuid("editor_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("post_revisions_post_number_unique").on(table.postId, table.revisionNumber),
    index("post_revisions_post_created_idx").on(table.postId, table.createdAt),
    check("post_revisions_number_positive", sql`${table.revisionNumber} > 0`),
    check("post_revisions_reading_minutes_positive", sql`${table.readingMinutes} > 0`),
  ],
);

export const postSlugRedirects = pgTable(
  "post_slug_redirects",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    postId: uuid("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    oldSlug: varchar("old_slug", { length: 200 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("post_slug_redirects_old_slug_unique").on(table.oldSlug),
    index("post_slug_redirects_post_idx").on(table.postId),
  ],
);
