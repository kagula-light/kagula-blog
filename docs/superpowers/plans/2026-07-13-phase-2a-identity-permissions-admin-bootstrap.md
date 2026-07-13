# Phase 2A Identity, Permissions, and Admin Bootstrap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a secure username/password administrator login, database-backed sessions, server-side ADMIN authorization, and an idempotent administrator bootstrap command.

**Architecture:** Introduce a small `@kagura/auth` package for password and token primitives, keep identity tables and migrations in `@kagura/database`, and keep request/session/permission orchestration inside the Web server boundary. The Worker gains only a one-shot admin seed entrypoint; it does not own authentication policy. Pages remain Server Components except the focused login form.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 6, Drizzle ORM 0.45, PostgreSQL 17, Redis 7.4, Zod 4.4.3, `@node-rs/argon2` 2.0.2, Vitest 4, Playwright 1.61.

---

## Planned File Structure

~~~text
packages/
  auth/
    package.json
    tsconfig.json
    vitest.config.ts
    src/password.ts
    src/password.test.ts
    src/session-token.ts
    src/session-token.test.ts
    src/username.ts
    src/username.test.ts
  database/
    src/schema.ts
    src/schema/identity.ts
    src/schema/audit.ts
    drizzle/0001_identity_core.sql
    test/identity.integration.test.ts
apps/
  web/
    vitest.integration.config.ts
    src/app/(auth)/login/page.tsx
    src/app/admin/layout.tsx
    src/app/admin/page.tsx
    src/components/auth/login-form.tsx
    src/features/auth/actions/login-action.ts
    src/features/auth/actions/logout-action.ts
    src/features/auth/server/auth-service.ts
    src/features/auth/server/auth-service.test.ts
    src/server/auth/auth-repository.ts
    src/server/auth/get-current-session.ts
    src/server/auth/login-rate-limiter.ts
    src/server/auth/session-cookie.ts
    src/server/config/env.test.ts
    src/server/config/env.ts
    src/server/database/get-database.ts
    src/server/permissions/policy.ts
    src/server/permissions/policy.test.ts
    test/auth.integration.test.ts
    tests/e2e/auth.spec.ts
    tests/e2e/global-setup.ts
  worker/
    src/seed-admin.ts
    src/seed-admin.test.ts
~~~

The structure keeps cryptography independent from React, makes database migrations the only schema source, centralizes final authorization in server modules, and prevents pages from constructing SQL or interpreting session cookies.

## Scope Boundaries

Included: first-admin bootstrap, login, logout, session expiry/revocation, ACTIVE/MUTED/BANNED identity states, ADMIN/USER authorization, login rate limiting, audit records for bootstrap and credential rotation, and the minimal admin shell.

Excluded from 2A: public registration, password recovery, email verification, user management screens, article tables, Markdown rendering, R2 media, comments, reactions, hotspots, final public visual design, and production deployment permissions. These remain in the approved later phases.

### Task 1: Add the shared authentication primitives package

**Files:**
- Create: `packages/auth/package.json`
- Create: `packages/auth/tsconfig.json`
- Create: `packages/auth/vitest.config.ts`
- Create: `packages/auth/src/password.test.ts`
- Create: `packages/auth/src/password.ts`
- Create: `packages/auth/src/session-token.test.ts`
- Create: `packages/auth/src/session-token.ts`
- Create: `packages/auth/src/username.test.ts`
- Create: `packages/auth/src/username.ts`
- Modify: `pnpm-lock.yaml`

- [ ] **Step 1: Create the package manifest and test configuration**

Use exact dependency `@node-rs/argon2@2.0.2`. Export `./password`, `./session-token`, and `./username`; each export points its `types` and `default` fields at the corresponding `src/*.ts` file. Add `test`, `typecheck`, and `build` scripts matching the other shared packages.

- [ ] **Step 2: Write failing username normalization tests**

~~~ts
import { describe, expect, it } from "vitest";

import { normalizeUsername } from "./username";

describe("normalizeUsername", () => {
  it("normalizes width, surrounding space, and ASCII case", () => {
    expect(normalizeUsername("  Ｋａｇｕｒａ_01  ")).toBe("kagura_01");
  });

  it.each(["ab", "contains space", "name!", "a".repeat(33)])(
    "rejects unsupported username %s",
    (username) => expect(() => normalizeUsername(username)).toThrow(/username/i),
  );
});
~~~

