import {
  HOTSPOT_SOURCE_CODES,
  type HotspotSourceCode,
  type NormalizedHotspotCandidate,
} from "@kagula/contracts/hotspots";
import type { DatabaseClient } from "@kagula/database/client";
import { hotspotCandidates, hotspotSources } from "@kagula/database/schema";
import { asc, eq, sql } from "drizzle-orm";

export interface HotspotSourceConfiguration {
  readonly id: string;
  readonly code: HotspotSourceCode;
  readonly enabled: boolean;
  readonly allowedHost: string;
  readonly timeoutMs: number;
}

export interface SourceCollectionRequest {
  readonly source: HotspotSourceConfiguration;
  readonly attemptedAt: Date;
  readonly collect: () => Promise<readonly NormalizedHotspotCandidate[]>;
}

export type SourceCollectionResult =
  | Readonly<{ status: "LOCKED" }>
  | Readonly<{ status: "SUCCEEDED"; candidateCount: number }>
  | Readonly<{ status: "FAILED"; errorSummary: string }>;

export interface HotspotCollectionRepository {
  readonly listSources: () => Promise<readonly HotspotSourceConfiguration[]>;
  readonly runSourceCollection: (
    request: SourceCollectionRequest,
  ) => Promise<SourceCollectionResult>;
}

function createErrorSummary(error: unknown): string {
  const message = error instanceof Error ? error.message : "unknown source failure";
  return (
    [...message.replace(/[\u0000-\u001F\u007F-\u009F]+/gu, " ").trim()].slice(0, 512).join("") ||
    "unknown source failure"
  );
}

const sourceCodes = new Set<string>(HOTSPOT_SOURCE_CODES);

function parseSourceCode(value: string): HotspotSourceCode {
  if (!sourceCodes.has(value)) throw new Error(`unsupported hotspot source code: ${value}`);
  return value as HotspotSourceCode;
}

export function createHotspotCollectionRepository(
  database: DatabaseClient,
): HotspotCollectionRepository {
  return {
    listSources: async () => {
      const rows = await database.db
        .select({
          id: hotspotSources.id,
          code: hotspotSources.code,
          enabled: hotspotSources.enabled,
          allowedHost: hotspotSources.allowedHost,
          timeoutMs: hotspotSources.timeoutMs,
        })
        .from(hotspotSources)
        .orderBy(asc(hotspotSources.code));
      return rows.map((row) => ({ ...row, code: parseSourceCode(row.code) }));
    },

    runSourceCollection: async (request) =>
      database.db.transaction(async (transaction) => {
        const lockKey = `kagura_hotspot_source:${request.source.code}`;
        const [lock] = await transaction.execute<{ acquired: boolean }>(
          sql`select pg_try_advisory_xact_lock(hashtext(${lockKey})) as acquired`,
        );
        if (!lock?.acquired) return { status: "LOCKED" as const };

        let candidates: readonly NormalizedHotspotCandidate[];
        try {
          candidates = await request.collect();
          if (candidates.some((candidate) => candidate.sourceCode !== request.source.code)) {
            throw new Error("source adapter returned a candidate for another source");
          }
        } catch (error) {
          const errorSummary = createErrorSummary(error);
          await transaction
            .update(hotspotSources)
            .set({
              lastAttemptAt: request.attemptedAt,
              lastFailureAt: request.attemptedAt,
              lastError: errorSummary,
              consecutiveFailures: sql`${hotspotSources.consecutiveFailures} + 1`,
              updatedAt: request.attemptedAt,
            })
            .where(eq(hotspotSources.id, request.source.id));
          return { status: "FAILED" as const, errorSummary };
        }

        for (const candidate of candidates) {
          await transaction
            .insert(hotspotCandidates)
            .values({
              sourceId: request.source.id,
              externalId: candidate.externalId,
              originalTitle: candidate.title,
              displayTitle: candidate.title,
              originalUrl: candidate.url,
              normalizedUrl: candidate.normalizedUrl,
              sourceRank: candidate.rank,
              sourceScore: candidate.score ?? null,
              sourceCategory: candidate.category ?? null,
              dedupeKey: candidate.dedupeKey,
              rawFingerprint: candidate.rawFingerprint,
              capturedAt: candidate.capturedAt,
              createdAt: request.attemptedAt,
              updatedAt: request.attemptedAt,
            })
            .onConflictDoUpdate({
              target: [hotspotCandidates.sourceId, hotspotCandidates.dedupeKey],
              set: {
                externalId: candidate.externalId,
                originalTitle: candidate.title,
                originalUrl: candidate.url,
                normalizedUrl: candidate.normalizedUrl,
                sourceRank: candidate.rank,
                sourceScore: candidate.score ?? null,
                sourceCategory: candidate.category ?? null,
                rawFingerprint: candidate.rawFingerprint,
                capturedAt: candidate.capturedAt,
                updatedAt: request.attemptedAt,
              },
            });
        }

        await transaction
          .update(hotspotSources)
          .set({
            lastAttemptAt: request.attemptedAt,
            lastSuccessAt: request.attemptedAt,
            lastError: null,
            consecutiveFailures: 0,
            updatedAt: request.attemptedAt,
          })
          .where(eq(hotspotSources.id, request.source.id));
        return { status: "SUCCEEDED" as const, candidateCount: candidates.length };
      }),
  };
}
