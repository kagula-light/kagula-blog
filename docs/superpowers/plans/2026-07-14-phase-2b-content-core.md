# Phase 2B Content Core Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the administrator workflow for creating, previewing, publishing, scheduling, revising, and archiving Markdown posts with validated R2-backed media.

**Architecture:** Keep content facts and constraints in `@kagura/database`, place state transitions and input rules in focused Web feature modules, and coordinate database transactions through server-only repositories and services. Admin routes remain Server Components; only the Markdown editing surface is a Client Component. Media access is hidden behind an object-storage interface, while the Worker owns the idempotent scheduled-publication job.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 6, Drizzle ORM 0.45, PostgreSQL 17, Zod 4.4, Markdown rendering with allow-list sanitization, Cloudflare R2 through the S3-compatible SDK, Vitest 4, Playwright 1.61.

---

## Planned File Structure

~~~text
packages/database/
  src/schema.ts
  src/schema/content.ts
  src/schema.test.ts
  drizzle/0002_content_core.sql
  drizzle/meta/*
  test/content.integration.test.ts
  test/migrations.integration.test.ts
apps/web/
  package.json
  src/app/admin/layout.tsx
  src/app/admin/posts/page.tsx
  src/app/admin/posts/new/page.tsx
  src/app/admin/posts/[postId]/edit/page.tsx
  src/app/admin/posts/[postId]/preview/page.tsx
  src/app/admin/media/page.tsx
  src/components/admin/post-editor.tsx
  src/components/admin/post-list.tsx
  src/features/posts/domain/post-state.ts
  src/features/posts/domain/post-state.test.ts
  src/features/posts/actions/post-actions.ts
  src/features/posts/actions/post-action-state.ts
  src/features/posts/actions/post-actions.test.ts
  src/features/posts/server/markdown.ts
  src/features/posts/server/markdown.test.ts
  src/features/posts/server/post-repository.ts
  src/features/posts/server/post-service.ts
  src/features/posts/server/post-service.test.ts
  src/features/media/domain/image-validation.ts
  src/features/media/domain/image-validation.test.ts
  src/features/media/actions/media-actions.ts
  src/features/media/server/media-service.ts
  src/server/storage/object-storage.ts
  src/server/storage/r2-object-storage.ts
  src/server/config/env.ts
  src/server/config/env.test.ts
  test/content.integration.test.ts
  tests/e2e/content.spec.ts
apps/worker/
  src/jobs/publish-scheduled-posts.ts
  src/jobs/publish-scheduled-posts.test.ts
  src/index.ts
.env.example
.env.test.example
.github/workflows/ci.yml
infra/docker/compose.smoke.yml
docs/*
~~~

This structure keeps SQL and React out of domain rules, keeps permission checks inside every management use case, and prevents R2 SDK calls from spreading into actions or components. Post saves create immutable revisions in the same transaction. The scheduled job updates only rows that are still due and records an audit event, so retrying it is safe.

## Scope Boundaries

Included: posts, immutable revisions, categories, tags, media metadata, slug redirects, draft/publish/schedule/archive transitions, sanitized Markdown preview, administrator list/editor routes, validated image upload through an R2 boundary, scheduled publication, audit records, and focused automated tests.

Excluded: public article presentation, search/RSS/sitemap, user registration, comments, reactions, hotspot collection, final public visual design, Live2D, automatic AI summaries, production deployment credentials, and production Nginx changes.

### Task 1: Add content schema and migration

**Files:**
- Create: `packages/database/src/schema/content.ts`
- Modify: `packages/database/src/schema.ts`
- Modify: `packages/database/src/schema.test.ts`
- Create: `packages/database/drizzle/0002_content_core.sql`
- Modify: `packages/database/drizzle/meta/_journal.json`
- Create: `packages/database/drizzle/meta/0002_snapshot.json`
- Create: `packages/database/test/content.integration.test.ts`
- Modify: `packages/database/test/migrations.integration.test.ts`

- [ ] Write schema tests for enums, table names, and required columns; run them and confirm they fail because content exports are missing.
- [ ] Define `post_status` (`DRAFT`, `SCHEDULED`, `PUBLISHED`, `ARCHIVED`) and `media_asset_status` (`PENDING`, `READY`, `DELETED`).
- [ ] Define categories, tags, media assets, posts, post tags, immutable post revisions, and slug redirects with explicit indexes and foreign keys.
- [ ] Generate migration `0002_content_core.sql`; inspect generated constraints rather than hand-authoring a divergent schema.
- [ ] Add PostgreSQL integration tests for unique slugs, scheduled-time checks, media references, post-tag uniqueness, immutable revision sequencing, and migration replay.
- [ ] Run `pnpm --filter @kagura/database test`, typecheck, build, and CI-backed integration tests.
- [ ] Commit as `feat: add content database schema`.

### Task 2: Implement post domain rules

**Files:**
- Create: `apps/web/src/features/posts/domain/post-state.test.ts`
- Create: `apps/web/src/features/posts/domain/post-state.ts`

- [ ] Write failing tests for allowed state transitions and schedule validation.
- [ ] Write failing tests for slug normalization, title limits, and publication timestamps.
- [ ] Implement pure rules with discriminated results; no database, React, or current-time reads inside the module.
- [ ] Run the focused tests, Web typecheck, and lint.
- [ ] Commit as `feat: define post lifecycle rules`.

### Task 3: Render and sanitize Markdown

**Files:**
- Modify: `apps/web/package.json`
- Create: `apps/web/src/features/posts/server/markdown.test.ts`
- Create: `apps/web/src/features/posts/server/markdown.ts`
- Modify: `pnpm-lock.yaml`

- [ ] Add exact Markdown renderer and sanitizer dependency versions.
- [ ] Write failing tests for headings, code, tables, safe links, script removal, event-handler removal, unsafe protocols, and raw HTML.
- [ ] Implement server-only Markdown rendering with a narrow allow list and safe external-link attributes.
- [ ] Run focused tests, typecheck, build, and dependency lock verification.
- [ ] Commit as `feat: add safe markdown rendering`.

### Task 4: Add transactional post services

**Files:**
- Create: `apps/web/src/features/posts/server/post-repository.ts`
- Create: `apps/web/src/features/posts/server/post-service.test.ts`
- Create: `apps/web/src/features/posts/server/post-service.ts`
- Create: `apps/web/test/content.integration.test.ts`

- [ ] Write failing service tests with an in-memory repository for create draft, edit, immediate publish, schedule, archive, republish, and slug change.
- [ ] Require an ACTIVE ADMIN identity in every mutation and reject USER/BANNED identities before repository calls.
- [ ] Create a revision for every explicit save or lifecycle mutation; preserve old slugs as redirects.
- [ ] Implement the Drizzle repository so post, tags, revision, redirect, and audit log share one transaction.
- [ ] Add PostgreSQL integration tests proving rollback, immutable revision history, and public-query status filtering.
- [ ] Run unit tests, CI-backed integration tests, typecheck, and build.
- [ ] Commit as `feat: add post management services`.

### Task 5: Add the R2 media boundary

**Files:**
- Modify: `apps/web/package.json`
- Modify: `apps/web/src/server/config/env.ts`
- Modify: `apps/web/src/server/config/env.test.ts`
- Create: `apps/web/src/server/storage/object-storage.ts`
- Create: `apps/web/src/server/storage/r2-object-storage.ts`
- Create: `apps/web/src/features/media/domain/image-validation.test.ts`
- Create: `apps/web/src/features/media/domain/image-validation.ts`
- Create: `apps/web/src/features/media/server/media-service.ts`
- Create: `apps/web/src/features/media/actions/media-actions.ts`
- Modify: `.env.example`
- Modify: `.env.test.example`
- Modify: `.github/workflows/ci.yml`
- Modify: `infra/docker/compose.smoke.yml`
- Modify: `pnpm-lock.yaml`

- [ ] Add exact S3-compatible client and image-header detection dependencies.
- [ ] Write failing tests for JPEG/PNG/WebP/AVIF signatures, MIME mismatch, SVG rejection, dimension/size limits, and generated object keys.
- [ ] Define a minimal object-storage interface and R2 adapter; SDK types must not escape the adapter.
- [ ] Require ACTIVE ADMIN, insert `PENDING`, upload the validated buffer, then mark `READY`; on failure retain a diagnosable non-ready record and do not expose it publicly.
- [ ] Document and validate R2 endpoint, region, bucket, public base URL, access key, secret key, and upload limits without logging secret values.
- [ ] Run unit tests, CI object-storage integration, typecheck, build, and secret scan.
- [ ] Commit as `feat: add validated media storage`.

### Task 6: Add administrator post and media actions

**Files:**
- Create: `apps/web/src/features/posts/actions/post-action-state.ts`
- Create: `apps/web/src/features/posts/actions/post-actions.test.ts`
- Create: `apps/web/src/features/posts/actions/post-actions.ts`
- Modify: `apps/web/src/features/media/actions/media-actions.ts`

- [ ] Write failing tests for malformed forms, missing session, USER/BANNED access, stale post version, category/tag validation, and each lifecycle command.
- [ ] Parse form input with Zod, resolve current session on the server, call the service, and return field-safe error state.
- [ ] Revalidate affected admin routes; do not treat hidden buttons as authorization.
- [ ] Keep actions small and inject dependencies in tests.
- [ ] Run focused tests, lint, typecheck, and build.
- [ ] Commit as `feat: add content management actions`.

### Task 7: Build the compact admin content UI

**Files:**
- Modify: `apps/web/src/app/admin/layout.tsx`
- Create: `apps/web/src/app/admin/posts/page.tsx`
- Create: `apps/web/src/app/admin/posts/new/page.tsx`
- Create: `apps/web/src/app/admin/posts/[postId]/edit/page.tsx`
- Create: `apps/web/src/app/admin/posts/[postId]/preview/page.tsx`
- Create: `apps/web/src/app/admin/media/page.tsx`
- Create: `apps/web/src/components/admin/post-list.tsx`
- Create: `apps/web/src/components/admin/post-editor.tsx`
- Modify: `apps/web/src/app/globals.css`

- [ ] Build Server Component list/edit routes that fetch through the post query boundary.
- [ ] Build one focused Client Component for form state and debounced preview; keep all mutation authority on Server Actions.
- [ ] Use semantic form controls, status labels, visible focus, keyboard-accessible commands, stable layout, and no nested decorative cards.
- [ ] Add desktop and mobile admin navigation for overview, posts, and media.
- [ ] Run the `react:components` architectural checklist and the `react-best-practices` review across every TSX edit.
- [ ] Run component tests, lint, typecheck, and build.
- [ ] Commit as `feat: add admin content workspace`.

### Task 8: Publish due posts from the Worker

**Files:**
- Create: `apps/worker/src/jobs/publish-scheduled-posts.test.ts`
- Create: `apps/worker/src/jobs/publish-scheduled-posts.ts`
- Modify: `apps/worker/src/index.ts`

- [ ] Write failing tests for no due rows, due publication, concurrent claim behavior, retry idempotency, revision creation, and audit output.
- [ ] Claim due `SCHEDULED` rows with a transaction and row locking, verify status/time again, publish once, and create one system audit event.
- [ ] Integrate a bounded periodic schedule without delaying liveness or readiness startup.
- [ ] Run Worker tests, typecheck, build, and runtime bundle verification.
- [ ] Commit as `feat: publish scheduled posts`.

### Task 9: Add end-to-end acceptance and documentation

**Files:**
- Modify: `apps/web/tests/e2e/global-setup.ts`
- Create: `apps/web/tests/e2e/content.spec.ts`
- Modify: `infra/scripts/verify-containers.mjs`
- Modify: `README.md`
- Modify: `AGENTS.md`
- Modify: `docs/README.md`
- Modify: `docs/ai-onboarding.md`
- Modify: `docs/architecture.md`
- Modify: `docs/configuration.md`
- Modify: `docs/domain-model.md`
- Modify: `docs/features.md`
- Modify: `docs/roadmap.md`
- Modify: `docs/security.md`
- Modify: `docs/testing.md`

- [ ] Add Playwright coverage for ADMIN draft creation, safe preview, immediate publish, schedule, edit/revision, and archive; prove USER cannot invoke management mutations.
- [ ] Extend container smoke with an unauthenticated content-management redirect while keeping it independent of seeded credentials.
- [ ] Update current-state docs, configuration, domain statuses, storage boundary, tests, and remaining scope.
- [ ] Run formatting, lint, typecheck, all unit tests, CI integration tests, all builds, Playwright, container smoke, `git diff --check`, and a secret scan in CI or the isolated target server.
- [ ] Confirm the React checklist has no unresolved findings and document desktop/mobile/reduced-motion browser evidence.
- [ ] Commit as `docs: record phase 2b content core`.

## Completion Gate

Phase 2B is complete only when an ADMIN can create, preview, publish, schedule, revise, and archive a Markdown post; media upload rejects spoofed or unsafe files; USER/BANNED callers fail at the service boundary; every explicit save creates an immutable revision; the Worker publishes a due post exactly once; and the full CI gates pass. Local service startup is prohibited by the user, so PostgreSQL, R2-compatible storage, Playwright, container, and real browser evidence must come from GitHub Actions or the isolated target server and must be reported separately.