- [ ] **Step 3: Verify username tests fail for the missing module**

Run: `pnpm --filter @kagura/auth test -- src/username.test.ts`

Expected: FAIL because `src/username.ts` does not exist.

- [ ] **Step 4: Implement username normalization**

~~~ts
const usernamePattern = /^[a-z0-9_]{3,32}$/;

export function normalizeUsername(value: string): string {
  const normalized = value.normalize("NFKC").trim().toLowerCase();
  if (!usernamePattern.test(normalized)) {
    throw new Error("Username must contain 3-32 lowercase letters, numbers, or underscores");
  }
  return normalized;
}
~~~

- [ ] **Step 5: Write failing Argon2id tests**

Test that `hashPassword("correct horse battery staple")` produces an `$argon2id$` encoded value, verifies the correct password, rejects the wrong password, and returns `false` instead of throwing for a malformed stored hash. Assert the encoded hash does not contain the plaintext.

- [ ] **Step 6: Implement password hashing with fixed reviewed parameters**

~~~ts
import { Algorithm, hash, verify } from "@node-rs/argon2";

const passwordOptions = {
  algorithm: Algorithm.Argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
  outputLen: 32,
} as const;

export async function hashPassword(password: string): Promise<string> {
  if (password.length < 12 || password.length > 256) {
    throw new Error("Password must contain 12-256 characters");
  }
  return hash(password, passwordOptions);
}

export async function verifyPassword(encodedHash: string, password: string): Promise<boolean> {
  try {
    return await verify(encodedHash, password);
  } catch {
    return false;
  }
}
~~~

- [ ] **Step 7: Write failing session-token tests**

Test that `issueSessionToken(secret)` returns a 43-character base64url token and a 64-character lowercase hexadecimal digest, that `digestSessionToken(token, secret)` reproduces the digest, and that changing the secret changes the digest. Reject secrets shorter than 32 characters without including the secret in the error.

- [ ] **Step 8: Implement opaque session tokens and HMAC digests**

~~~ts
import { createHmac, randomBytes } from "node:crypto";

export interface IssuedSessionToken {
  readonly token: string;
  readonly digest: string;
}

function assertSessionSecret(secret: string): void {
  if (secret.length < 32) throw new Error("Session secret must contain at least 32 characters");
}

export function digestSessionToken(token: string, secret: string): string {
  assertSessionSecret(secret);
  return createHmac("sha256", secret).update(token, "utf8").digest("hex");
}

export function issueSessionToken(secret: string): IssuedSessionToken {
  const token = randomBytes(32).toString("base64url");
  return { token, digest: digestSessionToken(token, secret) };
}
~~~

- [ ] **Step 9: Verify package quality and commit**

Run:

~~~bash
pnpm install
pnpm --filter @kagura/auth test
pnpm --filter @kagura/auth typecheck
pnpm --filter @kagura/auth build
~~~

Expected: 0 failures and no plaintext secrets in output.

Commit: `feat: add authentication primitives`

### Task 2: Add Web-only authentication environment validation

**Files:**
- Modify: `apps/web/package.json`
- Create: `apps/web/src/server/config/env.test.ts`
- Modify: `apps/web/src/server/config/env.ts`
- Modify: `.env.example`
- Modify: `.env.test.example`
- Modify: `.github/workflows/ci.yml`
- Modify: `infra/docker/compose.smoke.yml`
- Modify: `pnpm-lock.yaml`

- [ ] **Step 1: Write failing Web environment tests**

Define a complete test input using the existing runtime fields plus:

~~~ts
SESSION_SECRET: "test_session_secret_that_is_at_least_32_chars",
SESSION_COOKIE_NAME: "kagura_session",
SESSION_TTL_HOURS: "168",
~~~

Assert coercion of `SESSION_TTL_HOURS` to `168`, rejection of a short secret, rejection of cookie names containing whitespace or semicolons, and an error message that lists only invalid field names.

- [ ] **Step 2: Verify the tests fail**

