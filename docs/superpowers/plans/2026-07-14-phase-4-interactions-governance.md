# Phase 4 Interactions and Governance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add secure username/password registration, account activity, idempotent likes/favorites, moderated comments, and administrator user/comment governance without weakening the existing session and public-content boundaries.

**Architecture:** Store interactions in PostgreSQL behind focused repositories and pure policy services. Server Actions resolve the current session and re-read user/post state before every mutation; React Client Components only submit forms and display returned state. Turnstile is an injected registration port so CI uses Cloudflare test credentials while production uses configured credentials.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 6, Drizzle ORM, PostgreSQL 17, Redis 7.4, Argon2id, Cloudflare Turnstile, Zod, Vitest, Playwright.

---

## Planned File Structure

~~~text
packages/database/
  src/schema/interactions.ts
  drizzle/0003_interactions.sql
  test/interactions.integration.test.ts
apps/web/
  src/app/register/page.tsx
  src/app/account/page.tsx
  src/app/admin/comments/page.tsx
  src/app/admin/users/page.tsx
  src/components/auth/register-form.tsx
  src/components/article/post-actions.tsx
  src/components/article/comment-form.tsx
  src/components/article/comment-list.tsx
  src/components/admin/comment-queue.tsx
  src/components/admin/user-list.tsx
  src/features/registration/server/registration-service.ts
  src/features/registration/actions/register-action.ts
  src/features/reactions/server/reaction-service.ts
  src/features/reactions/actions/reaction-actions.ts
  src/features/comments/server/comment-service.ts
  src/features/comments/actions/comment-actions.ts
  src/features/users/server/user-governance-service.ts
  src/features/users/actions/user-actions.ts
  test/interactions.integration.test.ts
  tests/e2e/interactions.spec.ts
docs/
  domain-model.md
  features.md
  security.md
  testing.md
~~~

`packages/database` remains the only schema source. Services accept injected repositories, clock, limiter, and Turnstile ports. Actions are the only browser mutation boundary. Public components receive stable view models and never import database tables.

### Task 1: Add interaction and moderation schema

**Files:**
- Create: `packages/database/src/schema/interactions.ts`
- Modify: `packages/database/src/schema.ts`
- Create: `packages/database/drizzle/0003_interactions.sql`
- Modify: `packages/database/drizzle/meta/_journal.json`
- Test: `packages/database/src/schema.test.ts`
- Test: `packages/database/test/interactions.integration.test.ts`

- [ ] Write failing schema tests for `comments`, `postLikes`, `favorites`, and `commentStatus`.
- [ ] Verify the tests fail because the exports do not exist:

~~~bash
pnpm --filter @kagura/database test
~~~

- [ ] Define exact tables:

~~~ts
export const commentStatus = pgEnum("comment_status", [
  "PENDING",
  "APPROVED",
  "REJECTED",
  "DELETED",
]);

export const comments = pgTable("comments", {
  id: uuid("id").defaultRandom().primaryKey(),
  postId: uuid("post_id").notNull().references(() => posts.id, { onDelete: "cascade" }),
  authorUserId: uuid("author_user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  body: text("body").notNull(),
  status: commentStatus("status").default("PENDING").notNull(),
  moderatedByUserId: uuid("moderated_by_user_id").references(() => users.id, { onDelete: "set null" }),
  moderatedAt: timestamp("moderated_at", { withTimezone: true, mode: "date" }),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
  deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "date" }),
});
~~~

`post_likes` and `favorites` each use `(post_id, user_id)` as the primary key and store `created_at`. Add `(post_id, status, created_at)` and `(author_user_id, created_at)` comment indexes plus body length check `1..2000`.

- [ ] Generate and inspect migration `0003_interactions`; add integration cases for unique likes/favorites, comment status constraints, cascades, and moderator `SET NULL`.
- [ ] Run unit/type/build locally and integration only in CI/server.
- [ ] Commit: `feat: add interaction and moderation schema`.

### Task 2: Implement registration policy and Turnstile boundary

**Files:**
- Create: `apps/web/src/features/registration/server/registration-service.test.ts`
- Create: `apps/web/src/features/registration/server/registration-service.ts`
- Create: `apps/web/src/server/security/turnstile.ts`
- Modify: `apps/web/src/server/config/env.ts`
- Modify: `.env.example`
- Modify: `.env.test.example`

- [ ] Write failing tests covering invalid username, weak password, duplicate normalized username, failed Turnstile, rate limit, successful USER creation, Argon2id hashing, and session issuance.
- [ ] Use this result contract:

