CREATE TYPE "public"."hotspot_candidate_status" AS ENUM('PENDING', 'APPROVED', 'REJECTED', 'EXPIRED');--> statement-breakpoint
CREATE TABLE "daily_hotspot_archive_items" (
	"archive_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"candidate_id" uuid,
	"source_code" varchar(32) NOT NULL,
	"source_name" varchar(80) NOT NULL,
	"title" varchar(180) NOT NULL,
	"url" text NOT NULL,
	"source_rank" integer NOT NULL,
	"captured_at" timestamp with time zone NOT NULL,
	CONSTRAINT "daily_hotspot_archive_items_pk" PRIMARY KEY("archive_id","position"),
	CONSTRAINT "daily_hotspot_archive_items_position_positive" CHECK ("daily_hotspot_archive_items"."position" > 0),
	CONSTRAINT "daily_hotspot_archive_items_rank_range" CHECK ("daily_hotspot_archive_items"."source_rank" BETWEEN 1 AND 1000)
);
--> statement-breakpoint
CREATE TABLE "daily_hotspot_archives" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"archive_date" date NOT NULL,
	"item_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "daily_hotspot_archives_item_count_nonnegative" CHECK ("daily_hotspot_archives"."item_count" >= 0)
);
--> statement-breakpoint
CREATE TABLE "hotspot_candidates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" uuid NOT NULL,
	"external_id" varchar(256),
	"original_title" varchar(180) NOT NULL,
	"display_title" varchar(180) NOT NULL,
	"original_url" text NOT NULL,
	"normalized_url" text NOT NULL,
	"source_rank" integer NOT NULL,
	"source_score" integer,
	"source_category" varchar(80),
	"dedupe_key" varchar(64) NOT NULL,
	"raw_fingerprint" varchar(128) NOT NULL,
	"status" "hotspot_candidate_status" DEFAULT 'PENDING' NOT NULL,
	"public_order" integer,
	"captured_at" timestamp with time zone NOT NULL,
	"reviewed_by_user_id" uuid,
	"reviewed_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hotspot_candidates_rank_range" CHECK ("hotspot_candidates"."source_rank" BETWEEN 1 AND 1000),
	CONSTRAINT "hotspot_candidates_score_nonnegative" CHECK ("hotspot_candidates"."source_score" IS NULL OR "hotspot_candidates"."source_score" >= 0),
	CONSTRAINT "hotspot_candidates_public_order_positive" CHECK ("hotspot_candidates"."public_order" IS NULL OR "hotspot_candidates"."public_order" > 0),
	CONSTRAINT "hotspot_candidates_review_fields" CHECK ("hotspot_candidates"."status" = 'PENDING' OR "hotspot_candidates"."reviewed_at" IS NOT NULL),
	CONSTRAINT "hotspot_candidates_approved_fields" CHECK ("hotspot_candidates"."status" <> 'APPROVED' OR ("hotspot_candidates"."expires_at" IS NOT NULL AND "hotspot_candidates"."public_order" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "hotspot_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(32) NOT NULL,
	"name" varchar(80) NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"allowed_host" varchar(253) NOT NULL,
	"collection_interval_minutes" integer DEFAULT 30 NOT NULL,
	"timeout_ms" integer DEFAULT 8000 NOT NULL,
	"last_attempt_at" timestamp with time zone,
	"last_success_at" timestamp with time zone,
	"last_failure_at" timestamp with time zone,
	"last_error" varchar(512),
	"consecutive_failures" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hotspot_sources_interval_positive" CHECK ("hotspot_sources"."collection_interval_minutes" BETWEEN 5 AND 1440),
	CONSTRAINT "hotspot_sources_timeout_range" CHECK ("hotspot_sources"."timeout_ms" BETWEEN 1000 AND 30000),
	CONSTRAINT "hotspot_sources_failures_nonnegative" CHECK ("hotspot_sources"."consecutive_failures" >= 0)
);
--> statement-breakpoint
ALTER TABLE "daily_hotspot_archive_items" ADD CONSTRAINT "daily_hotspot_archive_items_archive_id_daily_hotspot_archives_id_fk" FOREIGN KEY ("archive_id") REFERENCES "public"."daily_hotspot_archives"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_hotspot_archive_items" ADD CONSTRAINT "daily_hotspot_archive_items_candidate_id_hotspot_candidates_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."hotspot_candidates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hotspot_candidates" ADD CONSTRAINT "hotspot_candidates_source_id_hotspot_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."hotspot_sources"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hotspot_candidates" ADD CONSTRAINT "hotspot_candidates_reviewed_by_user_id_users_id_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "daily_hotspot_archive_items_candidate_unique" ON "daily_hotspot_archive_items" USING btree ("archive_id","candidate_id");--> statement-breakpoint
CREATE UNIQUE INDEX "daily_hotspot_archives_date_unique" ON "daily_hotspot_archives" USING btree ("archive_date");--> statement-breakpoint
CREATE UNIQUE INDEX "hotspot_candidates_source_dedupe_unique" ON "hotspot_candidates" USING btree ("source_id","dedupe_key");--> statement-breakpoint
CREATE INDEX "hotspot_candidates_review_queue_idx" ON "hotspot_candidates" USING btree ("status","source_id","captured_at");--> statement-breakpoint
CREATE INDEX "hotspot_candidates_public_idx" ON "hotspot_candidates" USING btree ("status","expires_at","public_order");--> statement-breakpoint
CREATE UNIQUE INDEX "hotspot_sources_code_unique" ON "hotspot_sources" USING btree ("code");--> statement-breakpoint
INSERT INTO "hotspot_sources" (
	"id", "code", "name", "allowed_host", "collection_interval_minutes", "timeout_ms"
) VALUES
	('00000000-0000-4000-8000-000000000101', 'GITHUB_TRENDING', 'GitHub Trending', 'github.com', 30, 8000),
	('00000000-0000-4000-8000-000000000102', 'HACKER_NEWS', 'Hacker News', 'hacker-news.firebaseio.com', 30, 8000),
	('00000000-0000-4000-8000-000000000103', 'BILIBILI', '哔哩哔哩', 'api.bilibili.com', 30, 8000),
	('00000000-0000-4000-8000-000000000104', 'WEIBO', '微博热搜', 'weibo.com', 30, 8000),
	('00000000-0000-4000-8000-000000000105', 'BAIDU', '百度热搜', 'top.baidu.com', 30, 8000)
ON CONFLICT ("code") DO UPDATE SET
	"name" = EXCLUDED."name",
	"allowed_host" = EXCLUDED."allowed_host",
	"collection_interval_minutes" = EXCLUDED."collection_interval_minutes",
	"timeout_ms" = EXCLUDED."timeout_ms",
	"updated_at" = now();--> statement-breakpoint
CREATE FUNCTION "prevent_hotspot_archive_mutation"() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
	RAISE EXCEPTION 'hotspot archives are immutable';
END;
$$;--> statement-breakpoint
CREATE TRIGGER "prevent_daily_hotspot_archive_update"
BEFORE UPDATE OR DELETE ON "daily_hotspot_archives"
FOR EACH ROW
EXECUTE FUNCTION "prevent_hotspot_archive_mutation"();--> statement-breakpoint
CREATE TRIGGER "prevent_daily_hotspot_archive_item_update"
BEFORE UPDATE OR DELETE ON "daily_hotspot_archive_items"
FOR EACH ROW
EXECUTE FUNCTION "prevent_hotspot_archive_mutation"();