Run: `pnpm --filter @kagura/web test -- src/server/config/env.test.ts`

Expected: FAIL because `getServerEnv` returns only `RuntimeEnv`.

- [ ] **Step 3: Implement a Web-specific auth schema without affecting Worker env**

Add direct dependency `zod@4.4.3` to `@kagura/web`. Keep `parseRuntimeEnv` unchanged so Worker and migration commands do not require browser session secrets. In `apps/web/src/server/config/env.ts`, parse this schema separately and merge it with the base runtime result:

~~~ts
const authEnvSchema = z.object({
  SESSION_SECRET: z.string().min(32),
  SESSION_COOKIE_NAME: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/),
  SESSION_TTL_HOURS: z.coerce.number().int().min(1).max(24 * 30),
});

export type WebEnv = RuntimeEnv & z.infer<typeof authEnvSchema>;
~~~

Use the existing invalid-path-only error convention. Do not log input values.

- [ ] **Step 4: Supply non-production test values**

Add ignored-example values to `.env.example` and `.env.test.example`. Add CI-only values to the `quality` job and `compose.smoke.yml`; use distinct strings that contain `ci_only` or `smoke_only` and are at least 32 characters. Do not add production secrets or GitHub Environment access.

- [ ] **Step 5: Verify and commit**

Run:

~~~bash
pnpm --filter @kagura/web test -- src/server/config/env.test.ts
pnpm --filter @kagura/web typecheck
docker compose -p kagura-blog-smoke -f infra/docker/compose.smoke.yml config --quiet
~~~

The Compose command is static validation only; do not run `up` locally.

Commit: `feat: validate web session configuration`

### Task 3: Add identity, session, and audit database schema

**Files:**
- Create: `packages/database/src/schema/identity.ts`
- Create: `packages/database/src/schema/audit.ts`
- Modify: `packages/database/src/schema.ts`
- Modify: `packages/database/package.json`
- Create: `packages/database/drizzle/0001_identity_core.sql`
- Modify: `packages/database/drizzle/meta/_journal.json`
- Create: `packages/database/drizzle/meta/0001_snapshot.json`
- Modify: `packages/database/test/migrations.integration.test.ts`
- Create: `packages/database/test/identity.integration.test.ts`

- [ ] **Step 1: Write failing schema contract tests**

Import `users`, `credentials`, `sessions`, and `auditLogs` from `../src/schema`. Assert table names, enum values, and required column presence. The test must fail before the schema files exist and must not connect to PostgreSQL.

- [ ] **Step 2: Define identity tables**

Use PostgreSQL UUID primary keys with `defaultRandom()`, timezone-aware timestamps, and these exact enums:

~~~ts
export const userRole = pgEnum("user_role", ["ADMIN", "USER"]);
export const userStatus = pgEnum("user_status", ["ACTIVE", "MUTED", "BANNED"]);
~~~

`users` contains `id`, `username`, unique `normalizedUsername`, `displayName`, nullable `email`, nullable `emailVerifiedAt`, `role`, `status`, nullable `biography`, `createdAt`, `updatedAt`, and nullable `lastLoginAt`.

`credentials` uses `userId` as both primary key and cascading foreign key, plus `passwordHash` and `passwordUpdatedAt`.

`sessions` contains `id`, cascading `userId`, unique `tokenDigest` as `char(64)`, `expiresAt`, `lastActivityAt`, nullable `revokedAt`, and `createdAt`. Add indexes on `(userId, revokedAt)` and `expiresAt`.

- [ ] **Step 3: Define append-only audit storage**

`auditLogs` contains UUID `id`, nullable actor foreign key with `ON DELETE SET NULL`, `action` varchar(80), `resourceType` varchar(80), nullable `resourceId` varchar(128), nullable `requestId` varchar(128), JSONB `summary` defaulting to `{}`, and `createdAt`. Add indexes on `createdAt` and `(resourceType, resourceId)`.

- [ ] **Step 4: Export schema explicitly**

`packages/database/src/schema.ts` exports named tables and enums from the two focused schema files. Add a `./schema` package export. This file is the required Drizzle schema entry, not a general application barrel.

- [ ] **Step 5: Generate the migration without connecting to a database**

Set a disposable syntactically valid `DATABASE_URL` only for the command process and run:

