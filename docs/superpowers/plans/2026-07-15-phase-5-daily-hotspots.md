# Phase 5 Daily Hotspots Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Collect metadata from five isolated sources, place normalized candidates behind administrator review, publish approved current items, and create idempotent Beijing-date archives.

**Architecture:** Stable candidate contracts live in `packages/contracts`; PostgreSQL is the only source of review and archive truth. Worker adapters receive a bounded allowlisted fetch port and never write directly to the database. Web Server Components query approved views, while Server Actions re-read ADMIN authority and perform review/audit transactions.

**Tech Stack:** TypeScript 6, Zod, Cheerio, PostgreSQL 17, Drizzle ORM, Next.js 16, React 19, Vitest, Playwright, Node fetch.

---

## Planned File Structure

~~~text
packages/contracts/src/hotspots.ts
packages/database/src/schema/hotspots.ts
packages/database/drizzle/0004_hotspots.sql
packages/database/test/hotspots.integration.test.ts
apps/worker/src/hotspots/
  hotspot-normalization.ts
  source-fetcher.ts
  hotspot-repository.ts
  collect-hotspots.ts
  archive-hotspots.ts
  adapters/
    github-trending.ts
    hacker-news.ts
    bilibili.ts
    weibo.ts
    baidu.ts
  fixtures/<source>/{normal,empty,changed}.*
apps/web/src/features/hotspots/
  server/hotspot-repository.ts
  server/hotspot-review-service.ts
  actions/hotspot-actions.ts
apps/web/src/components/hotspot/hotspot-list.tsx
apps/web/src/components/admin/hotspot-review-table.tsx
apps/web/src/app/hotspots/page.tsx
apps/web/src/app/hotspots/archive/[date]/page.tsx
apps/web/src/app/admin/hotspots/page.tsx
~~~

The source fetcher owns protocol, hostname, redirect, timeout and response-size enforcement. Adapters only parse one versioned fixture shape into `HotspotCandidateInput`. The Worker orchestrator isolates per-source failures and persists health; the Web cannot import adapters or make source requests.

### Task 1: Add stable hotspot contracts and normalization

**Files:**
- Create: `packages/contracts/src/hotspots.ts`
- Create: `packages/contracts/src/hotspots.test.ts`
- Modify: `packages/contracts/package.json`
- Modify: `packages/contracts/tsconfig.json`

- [ ] Write failing tests for NFKC title cleanup, invisible/control-character rejection, tracking-parameter removal, HTTPS-only URLs, host allowlists, deterministic SHA-256 fingerprints and rank boundaries.
- [ ] Export `HOTSPOT_SOURCE_CODES`, `HotspotSourceCode`, `HotspotCandidateInput`, `NormalizedHotspotCandidate`, `normalizeHotspotCandidate` and `createHotspotFingerprint` from the public `./hotspots` package export.
- [ ] Keep `sourceCode`, `externalId`, `title`, `url`, `rank`, optional integer `score`, optional `category`, `capturedAt` and `rawFingerprint`; do not include source payloads or copied content.
- [ ] Run `pnpm --filter @kagula/contracts test` and typecheck.
- [ ] Commit `feat: add hotspot candidate contracts`.

### Task 2: Add source, candidate and archive schema

**Files:**
- Create: `packages/database/src/schema/hotspots.ts`
- Modify: `packages/database/src/schema.ts`
- Create: `packages/database/drizzle/0004_hotspots.sql`
- Modify: `packages/database/drizzle/meta/_journal.json`
- Modify: `packages/database/src/schema.test.ts`
- Create: `packages/database/test/hotspots.integration.test.ts`