~~~ts
export type RegistrationResult =
  | { readonly status: "SUCCESS"; readonly token: string; readonly expiresAt: Date }
  | { readonly status: "USERNAME_TAKEN" }
  | { readonly status: "CHALLENGE_FAILED" }
  | { readonly status: "RATE_LIMITED"; readonly retryAfterSeconds: number };
~~~

- [ ] Implement `registerUser` with injected `verifyChallenge`, `consumeRegistrationBudget`, `hashPassword`, `issueToken`, and transactional `createUserCredentialSession`; normalize through `@kagura/auth/username` and never persist email requirements.
- [ ] Add `TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY` to Web env validation. `verifyTurnstile` posts form data to Cloudflare with a 5-second abort timeout and returns only a boolean; logs must not include token or client address.
- [ ] Run focused unit tests and typecheck.
- [ ] Commit: `feat: add secure user registration service`.

### Task 3: Add registration and account pages

**Files:**
- Create: `apps/web/src/features/registration/actions/register-action.test.ts`
- Create: `apps/web/src/features/registration/actions/register-action.ts`
- Create: `apps/web/src/components/auth/register-form.tsx`
- Create: `apps/web/src/app/register/page.tsx`
- Create: `apps/web/src/app/account/page.tsx`
- Modify: `apps/web/src/components/site/site-header.tsx`
- Modify: `apps/web/src/app/globals.css`

- [ ] Write action validation tests for username/display name/password/confirmation/challenge token and same-origin redirect behavior.
- [ ] Implement a Server Action that rate-limits by hashed client address, sets the existing secure session cookie on success, and returns uniform safe errors.
- [ ] Implement `RegisterForm` as one focused Client Component using `useActionState`; include semantic autocomplete attributes, password confirmation, challenge container, stable pending state, field-linked errors, and login link.
- [ ] Implement Server Component pages. `/register` redirects authenticated users to `/account`; `/account` requires a valid session and lists current display name, role, status, favorites, and submitted comments without exposing credential/session internals.
- [ ] Verify keyboard flow, 360px layout, reduced motion, no client fetch-in-effect, then run React best-practices review.
- [ ] Commit: `feat: add registration and account surfaces`.

### Task 4: Implement idempotent likes and favorites

**Files:**
- Create: `apps/web/src/features/reactions/server/reaction-service.test.ts`
- Create: `apps/web/src/features/reactions/server/reaction-service.ts`
- Create: `apps/web/src/features/reactions/server/reaction-repository.ts`
- Create: `apps/web/src/features/reactions/actions/reaction-actions.ts`
- Create: `apps/web/src/components/article/post-actions.tsx`
- Modify: `apps/web/src/components/article/article-layout.tsx`

- [ ] Write failing tests for unauthenticated, ACTIVE, MUTED, BANNED, unpublished post, duplicate toggle, and concurrent unique-conflict behavior.
- [ ] Implement explicit toggle commands:

~~~ts
export type ReactionCommand = "LIKE" | "UNLIKE" | "FAVORITE" | "UNFAVORITE";
export type ReactionResult =
  | { readonly status: "SUCCESS"; readonly active: boolean; readonly count: number }
  | { readonly status: "UNAUTHENTICATED" | "FORBIDDEN" | "POST_NOT_FOUND" };
~~~

- [ ] Re-read session user status and public post status in the transaction. Use `ON CONFLICT DO NOTHING` for add and conditional delete for remove so retries are idempotent.
- [ ] Render two semantic toggle buttons with pressed state and stable count width. Do not use optimistic client state until the server result returns.
- [ ] Add PostgreSQL integration tests for repeated and concurrent mutations.
- [ ] Commit: `feat: add likes and favorites`.

### Task 5: Implement pending comments and public approved queries

**Files:**
- Create: `apps/web/src/features/comments/server/comment-service.test.ts`
- Create: `apps/web/src/features/comments/server/comment-service.ts`
- Create: `apps/web/src/features/comments/server/comment-repository.ts`
- Create: `apps/web/src/features/comments/actions/comment-actions.ts`
- Create: `apps/web/src/components/article/comment-form.tsx`
- Create: `apps/web/src/components/article/comment-list.tsx`
- Modify: `apps/web/src/components/article/article-layout.tsx`