~~~bash
pnpm --filter @kagura/database db:generate -- --name=identity_core
~~~

Inspect the generated SQL for enums, unique constraints, foreign keys, and indexes. Do not hand-edit generated snapshots.

- [ ] **Step 6: Extend migration integration coverage**

Update the migration test to expect two recorded migration hashes. Add integration cases that insert an ADMIN with a credential, reject a duplicate normalized username, reject duplicate session digests, cascade credentials/sessions when a disposable user is deleted, and preserve an audit row with a null actor after actor deletion.

- [ ] **Step 7: Verify locally and in CI, then commit**

Run locally without services:

~~~bash
pnpm --filter @kagura/database test
pnpm --filter @kagura/database typecheck
pnpm --filter @kagura/database build
~~~

Run `pnpm test:integration` only in GitHub Actions or the target server's isolated blog PostgreSQL. Expected: migrations are idempotent and all identity constraints pass.

Commit: `feat: add identity and audit schema`

### Task 4: Implement pure login and permission policy

**Files:**
- Create: `apps/web/src/features/auth/server/auth-service.test.ts`
- Create: `apps/web/src/features/auth/server/auth-service.ts`
- Create: `apps/web/src/server/permissions/policy.test.ts`
- Create: `apps/web/src/server/permissions/policy.ts`

- [ ] **Step 1: Write permission matrix tests**

Test `canAccessAdmin` for no user, USER, ADMIN, MUTED ADMIN, and BANNED ADMIN. Only ACTIVE or MUTED ADMIN identities may access admin content; BANNED always fails. Test `canCreateComment` separately so ACTIVE USER/ADMIN pass and MUTED/BANNED fail.

- [ ] **Step 2: Implement explicit permission policies**

~~~ts
export type UserRole = "ADMIN" | "USER";
export type UserStatus = "ACTIVE" | "MUTED" | "BANNED";

export interface PermissionIdentity {
  readonly id: string;
  readonly role: UserRole;
  readonly status: UserStatus;
}

export function canAccessAdmin(identity: PermissionIdentity | null): boolean {
  return identity?.role === "ADMIN" && identity.status !== "BANNED";
}

export function canCreateComment(identity: PermissionIdentity | null): boolean {
  return identity !== null && identity.status === "ACTIVE";
}
~~~

- [ ] **Step 3: Write login service tests with injected ports**

Cover unknown username, wrong password, BANNED account, rate-limited attempt, successful ADMIN login, and successful USER login. Assert all credential failures return the same `INVALID_CREDENTIALS` result, no session is created for failures, a success creates exactly one digest-backed session, and the rate-limit key never contains the raw username or IP.

- [ ] **Step 4: Implement the login use case**

Define focused ports for `findLoginIdentity`, `verifyPassword`, `issueToken`, `createSession`, `consumeFailureBudget`, `recordFailure`, `clearFailures`, and `clock`. Normalize the username before lookup. Verify a module-cached dummy Argon2id hash when the user is missing so the service does not skip password work. Re-read status from the returned identity and reject BANNED users. Calculate `expiresAt` from `SESSION_TTL_HOURS` and return the raw token only to the action layer.

Use this result union:

~~~ts
export type LoginResult =
  | { readonly status: "SUCCESS"; readonly token: string; readonly expiresAt: Date; readonly role: UserRole }
  | { readonly status: "INVALID_CREDENTIALS" }
  | { readonly status: "RATE_LIMITED"; readonly retryAfterSeconds: number };
~~~

- [ ] **Step 5: Verify and commit**

Run: `pnpm --filter @kagura/web test -- src/features/auth/server src/server/permissions`

Expected: all policy and use-case branches pass without PostgreSQL or Redis.

Commit: `feat: add login and permission policies`

### Task 5: Implement Drizzle auth repository, Redis limiter, and session resolution

**Files:**
- Create: `apps/web/src/server/database/get-database.ts`
- Create: `apps/web/src/server/auth/auth-repository.ts`
- Create: `apps/web/src/server/auth/login-rate-limiter.ts`
- Create: `apps/web/src/server/auth/session-cookie.ts`
- Create: `apps/web/src/server/auth/get-current-session.ts`
- Create: `apps/web/vitest.integration.config.ts`
- Create: `apps/web/test/auth.integration.test.ts`
- Modify: `apps/web/package.json`

