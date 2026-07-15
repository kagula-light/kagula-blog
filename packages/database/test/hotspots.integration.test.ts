import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import postgres from "postgres";

import { runMigrations } from "../src/migrate";

const databaseUrl = process.env.TEST_DATABASE_URL;
let client: ReturnType<typeof postgres> | undefined;

describe("hotspot database constraints", () => {
  const suffix = randomUUID().replaceAll("-", "").slice(0, 12);
  const archiveDay = 10 + (Number.parseInt(suffix.slice(0, 2), 16) % 18);
  const archiveDate = `2099-11-${archiveDay.toString().padStart(2, "0")}`;
  let sourceId = "";
  let candidateId = "";
  let archiveId = "";

  beforeAll(async () => {
    if (!databaseUrl) {
      throw new Error("TEST_DATABASE_URL is required for hotspot integration tests");
    }
    await runMigrations({ databaseUrl });
    client = postgres(databaseUrl, { max: 1 });
    const [source] = await client<{ id: string }[]>`
      select id from hotspot_sources where code = 'GITHUB_TRENDING'
    `;
    if (!source) throw new Error("seeded hotspot source was not found");
    sourceId = source.id;
  });

  afterAll(async () => {
    await client?.end({ timeout: 5 });
  });

  it("seeds the five V1 sources idempotently", async () => {
    if (!client) throw new Error("database client was not initialized");
    await runMigrations({ databaseUrl: databaseUrl as string });
    const rows = await client<{ code: string; enabled: boolean }[]>`
      select code, enabled from hotspot_sources order by code
    `;
    expect(rows).toEqual([
      { code: "BAIDU", enabled: true },
      { code: "BILIBILI", enabled: true },
      { code: "GITHUB_TRENDING", enabled: true },
      { code: "HACKER_NEWS", enabled: true },
      { code: "WEIBO", enabled: true },
    ]);
  });

  it("enforces per-source candidate dedupe and approved review fields", async () => {
    if (!client) throw new Error("database client was not initialized");
    const dedupeKey = suffix.repeat(6).slice(0, 64);
    const [candidate] = await client<{ id: string }[]>`
      insert into hotspot_candidates (
        source_id, external_id, original_title, display_title, original_url,
        normalized_url, source_rank, dedupe_key, raw_fingerprint, captured_at
      ) values (
        ${sourceId}, ${`repo:${suffix}`}, 'Original title', 'Display title',
        'https://github.com/example/repository', 'https://github.com/example/repository',
        1, ${dedupeKey}, ${`fixture-${suffix}`}, now()
      ) returning id
    `;
    if (!candidate) throw new Error("hotspot candidate fixture was not created");
    candidateId = candidate.id;

    await expect(client`
      insert into hotspot_candidates (
        source_id, original_title, display_title, original_url, normalized_url,
        source_rank, dedupe_key, raw_fingerprint, captured_at
      ) values (
        ${sourceId}, 'Duplicate', 'Duplicate', 'https://github.com/example/other',
        'https://github.com/example/other', 2, ${dedupeKey}, 'duplicate', now()
      )
    `).rejects.toThrow();

    await expect(client`
      update hotspot_candidates set status = 'APPROVED' where id = ${candidateId}
    `).rejects.toThrow();

    await client`
      update hotspot_candidates set
        status = 'APPROVED', reviewed_at = now(), expires_at = now() + interval '1 day',
        public_order = 1, updated_at = now()
      where id = ${candidateId}
    `;
    const [approved] = await client<{ status: string; public_order: number }[]>`
      select status, public_order from hotspot_candidates where id = ${candidateId}
    `;
    expect(approved).toEqual({ status: "APPROVED", public_order: 1 });
  });

  it("creates one immutable archive snapshot per Beijing date", async () => {
    if (!client) throw new Error("database client was not initialized");
    const [archive] = await client<{ id: string }[]>`
      insert into daily_hotspot_archives (archive_date, item_count)
      values (${archiveDate}, 1)
      returning id
    `;
    if (!archive) throw new Error("hotspot archive fixture was not created");
    archiveId = archive.id;
    await client`
      insert into daily_hotspot_archive_items (
        archive_id, position, candidate_id, source_code, source_name,
        title, url, source_rank, captured_at
      ) values (
        ${archiveId}, 1, ${candidateId}, 'GITHUB_TRENDING', 'GitHub Trending',
        'Snapshot title', 'https://github.com/example/repository', 1, now()
      )
    `;

    await expect(client`
      update daily_hotspot_archive_items set title = 'Mutated' where archive_id = ${archiveId}
    `).rejects.toThrow("immutable");
    await expect(client`
      delete from hotspot_candidates where id = ${candidateId}
    `).rejects.toThrow("immutable");

    await client`
      insert into daily_hotspot_archives (archive_date, item_count)
      values (${archiveDate}, 1) on conflict (archive_date) do nothing
    `;
    const [count] = await client<{ value: number }[]>`
      select count(*)::int as value from daily_hotspot_archives where archive_date = ${archiveDate}
    `;
    expect(count?.value).toBe(1);
  });
});