- [ ] Write failing tests for ACTIVE submit, MUTED/BANNED/anonymous rejection, unpublished post rejection, body normalization, 1/2000 boundaries, and `PENDING` creation.
- [ ] Keep comment body plain text. Normalize NFKC and line endings, trim outer whitespace, reject control characters, and never render with `dangerouslySetInnerHTML`.
- [ ] Implement repository public query with `status = APPROVED` and `deleted_at IS NULL`; return author display name and timestamps only.
- [ ] Add a focused Client form with explicit “提交后等待审核” result and a Server Component approved list.
- [ ] Add integration tests proving pending/rejected/deleted comments never appear publicly.
- [ ] Commit: `feat: add moderated article comments`.

### Task 6: Add administrator comment and user governance

**Files:**
- Create: `apps/web/src/features/users/server/user-governance-service.test.ts`
- Create: `apps/web/src/features/users/server/user-governance-service.ts`
- Create: `apps/web/src/features/users/server/user-repository.ts`
- Create: `apps/web/src/features/users/actions/user-actions.ts`
- Create: `apps/web/src/components/admin/user-list.tsx`
- Create: `apps/web/src/components/admin/comment-queue.tsx`
- Create: `apps/web/src/app/admin/users/page.tsx`
- Create: `apps/web/src/app/admin/comments/page.tsx`
- Modify: `apps/web/src/app/admin/layout.tsx`

- [ ] Write policy tests for `ACTIVE -> MUTED/BANNED`, `MUTED -> ACTIVE/BANNED`, `BANNED -> ACTIVE`, self-ban refusal, and ADMIN-only moderation.
- [ ] Implement comment transitions `PENDING -> APPROVED|REJECTED` and `APPROVED|REJECTED -> DELETED`; write moderator/time and append audit rows in one transaction.
- [ ] Implement user status changes and revoke all active sessions when setting `BANNED`; write audit actions `USER_MUTED`, `USER_BANNED`, `USER_REACTIVATED`, `COMMENT_APPROVED`, `COMMENT_REJECTED`, and `COMMENT_DELETED`.
- [ ] Build compact filterable server-rendered tables with semantic forms and confirmation text for destructive actions. Do not add role promotion.
- [ ] Add integration tests for audit, session revocation, public comment visibility, and self-governance refusal.
- [ ] Commit: `feat: add comment and user governance`.

### Task 7: Add end-to-end interaction acceptance

**Files:**
- Modify: `apps/web/tests/e2e/global-setup.ts`
- Create: `apps/web/tests/e2e/interactions.spec.ts`
- Modify: `.github/workflows/ci.yml`

- [ ] Seed one ACTIVE, one MUTED, and one BANNED disposable USER plus one published post; revoke old sessions before the run.
- [ ] Cover registration/login/logout, like/favorite persistence, comment pending invisibility, ADMIN approval then public visibility, MUTED comment refusal, BANNED session invalidation, and account favorites/comments.
- [ ] Capture 1440x900 and 390x844 article/account/admin screenshots. Check console errors, horizontal overflow, focus order, and fixed-control overlap.
- [ ] Run only in GitHub Actions or the target server isolation; do not start local services.
- [ ] Commit: `test: cover reader interaction lifecycle`.

### Task 8: Synchronize documentation and pass remote gates

**Files:**
- Modify: `README.md`
- Modify: `docs/architecture.md`
- Modify: `docs/configuration.md`
- Modify: `docs/domain-model.md`
- Modify: `docs/features.md`
- Modify: `docs/roadmap.md`
- Modify: `docs/security.md`
- Modify: `docs/testing.md`

- [ ] Record implemented schema, state transitions, Turnstile configuration, user-visible behavior, audit actions, exact test counts, and remaining scope.
- [ ] Run non-service local gates: format, lint, typecheck, unit tests, build, diff check, and secret scan.
- [ ] Push the branch and require `quality` plus `container-smoke` success. Treat CI screenshots and PostgreSQL tests separately from production evidence.
- [ ] Commit: `docs: record phase 4 interaction governance`.

## Plan Self-Review

- Spec coverage: registration, account view, likes, favorites, pending comments, public approved-only queries, moderation, mute/ban/reactivate, immediate BANNED session invalidation, audit and browser acceptance all map to tasks.
- Scope: email verification, password recovery, nested replies, notifications, role promotion, points and social login remain excluded.
- Type consistency: status/command unions and table names are defined once and reused by later tasks.
- Security: every mutation resolves a current session, checks current user/post state, validates input, and persists audit in the same transaction where required.
- Placeholder scan: no task relies on unspecified entities, URLs, fields, or commands.