- [ ] **Step 1: Add an integration test command**

Create a Node-environment Vitest config including only `test/**/*.integration.test.ts`, with 15-second test and hook timeouts. Add `test:integration` to `@kagura/web`; the root recursive command will discover it automatically.

- [ ] **Step 2: Write failing session integration tests**

Against `TEST_DATABASE_URL`, migrate first, create isolated users with unique UUID-derived names, and verify:

- an ACTIVE ADMIN credential can create and resolve a session;
- a USER session resolves but fails `canAccessAdmin`;
- an expired or revoked session does not resolve;
- changing the user to BANNED invalidates an existing unrevoked session immediately;
- logout revokes only the presented session digest.

Never print URLs, raw tokens, password hashes, or cookies.

- [ ] **Step 3: Add the server database singleton**

Cache `DatabaseClient` on `globalThis` for the Node.js Web process and construct it from `getServerEnv().DATABASE_URL`. Export only `getDatabase()`. Tests inject or create their own clients and do not mutate the global singleton.

- [ ] **Step 4: Implement the Drizzle repository**

`findLoginIdentity(normalizedUsername)` joins users and credentials and returns only ID, role, status, and password hash. `createSession` inserts the digest and updates `lastLoginAt` in one transaction. `findSessionIdentity` joins sessions/users and filters digest, `revokedAt IS NULL`, and `expiresAt > now`; it still returns current user status for BANNED rejection. `revokeSession` sets `revokedAt` only where currently null.

- [ ] **Step 5: Implement Redis failure limiting**

Derive a Redis key from SHA-256 of `clientAddress + "\0" + normalizedUsername`; never store either raw value in the key. Use one atomic Lua script to increment with a 600-second TTL. Permit at most five failures per window and return the remaining TTL when blocked. Each operation uses a short-lived Redis client with error listener and guaranteed quit/destroy cleanup.

- [ ] **Step 6: Implement the cookie boundary**

Export `setSessionCookie`, `clearSessionCookie`, and `readSessionCookie`. Always set `httpOnly: true`, `sameSite: "lax"`, `path: "/"`, explicit expiry, and `secure` when `APP_URL` is HTTPS. Cookie code receives Next's cookie store as an injected narrow interface for unit tests.

- [ ] **Step 7: Implement current-session resolution**

Read the configured cookie, HMAC it with `SESSION_SECRET`, query the repository, and return `null` for missing, expired, revoked, or BANNED sessions. Return only `{ id, username, displayName, role, status, sessionId }`; never expose the digest or credential.

- [ ] **Step 8: Verify and commit**

Local non-service checks:

~~~bash
pnpm --filter @kagura/web test
pnpm --filter @kagura/web typecheck
~~~

CI/server isolated check: `pnpm --filter @kagura/web test:integration`.

Commit: `feat: add database backed sessions`

### Task 6: Add the idempotent administrator seed command

**Files:**
- Modify: `apps/worker/package.json`
- Modify: `apps/worker/tsup.config.ts`
- Create: `apps/worker/src/seed-admin.test.ts`
- Create: `apps/worker/src/seed-admin.ts`
- Modify: `apps/worker/scripts/verify-runtime-bundle.mjs`

- [ ] **Step 1: Write failing seed decision tests**

Extract and test a `decideAdminSeed` function. No existing ADMIN means `CREATE`; the same normalized ADMIN means `ROTATE_CREDENTIAL`; a different existing ADMIN means `REFUSE`; and a same-name USER means `REFUSE`. Refusal messages name the conflicting field but contain no password or hash.

- [ ] **Step 2: Implement seed input validation**

Read only `DATABASE_URL`, `ADMIN_USERNAME`, `ADMIN_DISPLAY_NAME`, and `ADMIN_PASSWORD`. Normalize username through `@kagura/auth/username`; require display name 1-80 characters and password 12-256 characters. Do not add these one-shot secrets to the long-lived Worker runtime schema.

- [ ] **Step 3: Implement transactional bootstrap**

