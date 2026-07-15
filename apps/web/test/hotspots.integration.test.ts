import { randomUUID } from "node:crypto";

import { createDatabaseClient, type DatabaseClient } from "@kagula/database/client";
import { runMigrations } from "@kagula/database/migrate";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createHotspotRepository } from "../src/features/hotspots/server/hotspot-repository";

const databaseUrl = process.env.TEST_DATABASE_URL;
let database: DatabaseClient | undefined;

function getDatabase(): DatabaseClient {
  if (!database) throw new Error("database client was not initialized");
  return database;
}

describe("hotspot review repository", () => {
  const suffix = randomUUID().replaceAll("-", "").slice(0, 12);
  const candidateIds: string[] = [];
  let sourceId = "";
  let adminId = "";
  let userId = "";
  let bannedAdminId = "";
  let approveId = "";
  let rejectId = "";
  let expireId = "";
  let reorderId = "";
  let staleApprovedId = "";

  beforeAll(async () => {
    if (!databaseUrl)
      throw new Error("TEST_DATABASE_URL is required for hotspot integration tests");
    await runMigrations({ databaseUrl });
    database = createDatabaseClient(databaseUrl);
    const [source] = await getDatabase().client<{ id: string }[]>`
      select id from hotspot_sources where code = 'GITHUB_TRENDING'
    `;
    if (!source) throw new Error("seeded hotspot source was not found");
    sourceId = source.id;
    const identities = await getDatabase().client<{ id: string; role: string; status: string }[]>`
      insert into users (username, normalized_username, display_name, role, status)
      values
        (${`hotspot_admin_${suffix}`}, ${`hotspot_admin_${suffix}`}, 'Hotspot Admin', 'ADMIN', 'ACTIVE'),
        (${`hotspot_user_${suffix}`}, ${`hotspot_user_${suffix}`}, 'Hotspot User', 'USER', 'ACTIVE'),
        (${`hotspot_banned_${suffix}`}, ${`hotspot_banned_${suffix}`}, 'Banned Admin', 'ADMIN', 'BANNED')
      returning id, role, status
    `;
    adminId =
      identities.find((identity) => identity.role === "ADMIN" && identity.status === "ACTIVE")
        ?.id ?? "";
    userId = identities.find((identity) => identity.role === "USER")?.id ?? "";
    bannedAdminId = identities.find((identity) => identity.status === "BANNED")?.id ?? "";
    if (!adminId || !userId || !bannedAdminId)
      throw new Error("hotspot identities were not created");

    const candidates = await getDatabase().client<{ id: string; external_id: string }[]>`
      insert into hotspot_candidates (
        source_id, external_id, original_title, display_title, original_url,
        normalized_url, source_rank, dedupe_key, raw_fingerprint, status,
        public_order, reviewed_at, expires_at, captured_at
      ) values
        (${sourceId}, ${`approve-${suffix}`}, 'Approve me', 'Approve me', 'https://github.com/example/approve', 'https://github.com/example/approve', 2, ${`a${suffix}`.padEnd(64, "a")}, ${`raw-a-${suffix}`}, 'PENDING', null, null, null, '2026-07-15T07:00:00Z'),
        (${sourceId}, ${`reject-${suffix}`}, 'Reject me', 'Reject me', 'https://github.com/example/reject', 'https://github.com/example/reject', 3, ${`b${suffix}`.padEnd(64, "b")}, ${`raw-b-${suffix}`}, 'PENDING', null, null, null, '2026-07-15T07:00:00Z'),
        (${sourceId}, ${`expire-${suffix}`}, 'Expire me', 'Expire me', 'https://github.com/example/expire', 'https://github.com/example/expire', 4, ${`c${suffix}`.padEnd(64, "c")}, ${`raw-c-${suffix}`}, 'APPROVED', 3, '2026-07-15T07:00:00Z', '2026-07-16T07:00:00Z', '2026-07-15T07:00:00Z'),
        (${sourceId}, ${`reorder-${suffix}`}, 'Reorder me', 'Reorder me', 'https://github.com/example/reorder', 'https://github.com/example/reorder', 1, ${`d${suffix}`.padEnd(64, "d")}, ${`raw-d-${suffix}`}, 'APPROVED', 4, '2026-07-15T07:00:00Z', '2026-07-16T07:00:00Z', '2026-07-15T07:00:00Z'),
        (${sourceId}, ${`stale-${suffix}`}, 'Stale approved', 'Stale approved', 'https://github.com/example/stale', 'https://github.com/example/stale', 5, ${`e${suffix}`.padEnd(64, "e")}, ${`raw-e-${suffix}`}, 'APPROVED', 5, '2026-07-14T07:00:00Z', '2026-07-15T07:30:00Z', '2026-07-14T07:00:00Z')
      returning id, external_id
    `;
    for (const candidate of candidates) candidateIds.push(candidate.id);
    approveId =
      candidates.find((candidate) => candidate.external_id === `approve-${suffix}`)?.id ?? "";
    rejectId =
      candidates.find((candidate) => candidate.external_id === `reject-${suffix}`)?.id ?? "";
    expireId =
      candidates.find((candidate) => candidate.external_id === `expire-${suffix}`)?.id ?? "";
    reorderId =
      candidates.find((candidate) => candidate.external_id === `reorder-${suffix}`)?.id ?? "";
    staleApprovedId =
      candidates.find((candidate) => candidate.external_id === `stale-${suffix}`)?.id ?? "";
    if (!approveId || !rejectId || !expireId || !reorderId || !staleApprovedId) {
      throw new Error("hotspot candidate fixtures were not created");
    }
  });

  afterAll(async () => {
    if (!database) return;
    await database.client`delete from audit_logs where resource_type = 'HOTSPOT_CANDIDATE' and resource_id in ${database.client(candidateIds)}`;
    await database.client`delete from hotspot_candidates where id in ${database.client(candidateIds)}`;
    await database.client`update hotspot_sources set enabled = true where id = ${sourceId}`;
    await database.client`delete from users where id in (${adminId}, ${userId}, ${bannedAdminId})`;
    await database.close();
  });

  it("re-reads administrator authority inside the transaction", async () => {
    const repository = createHotspotRepository(getDatabase());
    const base = {
      candidateId: approveId,
      operation: "REJECT" as const,
      changedAt: new Date("2026-07-15T08:00:00.000Z"),
    };
    await expect(repository.reviewCandidate({ ...base, actorUserId: userId })).resolves.toEqual({
      status: "FORBIDDEN",
    });
    await expect(
      repository.reviewCandidate({ ...base, actorUserId: bannedAdminId }),
    ).resolves.toEqual({ status: "FORBIDDEN" });
  });

  it("reviews, expires, reorders, rejects stale transitions, and audits each action", async () => {
    const repository = createHotspotRepository(getDatabase());
    const changedAt = new Date("2026-07-15T08:00:00.000Z");
    await expect(
      repository.reviewCandidate({
        actorUserId: adminId,
        candidateId: approveId,
        operation: "APPROVE",
        displayTitle: "Approved title",
        publicOrder: 2,
        changedAt,
        expiresAt: new Date("2026-07-16T08:00:00.000Z"),
      }),
    ).resolves.toEqual({ status: "SUCCESS" });
    await expect(
      repository.reviewCandidate({
        actorUserId: adminId,
        candidateId: approveId,
        operation: "APPROVE",
        displayTitle: "Again",
        publicOrder: 8,
        changedAt,
        expiresAt: new Date("2026-07-16T08:00:00.000Z"),
      }),
    ).resolves.toEqual({ status: "INVALID_TRANSITION" });
    await expect(
      repository.reviewCandidate({
        actorUserId: adminId,
        candidateId: rejectId,
        operation: "REJECT",
        changedAt,
      }),
    ).resolves.toEqual({ status: "SUCCESS" });
    await expect(
      repository.reviewCandidate({
        actorUserId: adminId,
        candidateId: expireId,
        operation: "EXPIRE",
        changedAt,
      }),
    ).resolves.toEqual({ status: "SUCCESS" });
    await expect(
      repository.reviewCandidate({
        actorUserId: adminId,
        candidateId: reorderId,
        operation: "REORDER",
        displayTitle: "First public item",
        publicOrder: 1,
        changedAt,
      }),
    ).resolves.toEqual({ status: "SUCCESS" });

    const auditRows = await getDatabase().client<{ action: string; resource_id: string }[]>`
      select action, resource_id from audit_logs
      where resource_type = 'HOTSPOT_CANDIDATE' and resource_id in ${getDatabase().client(candidateIds)}
      order by action
    `;
    expect(auditRows).toEqual([
      { action: "HOTSPOT_APPROVED", resource_id: approveId },
      { action: "HOTSPOT_EXPIRED", resource_id: expireId },
      { action: "HOTSPOT_REJECTED", resource_id: rejectId },
      { action: "HOTSPOT_REORDERED", resource_id: reorderId },
    ]);
  });

  it("returns only enabled, approved, unexpired items in public order", async () => {
    const repository = createHotspotRepository(getDatabase());
    const now = new Date("2026-07-15T08:30:00.000Z");
    const publicItems = await repository.listCurrentPublic(now);
    const fixtureItems = publicItems.filter((item) => candidateIds.includes(item.id));
    expect(fixtureItems).toEqual([
      expect.objectContaining({ id: reorderId, title: "First public item", publicOrder: 1 }),
      expect.objectContaining({ id: approveId, title: "Approved title", publicOrder: 2 }),
    ]);
    expect(fixtureItems[0]).not.toHaveProperty("lastError");
    expect(fixtureItems[0]).not.toHaveProperty("consecutiveFailures");

    await getDatabase().client`update hotspot_sources set enabled = false where id = ${sourceId}`;
    const disabledItems = await repository.listCurrentPublic(now);
    expect(disabledItems.filter((item) => candidateIds.includes(item.id))).toEqual([]);
  });

  it("reads recent archive metadata and ordered immutable snapshots", async () => {
    const archiveDay = 10 + (Number.parseInt(suffix.slice(0, 2), 16) % 18);
    const archiveDate = `2098-10-${archiveDay.toString().padStart(2, "0")}`;
    const [archive] = await getDatabase().client<{ id: string }[]>`
      insert into daily_hotspot_archives (archive_date, item_count)
      values (${archiveDate}, 2)
      returning id
    `;
    if (!archive) throw new Error("hotspot archive fixture was not created");
    await getDatabase().client`
      insert into daily_hotspot_archive_items (
        archive_id, position, source_code, source_name, title, url, source_rank, captured_at
      ) values
        (${archive.id}, 2, 'HACKER_NEWS', 'Hacker News', 'Second archived item',
          'https://news.ycombinator.com/item?id=2', 2, '2098-10-10T00:00:00Z'),
        (${archive.id}, 1, 'GITHUB_TRENDING', 'GitHub Trending', 'First archived item',
          'https://github.com/example/archive', 1, '2098-10-10T00:00:00Z')
    `;

    const repository = createHotspotRepository(getDatabase());
    await expect(repository.listRecentArchives(100)).resolves.toContainEqual(
      expect.objectContaining({ archiveDate, itemCount: 2 }),
    );
    await expect(repository.findArchive(archiveDate)).resolves.toEqual(
      expect.objectContaining({
        archiveDate,
        itemCount: 2,
        items: [
          expect.objectContaining({ position: 1, title: "First archived item" }),
          expect.objectContaining({ position: 2, title: "Second archived item" }),
        ],
      }),
    );
    await expect(repository.findArchive("2098-01-01")).resolves.toBeNull();
  });
});
