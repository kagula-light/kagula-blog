import { randomUUID } from "node:crypto";

import { normalizeHotspotCandidate } from "@kagula/contracts/hotspots";
import { createDatabaseClient, type DatabaseClient } from "@kagula/database/client";
import { runMigrations } from "@kagula/database/migrate";
import { hotspotCandidates, hotspotSources } from "@kagula/database/schema";
import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  createHotspotCollectionRepository,
  type HotspotSourceConfiguration,
} from "../src/hotspots/hotspot-repository";

const databaseUrl = process.env.TEST_DATABASE_URL;
let primaryDatabase: DatabaseClient | undefined;
let competingDatabase: DatabaseClient | undefined;
let source: HotspotSourceConfiguration | undefined;

describe("hotspot collection repository", () => {
  const externalId = `repo:integration-${randomUUID()}`;
  const firstCapturedAt = new Date("2099-07-15T01:00:00.000Z");
  const secondCapturedAt = new Date("2099-07-15T01:30:00.000Z");

  beforeAll(async () => {
    if (!databaseUrl) throw new Error("TEST_DATABASE_URL is required for Worker integration tests");
    await runMigrations({ databaseUrl });
    primaryDatabase = createDatabaseClient(databaseUrl);
    competingDatabase = createDatabaseClient(databaseUrl);
    source = (await createHotspotCollectionRepository(primaryDatabase).listSources()).find(
      (candidate) => candidate.code === "GITHUB_TRENDING",
    );
    if (!source) throw new Error("seeded GitHub Trending source was not found");
  });

  afterAll(async () => {
    if (primaryDatabase && source) {
      await primaryDatabase.db
        .delete(hotspotCandidates)
        .where(
          and(
            eq(hotspotCandidates.sourceId, source.id),
            eq(hotspotCandidates.externalId, externalId),
          ),
        );
      await primaryDatabase.db
        .update(hotspotSources)
        .set({ lastError: null, consecutiveFailures: 0 })
        .where(eq(hotspotSources.id, source.id));
    }
    await competingDatabase?.close();
    await primaryDatabase?.close();
  });

  it("updates duplicate metadata without resetting an approved review", async () => {
    if (!primaryDatabase || !source) throw new Error("integration database was not initialized");
    const repository = createHotspotCollectionRepository(primaryDatabase);
    const firstCandidate = normalizeHotspotCandidate(
      {
        sourceCode: "GITHUB_TRENDING",
        externalId,
        title: "Original integration title",
        url: "https://github.com/kagula-light/kagula-blog",
        rank: 8,
        score: 20,
        capturedAt: firstCapturedAt,
        rawFingerprint: "1".repeat(64),
      },
      { allowedHosts: ["github.com"] },
    );
    await expect(
      repository.runSourceCollection({
        source,
        attemptedAt: firstCapturedAt,
        collect: async () => [firstCandidate],
      }),
    ).resolves.toEqual({ status: "SUCCEEDED", candidateCount: 1 });

    await primaryDatabase.db
      .update(hotspotCandidates)
      .set({
        status: "APPROVED",
        displayTitle: "Curated display title",
        publicOrder: 4,
        reviewedAt: firstCapturedAt,
        expiresAt: new Date("2099-07-16T01:00:00.000Z"),
      })
      .where(eq(hotspotCandidates.dedupeKey, firstCandidate.dedupeKey));

    const secondCandidate = {
      ...firstCandidate,
      title: "Changed source title",
      rank: 2,
      score: 99,
      capturedAt: secondCapturedAt,
      rawFingerprint: "2".repeat(64),
    };
    await repository.runSourceCollection({
      source,
      attemptedAt: secondCapturedAt,
      collect: async () => [secondCandidate],
    });

    const rows = await primaryDatabase.db
      .select({
        status: hotspotCandidates.status,
        displayTitle: hotspotCandidates.displayTitle,
        originalTitle: hotspotCandidates.originalTitle,
        publicOrder: hotspotCandidates.publicOrder,
        sourceRank: hotspotCandidates.sourceRank,
        sourceScore: hotspotCandidates.sourceScore,
        capturedAt: hotspotCandidates.capturedAt,
      })
      .from(hotspotCandidates)
      .where(eq(hotspotCandidates.dedupeKey, firstCandidate.dedupeKey));
    expect(rows).toEqual([
      {
        status: "APPROVED",
        displayTitle: "Curated display title",
        originalTitle: "Changed source title",
        publicOrder: 4,
        sourceRank: 2,
        sourceScore: 99,
        capturedAt: secondCapturedAt,
      },
    ]);
  });

  it("persists bounded failure health and resets it after success", async () => {
    if (!primaryDatabase || !source) throw new Error("integration database was not initialized");
    const repository = createHotspotCollectionRepository(primaryDatabase);
    const failure = await repository.runSourceCollection({
      source,
      attemptedAt: secondCapturedAt,
      collect: async () => {
        throw new Error(`parse\nfailed ${"x".repeat(600)}`);
      },
    });
    expect(failure.status).toBe("FAILED");
    if (failure.status !== "FAILED") throw new Error("source failure was not recorded");
    expect([...failure.errorSummary]).toHaveLength(512);
    expect(failure.errorSummary).not.toContain("\n");

    const [failedSource] = await primaryDatabase.db
      .select({
        lastError: hotspotSources.lastError,
        consecutiveFailures: hotspotSources.consecutiveFailures,
      })
      .from(hotspotSources)
      .where(eq(hotspotSources.id, source.id));
    expect(failedSource).toEqual({
      lastError: failure.errorSummary,
      consecutiveFailures: 1,
    });

    await repository.runSourceCollection({
      source,
      attemptedAt: new Date(secondCapturedAt.getTime() + 60_000),
      collect: async () => [],
    });
    const [recoveredSource] = await primaryDatabase.db
      .select({
        lastError: hotspotSources.lastError,
        consecutiveFailures: hotspotSources.consecutiveFailures,
      })
      .from(hotspotSources)
      .where(eq(hotspotSources.id, source.id));
    expect(recoveredSource).toEqual({ lastError: null, consecutiveFailures: 0 });
  });

  it("uses a PostgreSQL advisory lock to reject a concurrent source run", async () => {
    if (!primaryDatabase || !competingDatabase || !source) {
      throw new Error("integration database was not initialized");
    }
    const primaryRepository = createHotspotCollectionRepository(primaryDatabase);
    const competingRepository = createHotspotCollectionRepository(competingDatabase);
    let signalStarted: (() => void) | undefined;
    let releaseCollection: (() => void) | undefined;
    const started = new Promise<void>((resolve) => {
      signalStarted = resolve;
    });
    const release = new Promise<void>((resolve) => {
      releaseCollection = resolve;
    });

    const firstRun = primaryRepository.runSourceCollection({
      source,
      attemptedAt: secondCapturedAt,
      collect: async () => {
        signalStarted?.();
        await release;
        return [];
      },
    });
    await started;

    await expect(
      competingRepository.runSourceCollection({
        source,
        attemptedAt: secondCapturedAt,
        collect: async () => [],
      }),
    ).resolves.toEqual({ status: "LOCKED" });
    releaseCollection?.();
    await expect(firstRun).resolves.toEqual({ status: "SUCCEEDED", candidateCount: 0 });
  });
});