Hash before opening the transaction. Lock existing ADMIN and same-name user rows. Create the first ACTIVE ADMIN plus credential and `ADMIN_BOOTSTRAPPED` audit row, or rotate the matching ADMIN credential and write `ADMIN_CREDENTIAL_ROTATED`. Refuse all ambiguous cases. The command logs only action, user ID, and release; it never logs username, password, hash, or database URL.

- [ ] **Step 4: Bundle and verify the CLI**

Add `src/seed-admin.ts` as a tsup entry. Add development script `seed:admin` using `node --import tsx`, and runtime script `seed:admin:runtime` using `node dist/seed-admin.js`. Extend runtime-bundle verification to import the seed bundle with intentionally missing env and assert it reaches the controlled error path rather than a dynamic-require failure.

- [ ] **Step 5: Verify and commit**

Run:

~~~bash
pnpm --filter @kagura/worker test
pnpm --filter @kagura/worker typecheck
pnpm --filter @kagura/worker build
~~~

Execute the real seed only in CI or the target server isolated blog database using environment injection that does not echo the password.

Commit: `feat: add administrator bootstrap command`

### Task 7: Add login, logout, and the protected admin shell

**Files:**
- Create: `apps/web/src/features/auth/actions/login-action.ts`
- Create: `apps/web/src/features/auth/actions/logout-action.ts`
- Create: `apps/web/src/components/auth/login-form.tsx`
- Create: `apps/web/src/app/(auth)/login/page.tsx`
- Create: `apps/web/src/app/admin/layout.tsx`
- Create: `apps/web/src/app/admin/page.tsx`
- Modify: `apps/web/src/app/globals.css`

- [ ] **Step 1: Define and test action-state validation**

Use Zod to accept `username`, `password`, and optional `next`. Return field errors for malformed input, the same page-level `用户名或密码错误` for unknown user/wrong password/BANNED user, and a retry message for rate limiting. Accept `next` only when it starts with one `/`, does not start with `//`, and resolves within `APP_URL`.

- [ ] **Step 2: Implement the login Server Action**

Mark the module `"use server"`. Read headers for the Nginx-provided client address, call the login service, set the opaque session cookie on success, and redirect ADMIN to the validated `next` path or `/admin`. Redirect non-admin authenticated users to `/`. Never return the raw token in action state.

- [ ] **Step 3: Implement logout**

Resolve the presented digest, revoke that session, clear the cookie even when no database row exists, and redirect to `/login`. The logout action is safe to call repeatedly.

- [ ] **Step 4: Implement one focused Client Component**

`LoginForm` is the only new Client Component. It uses `useActionState(loginAction, initialState)`, semantic labels, `autocomplete="username"` and `autocomplete="current-password"`, disabled pending state, `aria-describedby` for errors, and a stable submit button. Do not fetch in `useEffect`, duplicate server state, or use `useMemo`/`useCallback`.

- [ ] **Step 5: Implement Server Component pages**

The login page redirects an already authenticated ADMIN to `/admin`. The admin layout calls `getCurrentSession()` and redirects unauthenticated visitors to `/login?next=/admin`; authenticated USER identities redirect to `/`. The layout renders a compact header, navigation landmark, current display name, and logout form. The dashboard states only that identity and permission foundation is active; it must not pretend article management is implemented.

- [ ] **Step 6: Apply restrained admin styling**

Use Tailwind utilities and the existing CSS tokens. The login form may be one framed tool; the admin page uses a full-width header and unframed content, with no nested cards, oversized hero, gradients, decorative blobs, or animation. Ensure focus visibility, 360px width support, and `prefers-reduced-motion` compatibility.

- [ ] **Step 7: Run React quality review and commit**

Review every new TSX file against `react:components` and `react-best-practices`: Server Components by default, one public component per file, named reusable export, readonly colocated props, semantic HTML, keyboard access, and no client data fetch.

Run:

~~~bash
pnpm --filter @kagura/web test
pnpm --filter @kagura/web typecheck
pnpm --filter @kagura/web build
~~~

Commit: `feat: add protected administrator entry`

### Task 8: Add browser and server-isolated authentication acceptance

