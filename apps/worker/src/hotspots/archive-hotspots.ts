import type { DatabaseClient } from "@kagula/database/client";
import {
  dailyHotspotArchiveItems,
  dailyHotspotArchives,
  hotspotCandidates,
  hotspotSources,
} from "@kagula/database/schema";
import { and, asc, eq, gt, sql } from "drizzle-orm";

export interface DailyHotspotArchiveInput {
  readonly archiveDate: string;
  readonly archivedAt: Date;
}

export type DailyHotspotArchiveResult = Readonly<{
  status: "CREATED" | "EXISTING" | "LOCKED";
  itemCount: number;
}>;

export interface DailyHotspotArchiveRepository {
  readonly createArchive: (input: DailyHotspotArchiveInput) => Promise<DailyHotspotArchiveResult>;
}

const beijingDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Shanghai",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function getPreviousBeijingDate(instant: Date): string {
  if (!Number.isFinite(instant.getTime())) throw new Error("archive instant is invalid");
  const parts = beijingDateFormatter.formatToParts(instant);
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const day = Number(parts.find((part) => part.type === "day")?.value);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    throw new Error("Beijing archive date could not be derived");
  }
  const previous = new Date(Date.UTC(year, month - 1, day - 1));
  return `${previous.getUTCFullYear().toString().padStart(4, "0")}-${(previous.getUTCMonth() + 1)
    .toString()
    .padStart(2, "0")}-${previous.getUTCDate().toString().padStart(2, "0")}`;
}

export function archiveHotspots(
  repository: DailyHotspotArchiveRepository,
  now: Date = new Date(),
): Promise<DailyHotspotArchiveResult> {
  return repository.createArchive({
    archiveDate: getPreviousBeijingDate(now),
    archivedAt: now,
  });
}

export function createDailyHotspotArchiveRepository(
  database: DatabaseClient,
): DailyHotspotArchiveRepository {
  return {
    createArchive: (input) =>
      database.db.transaction(async (transaction) => {
        const lockKey = `kagura_hotspot_archive:${input.archiveDate}`;
        const [lock] = await transaction.execute<{ acquired: boolean }>(
          sql`select pg_try_advisory_xact_lock(hashtext(${lockKey})) as acquired`,
        );
        if (!lock?.acquired) return { status: "LOCKED", itemCount: 0 };

        const [existing] = await transaction
          .select({ itemCount: dailyHotspotArchives.itemCount })
          .from(dailyHotspotArchives)
          .where(eq(dailyHotspotArchives.archiveDate, input.archiveDate))
          .limit(1);
        if (existing) return { status: "EXISTING", itemCount: existing.itemCount };

        const candidates = await transaction
          .select({
            candidateId: hotspotCandidates.id,
            sourceCode: hotspotSources.code,
            sourceName: hotspotSources.name,
            title: hotspotCandidates.displayTitle,
            url: hotspotCandidates.normalizedUrl,
            sourceRank: hotspotCandidates.sourceRank,
            capturedAt: hotspotCandidates.capturedAt,
          })
          .from(hotspotCandidates)
          .innerJoin(hotspotSources, eq(hotspotSources.id, hotspotCandidates.sourceId))
          .where(
            and(
              eq(hotspotSources.enabled, true),
              eq(hotspotCandidates.status, "APPROVED"),
              gt(hotspotCandidates.expiresAt, input.archivedAt),
            ),
          )
          .orderBy(
            asc(hotspotCandidates.publicOrder),
            asc(hotspotCandidates.sourceRank),
            asc(hotspotCandidates.id),
          );

        const [archive] = await transaction
          .insert(dailyHotspotArchives)
          .values({ archiveDate: input.archiveDate, itemCount: candidates.length })
          .returning({ id: dailyHotspotArchives.id });
        if (!archive) throw new Error("daily hotspot archive insert returned no identifier");
        if (candidates.length > 0) {
          await transaction.insert(dailyHotspotArchiveItems).values(
            candidates.map((candidate, index) => ({
              archiveId: archive.id,
              position: index + 1,
              candidateId: candidate.candidateId,
              sourceCode: candidate.sourceCode,
              sourceName: candidate.sourceName,
              title: candidate.title,
              url: candidate.url,
              sourceRank: candidate.sourceRank,
              capturedAt: candidate.capturedAt,
            })),
          );
        }
        return { status: "CREATED", itemCount: candidates.length };
      }),
  };
}
