import type { DatabaseClient } from "@kagula/database/client";
import { auditLogs, hotspotCandidates, hotspotSources, users } from "@kagula/database/schema";
import { and, asc, desc, eq, gt } from "drizzle-orm";

import {
  canTransitionHotspotStatus,
  type HotspotCandidateStatus,
  type HotspotReviewMutation,
  type HotspotReviewRepositoryResult,
} from "./hotspot-review-service";

export interface HotspotReviewFilter {
  readonly status?: HotspotCandidateStatus;
  readonly sourceCode?: string;
  readonly limit?: number;
}

export interface HotspotReviewCandidate {
  readonly id: string;
  readonly sourceCode: string;
  readonly sourceName: string;
  readonly sourceEnabled: boolean;
  readonly sourceLastSuccessAt: Date | null;
  readonly sourceLastFailureAt: Date | null;
  readonly sourceLastError: string | null;
  readonly sourceConsecutiveFailures: number;
  readonly originalTitle: string;
  readonly displayTitle: string;
  readonly url: string;
  readonly sourceRank: number;
  readonly sourceScore: number | null;
  readonly sourceCategory: string | null;
  readonly status: HotspotCandidateStatus;
  readonly publicOrder: number | null;
  readonly capturedAt: Date;
  readonly reviewedAt: Date | null;
  readonly expiresAt: Date | null;
}

export interface PublicHotspotItem {
  readonly id: string;
  readonly sourceCode: string;
  readonly sourceName: string;
  readonly title: string;
  readonly url: string;
  readonly sourceRank: number;
  readonly sourceScore: number | null;
  readonly sourceCategory: string | null;
  readonly publicOrder: number;
  readonly capturedAt: Date;
}

export interface HotspotRepository {
  readonly listReviewCandidates: (
    filter?: HotspotReviewFilter,
  ) => Promise<readonly HotspotReviewCandidate[]>;
  readonly reviewCandidate: (
    input: HotspotReviewMutation,
  ) => Promise<HotspotReviewRepositoryResult>;
  readonly listCurrentPublic: (now: Date) => Promise<readonly PublicHotspotItem[]>;
}

const auditAction = {
  APPROVE: "HOTSPOT_APPROVED",
  REJECT: "HOTSPOT_REJECTED",
  EXPIRE: "HOTSPOT_EXPIRED",
  REORDER: "HOTSPOT_REORDERED",
} as const;

function clampLimit(value: number | undefined): number {
  if (!Number.isInteger(value)) return 100;
  return Math.max(1, Math.min(value ?? 100, 200));
}