**Files:**
- Create: `apps/web/tests/e2e/global-setup.ts`
- Create: `apps/web/tests/e2e/auth.spec.ts`
- Modify: `apps/web/playwright.config.ts`
- Modify: `.github/workflows/ci.yml`
- Modify: `infra/docker/compose.smoke.yml`
- Modify: `infra/scripts/verify-containers.mjs`

- [ ] **Step 1: Seed isolated E2E identities in global setup**

Use `TEST_DATABASE_URL`, run migrations, and upsert deterministic `e2e_admin` and `e2e_user` identities with test-only passwords. Revoke their old sessions before each run. Do not print credentials. This setup is imported only by Playwright and cannot run in the application bundle.

- [ ] **Step 2: Add browser authorization tests**

Cover:

1. unauthenticated `/admin` redirects to `/login?next=%2Fadmin`;
2. wrong credentials show the uniform error without revealing account existence;
3. ADMIN login reaches the admin heading and sets an HttpOnly SameSite cookie;
4. logout returns to login and the old cookie cannot reopen `/admin`;
5. USER login redirects away from `/admin` and direct `/admin` access remains denied.

Use roles and labels, not CSS implementation selectors.

- [ ] **Step 3: Extend container smoke without seeding production users**

Keep the existing migration/Web/Worker health flow. Add session env values required for Web startup and verify unauthenticated `/admin` returns a redirect to `/login`; do not seed an administrator in generic container smoke and do not put a password in the image.

- [ ] **Step 4: Run CI and target-server validation**

GitHub Actions must pass `quality` and `container-smoke`. On the target server, use only the isolated `kagura-blog-*` environment: run migrations, execute the admin seed with non-echoing environment injection, verify a second seed rotates only the matching credential, start the validation Web image, check login/admin/logout, and confirm `sub2api` containers remain healthy. Do not modify BaoTa, global Nginx, firewall, or SSH policy.

- [ ] **Step 5: Commit**

Commit: `test: cover administrator authentication flow`

### Task 9: Synchronize documentation and close Phase 2A

**Files:**
- Modify: `README.md`
- Modify: `AGENTS.md`
- Modify: `docs/README.md`
- Modify: `docs/ai-onboarding.md`
- Modify: `docs/architecture.md`
- Modify: `docs/configuration.md`
- Modify: `docs/development.md`
- Modify: `docs/domain-model.md`
- Modify: `docs/features.md`
- Modify: `docs/roadmap.md`
- Modify: `docs/security.md`
- Modify: `docs/testing.md`

- [ ] **Step 1: Record only implemented behavior**

Document the identity schema, session cookie fields, admin seed command, new env variables, exact local non-service commands, CI integration coverage, and server validation result. Mark Phase 2A complete but keep article/media publishing and all later features unimplemented.

- [ ] **Step 2: Run the full non-service local suite**

Using Node 22.23.1:

~~~bash
pnpm install --frozen-lockfile
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
git diff --check
git grep -n -E "BEGIN (RSA|OPENSSH|EC) PRIVATE KEY|AKIA[0-9A-Z]{16}|gh[pousr]_[A-Za-z0-9]{20,}"
~~~

Do not run local Web, Worker, PostgreSQL, Redis, or Docker services.

- [ ] **Step 3: Verify CI and server evidence separately**

Report GitHub Actions unit/integration/E2E/container results separately from the target server's isolated migration, seed, login, and coexistence checks. A CI pass is not evidence of production deployment.

- [ ] **Step 4: Commit and push**

Commit: `docs: record phase 2a identity foundation`

Push `codex/phase-2-auth-content-core`, observe CI to completion, and keep the worktree for Phase 2B.

## Plan Self-Review

- Spec coverage: identity entities, Argon2id, digest-only sessions, Secure/SameSite/HttpOnly cookies, server authorization, BANNED invalidation, admin bootstrap, audit, login rate limiting, CI, and target-server isolation all map to tasks above.
- Scope: public registration, content/media, interaction, hotspots, final visual design, and production CD are explicitly excluded.
- Type consistency: `UserRole`, `UserStatus`, `PermissionIdentity`, `LoginResult`, session digest format, environment names, and table names are consistent across tasks.
- Placeholder scan: the plan contains no implementation placeholders; each behavior has a file, command, expected result, and commit boundary.