- [ ] Define `hotspot_candidate_status` as `PENDING|APPROVED|REJECTED|EXPIRED`.
- [ ] Define `hotspot_sources` with unique code, display name, enabled flag, exact allowed host, interval/timeout, last attempt/success/failure, bounded error summary and consecutive failures.
- [ ] Define candidates with source FK, external ID, original/display title, original/normalized URL, source rank/score/category, unique per-source dedupe key, status, public order, capture/review/expiry timestamps and reviewer FK.
- [ ] Define one archive per Beijing `date` plus immutable ordered snapshot items containing source code/name, display title, URL, source rank and capture time.
- [ ] Seed the five source rows idempotently in the migration. Add checks for positive ranks, bounded titles and review-field consistency.
- [ ] Integration-test unique dedupe, review status, candidate deletion restrictions, archive idempotence and snapshot immutability.
- [ ] Run database unit/type tests; leave PostgreSQL tests for CI/isolated server.
- [ ] Commit `feat: add hotspot review and archive schema`.

### Task 3: Implement bounded source fetching and five fixture-backed adapters

**Files:**
- Create: `apps/worker/src/hotspots/source-fetcher.ts`
- Create: `apps/worker/src/hotspots/source-fetcher.test.ts`
- Create: `apps/worker/src/hotspots/adapters/*.ts`
- Create: `apps/worker/src/hotspots/adapters/*.test.ts`
- Create: `apps/worker/src/hotspots/fixtures/**`
- Modify: `apps/worker/package.json`

- [ ] Add an injected fetch boundary that only accepts HTTPS, exact configured hosts, `redirect: manual`, 8-second abort, 2 MiB streamed response limit, explicit User-Agent and JSON/text content types.
- [ ] Use the Hacker News Firebase API, Bilibili public popular metadata, GitHub Trending HTML, Weibo public hot-search metadata and Baidu realtime board HTML. Parse HTML with Cheerio and JSON with Zod.
- [ ] Each adapter returns at most 30 ordered candidates and throws a source-scoped parse error without logging payloads.
- [ ] Add sanitized normal, empty and changed fixtures for every source. Tests never access the network.
- [ ] Run Worker unit/type tests.
- [ ] Commit `feat: add isolated hotspot source adapters`.

### Task 4: Persist source batches and schedule collection

**Files:**
- Create: `apps/worker/src/hotspots/hotspot-repository.ts`
- Create: `apps/worker/src/hotspots/collect-hotspots.ts`
- Create: `apps/worker/src/hotspots/collect-hotspots.test.ts`
- Modify: `apps/worker/src/index.ts`
- Modify: `apps/worker/src/config/env.ts`
- Modify: `.env.example`
- Modify: `.env.test.example`

- [ ] Write orchestration tests proving one source failure does not stop others, disabled sources are skipped, concurrent source runs are locked, duplicate candidates update capture/rank without resetting review, and health counters change correctly.
- [ ] Store each successful normalized batch transactionally. Preserve `REJECTED` and `APPROVED`; new dedupe keys enter `PENDING`.
- [ ] Use a PostgreSQL advisory lock per source so Redis loss does not create concurrent batches.
- [ ] Schedule collection every 30 minutes with bounded sequential source execution for the 2 GB server; start one collection asynchronously after Worker readiness.
- [ ] Add `HOTSPOT_COLLECTION_ENABLED` so smoke environments can disable outbound requests; default production value is true and test value false.
- [ ] Run Worker unit/type/build tests.
- [ ] Commit `feat: collect hotspot candidates in worker`.

### Task 5: Add administrator review policy and repository

**Files:**
- Create: `apps/web/src/features/hotspots/server/hotspot-review-service.ts`
- Create: `apps/web/src/features/hotspots/server/hotspot-review-service.test.ts`
- Create: `apps/web/src/features/hotspots/server/hotspot-repository.ts`
- Create: `apps/web/src/features/hotspots/actions/hotspot-actions.ts`
- Create: `apps/web/src/features/hotspots/actions/hotspot-actions.test.ts`
- Create: `apps/web/test/hotspots.integration.test.ts`

- [ ] Support `PENDING -> APPROVED|REJECTED`, `APPROVED -> EXPIRED`, display-title editing and explicit public order. Reject non-ADMIN/BANNED actors and stale transitions.
- [ ] Re-read actor and candidate in the transaction, set reviewer/time/24-hour expiry and write `HOTSPOT_APPROVED`, `HOTSPOT_REJECTED`, `HOTSPOT_EXPIRED` or `HOTSPOT_REORDERED` audit rows.
- [ ] Query current public items only when source enabled, status APPROVED and expiry is in the future. Return no source health internals publicly.
- [ ] Add integration tests for audit, stale review, hidden pending/rejected/expired items and deterministic public order.
- [ ] Commit `feat: add hotspot review policy`.

