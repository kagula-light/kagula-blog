import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
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

export const hotspotCandidateStatus = pgEnum("hotspot_candidate_status", [
  "PENDING",
  "APPROVED",
  "REJECTED",
  "EXPIRED",
]);

export const hotspotSources = pgTable(
  "hotspot_sources",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    code: varchar("code", { length: 32 }).notNull(),
    name: varchar("name", { length: 80 }).notNull(),
    enabled: boolean("enabled").default(true).notNull(),
    allowedHost: varchar("allowed_host", { length: 253 }).notNull(),
    collectionIntervalMinutes: integer("collection_interval_minutes").default(30).notNull(),
    timeoutMs: integer("timeout_ms").default(8_000).notNull(),
    lastAttemptAt: timestamp("last_attempt_at", { withTimezone: true, mode: "date" }),
    lastSuccessAt: timestamp("last_success_at", { withTimezone: true, mode: "date" }),
    lastFailureAt: timestamp("last_failure_at", { withTimezone: true, mode: "date" }),
    lastError: varchar("last_error", { length: 512 }),
    consecutiveFailures: integer("consecutive_failures").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("hotspot_sources_code_unique").on(table.code),
    check(
      "hotspot_sources_interval_positive",
      sql`${table.collectionIntervalMinutes} BETWEEN 5 AND 1440`,
    ),
    check("hotspot_sources_timeout_range", sql`${table.timeoutMs} BETWEEN 1000 AND 30000`),
    check("hotspot_sources_failures_nonnegative", sql`${table.consecutiveFailures} >= 0`),
  ],
);

export const hotspotCandidates = pgTable(
  "hotspot_candidates",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sourceId: uuid("source_id")
      .notNull()
      .references(() => hotspotSources.id, { onDelete: "restrict" }),
    externalId: varchar("external_id", { length: 256 }),
    originalTitle: varchar("original_title", { length: 180 }).notNull(),
    displayTitle: varchar("display_title", { length: 180 }).notNull(),
    originalUrl: text("original_url").notNull(),
    normalizedUrl: text("normalized_url").notNull(),
    sourceRank: integer("source_rank").notNull(),
    sourceScore: integer("source_score"),
    sourceCategory: varchar("source_category", { length: 80 }),
    dedupeKey: varchar("dedupe_key", { length: 64 }).notNull(),
    rawFingerprint: varchar("raw_fingerprint", { length: 128 }).notNull(),
    status: hotspotCandidateStatus("status").default("PENDING").notNull(),
    publicOrder: integer("public_order"),
    capturedAt: timestamp("captured_at", { withTimezone: true, mode: "date" }).notNull(),
    reviewedByUserId: uuid("reviewed_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true, mode: "date" }),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("hotspot_candidates_source_dedupe_unique").on(table.sourceId, table.dedupeKey),
    index("hotspot_candidates_review_queue_idx").on(table.status, table.sourceId, table.capturedAt),
    index("hotspot_candidates_public_idx").on(table.status, table.expiresAt, table.publicOrder),
    check("hotspot_candidates_rank_range", sql`${table.sourceRank} BETWEEN 1 AND 1000`),
    check(
      "hotspot_candidates_score_nonnegative",
      sql`${table.sourceScore} IS NULL OR ${table.sourceScore} >= 0`,
    ),
    check(
      "hotspot_candidates_public_order_positive",
      sql`${table.publicOrder} IS NULL OR ${table.publicOrder} > 0`,
    ),
    check(
      "hotspot_candidates_review_fields",
      sql`${table.status} = 'PENDING' OR ${table.reviewedAt} IS NOT NULL`,
    ),
    check(
      "hotspot_candidates_approved_fields",
      sql`${table.status} <> 'APPROVED' OR (${table.expiresAt} IS NOT NULL AND ${table.publicOrder} IS NOT NULL)`,
    ),
  ],
);

export const dailyHotspotArchives = pgTable(
  "daily_hotspot_archives",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    archiveDate: date("archive_date", { mode: "string" }).notNull(),
    itemCount: integer("item_count").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("daily_hotspot_archives_date_unique").on(table.archiveDate),
    check("daily_hotspot_archives_item_count_nonnegative", sql`${table.itemCount} >= 0`),
  ],
);

export const dailyHotspotArchiveItems = pgTable(
  "daily_hotspot_archive_items",
  {
    archiveId: uuid("archive_id")
      .notNull()
      .references(() => dailyHotspotArchives.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    candidateId: uuid("candidate_id").references(() => hotspotCandidates.id, {
      onDelete: "set null",
    }),
    sourceCode: varchar("source_code", { length: 32 }).notNull(),
    sourceName: varchar("source_name", { length: 80 }).notNull(),
    title: varchar("title", { length: 180 }).notNull(),
    url: text("url").notNull(),
    sourceRank: integer("source_rank").notNull(),
    capturedAt: timestamp("captured_at", { withTimezone: true, mode: "date" }).notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.archiveId, table.position],
      name: "daily_hotspot_archive_items_pk",
    }),
    uniqueIndex("daily_hotspot_archive_items_candidate_unique").on(
      table.archiveId,
      table.candidateId,
    ),
    check("daily_hotspot_archive_items_position_positive", sql`${table.position} > 0`),
    check("daily_hotspot_archive_items_rank_range", sql`${table.sourceRank} BETWEEN 1 AND 1000`),
  ],
);