export function createHotspotRepository(database: DatabaseClient): HotspotRepository {
  return {
    listReviewCandidates: (filter = {}) =>
      database.db
        .select({
          id: hotspotCandidates.id,
          sourceCode: hotspotSources.code,
          sourceName: hotspotSources.name,
          sourceEnabled: hotspotSources.enabled,
          sourceLastSuccessAt: hotspotSources.lastSuccessAt,
          sourceLastFailureAt: hotspotSources.lastFailureAt,
          sourceLastError: hotspotSources.lastError,
          sourceConsecutiveFailures: hotspotSources.consecutiveFailures,
          originalTitle: hotspotCandidates.originalTitle,
          displayTitle: hotspotCandidates.displayTitle,
          url: hotspotCandidates.normalizedUrl,
          sourceRank: hotspotCandidates.sourceRank,
          sourceScore: hotspotCandidates.sourceScore,
          sourceCategory: hotspotCandidates.sourceCategory,
          status: hotspotCandidates.status,
          publicOrder: hotspotCandidates.publicOrder,
          capturedAt: hotspotCandidates.capturedAt,
          reviewedAt: hotspotCandidates.reviewedAt,
          expiresAt: hotspotCandidates.expiresAt,
        })
        .from(hotspotCandidates)
        .innerJoin(hotspotSources, eq(hotspotSources.id, hotspotCandidates.sourceId))
        .where(
          and(
            filter.status ? eq(hotspotCandidates.status, filter.status) : undefined,
            filter.sourceCode ? eq(hotspotSources.code, filter.sourceCode) : undefined,
          ),
        )
        .orderBy(desc(hotspotCandidates.capturedAt), asc(hotspotCandidates.sourceRank))
        .limit(clampLimit(filter.limit)),

    reviewCandidate: (input) =>
      database.db.transaction(async (transaction) => {
        const [actor] = await transaction
          .select({ role: users.role, status: users.status })
          .from(users)
          .where(eq(users.id, input.actorUserId))
          .limit(1);
        if (!actor || actor.role !== "ADMIN" || actor.status === "BANNED") {
          return { status: "FORBIDDEN" };
        }

        const [candidate] = await transaction
          .select({
            status: hotspotCandidates.status,
            displayTitle: hotspotCandidates.displayTitle,
            publicOrder: hotspotCandidates.publicOrder,
            expiresAt: hotspotCandidates.expiresAt,
          })
          .from(hotspotCandidates)
          .where(eq(hotspotCandidates.id, input.candidateId))
          .limit(1)
          .for("update");
        if (!candidate) return { status: "CANDIDATE_NOT_FOUND" };
        if (!canTransitionHotspotStatus(candidate.status, input.operation)) {
          return { status: "INVALID_TRANSITION" };
        }

        const nextStatus =
          input.operation === "APPROVE"
            ? "APPROVED"
            : input.operation === "REJECT"
              ? "REJECTED"
              : input.operation === "EXPIRE"
                ? "EXPIRED"
                : "APPROVED";
        const publicMetadata =
          input.operation === "APPROVE" || input.operation === "REORDER"
            ? { displayTitle: input.displayTitle, publicOrder: input.publicOrder }
            : { publicOrder: null };
        const expiryMetadata =
          input.operation === "APPROVE"
            ? { expiresAt: input.expiresAt }
            : input.operation === "REJECT"
              ? { expiresAt: null }
              : {};
        const [updated] = await transaction
          .update(hotspotCandidates)
          .set({
            status: nextStatus,
            ...publicMetadata,
            ...expiryMetadata,
            reviewedByUserId: input.actorUserId,
            reviewedAt: input.changedAt,
            updatedAt: input.changedAt,
          })
          .where(
            and(
              eq(hotspotCandidates.id, input.candidateId),
              eq(hotspotCandidates.status, candidate.status),
            ),
          )
          .returning({ id: hotspotCandidates.id });
        if (!updated) return { status: "INVALID_TRANSITION" };

        await transaction.insert(auditLogs).values({
          actorUserId: input.actorUserId,
          action: auditAction[input.operation],
          resourceType: "HOTSPOT_CANDIDATE",
          resourceId: input.candidateId,
          summary: {
            previousStatus: candidate.status,
            status: nextStatus,
            previousDisplayTitle: candidate.displayTitle,
            displayTitle:
              input.operation === "APPROVE" || input.operation === "REORDER"
                ? input.displayTitle
                : candidate.displayTitle,
            previousPublicOrder: candidate.publicOrder,
            publicOrder:
              input.operation === "APPROVE" || input.operation === "REORDER"
                ? input.publicOrder
                : null,
            previousExpiresAt: candidate.expiresAt?.toISOString() ?? null,
            expiresAt:
              input.operation === "APPROVE"
                ? input.expiresAt.toISOString()
                : (candidate.expiresAt?.toISOString() ?? null),
          },
          createdAt: input.changedAt,
        });
        return { status: "SUCCESS" };
      }),

    listCurrentPublic: async (now) => {
      const rows = await database.db
        .select({
          id: hotspotCandidates.id,
          sourceCode: hotspotSources.code,
          sourceName: hotspotSources.name,
          title: hotspotCandidates.displayTitle,
          url: hotspotCandidates.normalizedUrl,
          sourceRank: hotspotCandidates.sourceRank,
          sourceScore: hotspotCandidates.sourceScore,
          sourceCategory: hotspotCandidates.sourceCategory,
          publicOrder: hotspotCandidates.publicOrder,
          capturedAt: hotspotCandidates.capturedAt,
        })
        .from(hotspotCandidates)
        .innerJoin(hotspotSources, eq(hotspotSources.id, hotspotCandidates.sourceId))
        .where(
          and(
            eq(hotspotSources.enabled, true),
            eq(hotspotCandidates.status, "APPROVED"),
            gt(hotspotCandidates.expiresAt, now),
          ),
        )
        .orderBy(
          asc(hotspotCandidates.publicOrder),
          asc(hotspotCandidates.sourceRank),
          asc(hotspotCandidates.id),
        );
      return rows.map((row) => {
        if (row.publicOrder === null) {
          throw new Error("approved hotspot is missing its public order");
        }
        return { ...row, publicOrder: row.publicOrder };
      });
    },
  };
}