### Task 6: Build admin review and current public pages

**Files:**
- Create: `apps/web/src/components/admin/hotspot-review-table.tsx`
- Create: `apps/web/src/components/hotspot/hotspot-list.tsx`
- Create: `apps/web/src/app/admin/hotspots/page.tsx`
- Modify: `apps/web/src/app/admin/layout.tsx`
- Modify: `apps/web/src/app/hotspots/page.tsx`
- Modify: `apps/web/src/app/page.tsx`
- Modify: `apps/web/src/app/globals.css`

- [ ] Build a compact server-filtered admin table for source/status with approve/reject commands, display title and public order inputs, source health and manual retry state.
- [ ] Build the actual current list as a Server Component grouped by source, with source label, rank, capture time and external link using `rel="noopener noreferrer"`.
- [ ] Replace homepage placeholder with at most five approved items or a factual empty state.
- [ ] Verify semantic tables/lists, keyboard focus, 390 px overflow and reduced-motion behavior. Run React best-practices review.
- [ ] Commit `feat: publish reviewed daily hotspots`.

### Task 7: Create idempotent Beijing-date archives

**Files:**
- Create: `apps/worker/src/hotspots/archive-hotspots.ts`
- Create: `apps/worker/src/hotspots/archive-hotspots.test.ts`
- Modify: `apps/worker/src/index.ts`
- Create: `apps/web/src/app/hotspots/archive/[date]/page.tsx`
- Modify: `apps/web/src/app/hotspots/page.tsx`
- Modify: `apps/web/src/sitemap.ts`

- [ ] Derive archive date with `Asia/Shanghai`, snapshot approved current items once, and make reruns return the existing archive without duplicate items.
- [ ] Schedule after Beijing midnight with a PostgreSQL advisory lock; a missed run catches up on Worker start.
- [ ] Validate `YYYY-MM-DD`, return 404 for missing archives and expose recent archive links on the current page.
- [ ] Test DST-independent Beijing boundaries, empty-day behavior, order preservation and immutable historical titles.
- [ ] Commit `feat: archive reviewed hotspots by Beijing date`.

### Task 8: Add remote acceptance and synchronize documentation

**Files:**
- Modify: `apps/web/tests/e2e/global-setup.ts`
- Create: `apps/web/tests/e2e/hotspots.spec.ts`
- Modify: `README.md`
- Modify: `docs/architecture.md`
- Modify: `docs/configuration.md`
- Modify: `docs/domain-model.md`
- Modify: `docs/features.md`
- Modify: `docs/hotspots.md`
- Modify: `docs/roadmap.md`
- Modify: `docs/security.md`
- Modify: `docs/testing.md`

- [ ] Seed pending/approved hotspot fixtures directly in global setup; prove pending is hidden, ADMIN approval publishes, source failure does not break Web, and archive route renders the snapshot.
- [ ] Capture 1440x900 and 390x844 current/admin pages and check horizontal overflow, focus and external-link attributes.
- [ ] Document exact source endpoints/hosts, environment flags, statuses, schedules, audit actions, failure isolation and test counts.
- [ ] Run format, lint, typecheck, all unit tests, build, diff check and secret scan locally without starting services.
- [ ] Push and require GitHub Actions `quality` and `container-smoke` success.
- [ ] Commit `docs: record daily hotspot pipeline`.

## Plan Self-Review

- Every source has an isolated adapter, bounded fetch policy and versioned fixtures.
- No adapter decides publication or writes archives; no Web route fetches a third-party source.
- Review, ordering, audit and archive facts live in PostgreSQL and are protected by server authority.
- CI and smoke can disable outbound collection while still testing fixture parsing, migrations and readiness.
- Real-source reachability remains an operational health signal and does not weaken source validation or Web readiness.
