# Phase 1 Engineering Foundation Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a reproducible pnpm monorepo with a minimal Next.js Web app, an independent Worker, PostgreSQL/Redis migration and readiness checks, local object storage, container images, browser smoke tests, and CI without production deployment authority.

**Architecture:** `apps/web` owns Next.js routes and browser delivery, while `apps/worker` owns background-process startup and its own health server. `packages/config`, `packages/contracts`, and `packages/database` provide narrowly scoped shared modules; local and CI infrastructure lives under `infra` and does not touch the production server.

**Tech Stack:** Node.js 22.23.1, pnpm 11.11.0, Next.js 16.2.10, React 19.2.7, TypeScript 6.0.3, Tailwind CSS 4.3.2, Drizzle ORM 0.45.2, PostgreSQL 17, Redis 7.4, Vitest 4.1.10, Playwright 1.61.1, Docker Compose, GitHub Actions.

---

## Scope

This plan implements roadmap Phase 1 only. It deliberately does not implement authentication, article tables, the admin interface, public visual design, Live2D, interactions, hotspot adapters, R2 production access, GHCR publishing, SSH deployment, or production CD.

Use these skills during implementation:

- `@react:components` for React file boundaries, named components, readonly props, and isolated browser logic.
- `@react-best-practices` after multiple TSX files change.
- `@superpowers:test-driven-development` for behavior-bearing modules.
- `@superpowers:verification-before-completion` before every completion claim.

No Stitch project or Stitch screen exists. The Stitch retrieval steps in `@react:components` are therefore not applicable; its component architecture and validation rules still apply.

## Dependency Baseline

These versions were checked against npm on 2026-07-10. Use exact versions and commit `pnpm-lock.yaml`.

| Package | Version |
| --- | --- |
| `next`, `eslint-config-next` | `16.2.10` |
| `react`, `react-dom` | `19.2.7` |
| `typescript` | `6.0.3` |
| `pnpm` | `11.11.0` |
| `tailwindcss`, `@tailwindcss/postcss` | `4.3.2` |
| `drizzle-orm` | `0.45.2` |
| `drizzle-kit` | `0.31.10` |
| `postgres` | `3.4.9` |
| `redis` | `6.1.0` |
| `zod` | `4.4.3` |
| `vitest`, `@vitest/coverage-v8` | `4.1.10` |
| `@playwright/test` | `1.61.1` |
| `eslint` | `9.39.4` |
| `prettier` | `3.9.5` |
| `tsx` | `4.23.0` |
| `tsup` | `8.5.1` |
| `dotenv` | `17.4.2` |
| `pino` | `10.3.1` |
| `@types/node` | `22.20.1` |
| `@types/react` | `19.2.17` |
| `@types/react-dom` | `19.2.3` |

TypeScript 7 is intentionally not selected because the TypeScript parser used by the current Next.js ESLint stack declares support below TypeScript 6.1. Node 23 is intentionally not selected because Vitest 4 and ESLint 10 share support on Node 22 LTS, not Node 23.

## Planned Directory Structure

~~~text
.github/
  workflows/
    ci.yml
apps/
  web/
    package.json
    next.config.ts
    playwright.config.ts
    postcss.config.mjs
    tsconfig.json
    vitest.config.ts
    src/
      app/
        api/health/live/route.ts
        api/health/ready/route.ts
        globals.css
        layout.tsx
        page.tsx
      data/site.ts
      instrumentation.ts
      server/
        config/env.ts
        health/check-readiness.ts
        health/check-readiness.test.ts
        redis/check-redis.ts
    tests/e2e/health.spec.ts
  worker/
    package.json
    tsconfig.json
    tsup.config.ts
    vitest.config.ts
    src/
      config/env.ts
      health/check-readiness.ts
      health/check-readiness.test.ts
      health/create-health-server.ts
      health/create-health-server.test.ts
      index.ts
      migrate.ts
packages/
  config/
    package.json
    tsconfig.json
    src/env.ts
    src/env.test.ts
    typescript/base.json
    typescript/nextjs.json
    typescript/node.json
  contracts/
    package.json
    tsconfig.json
    src/health.ts
    src/health.test.ts
  database/
    package.json
    drizzle.config.ts
    tsconfig.json
    vitest.integration.config.ts
    drizzle/0000_baseline.sql
    drizzle/meta/_journal.json
    src/client.ts
    src/migrate.ts
    src/readiness.ts
    src/schema.ts
    src/readiness.test.ts
    test/migrations.integration.test.ts
infra/
  docker/
    compose.dev.yml
    compose.smoke.yml
    web.Dockerfile
    worker.Dockerfile
  scripts/
    verify-containers.mjs
.dockerignore
.env.example
.env.test.example
.node-version
.prettierignore
eslint.config.mjs
package.json
pnpm-lock.yaml
pnpm-workspace.yaml
prettier.config.mjs
~~~

Design intent:

- Next.js route files compose focused server modules; they do not create database or Redis clients inline.
- React defaults to Server Components. Phase 1 requires no Client Component and no `useEffect` data fetching.
- Framework-mandated Next.js default exports are the only exception to the named-export preference.
- Browser event logic added in later phases belongs in feature-local custom Hooks, not page files.
- Shared packages expose explicit subpaths; do not add broad barrel exports.
- The Worker is independently startable and independently health checked.
- The baseline migration validates the migration runner without introducing premature business tables.
- CI builds production-shaped images but has no GHCR write permission, SSH key, or production Environment.

### Task 1: Establish the Node and pnpm workspace

**Files:**
- Create: `.node-version`
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `prettier.config.mjs`
- Create: `.prettierignore`
- Create: `.dockerignore`
- Modify: `.gitignore`
- Create: `pnpm-lock.yaml` through pnpm

- [ ] **Step 1: Pin the runtime and package manager**

Create `.node-version`:

~~~text
22.23.1
~~~

Create the root `package.json` with `private: true`, `packageManager: "pnpm@11.11.0"`, and `engines.node: ">=22.13 <23"`. Add these scripts:

~~~json
{
  "name": "kagura-blog",
  "private": true,
  "packageManager": "pnpm@11.11.0",
  "engines": { "node": ">=22.13 <23" },
  "scripts": {
    "dev": "pnpm -r --parallel --stream --if-present dev",
    "build": "pnpm -r --workspace-concurrency=1 --if-present build",
    "lint": "eslint .",
    "typecheck": "pnpm -r --workspace-concurrency=1 --if-present typecheck",
    "test": "pnpm -r --workspace-concurrency=1 --if-present test",
    "test:integration": "pnpm -r --workspace-concurrency=1 --if-present test:integration",
    "test:e2e": "pnpm --filter @kagura/web test:e2e",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "infra:up": "docker compose -p kagura-blog-dev -f infra/docker/compose.dev.yml up -d",
    "infra:down": "docker compose -p kagura-blog-dev -f infra/docker/compose.dev.yml down",
    "containers:smoke": "docker compose -p kagura-blog-smoke -f infra/docker/compose.smoke.yml up --build --abort-on-container-failure --exit-code-from smoke"
  },
  "devDependencies": {
    "@playwright/test": "1.61.1",
    "@tailwindcss/postcss": "4.3.2",
    "@types/node": "22.20.1",
    "@types/react": "19.2.17",
    "@types/react-dom": "19.2.3",
    "@vitest/coverage-v8": "4.1.10",
    "dotenv": "17.4.2",
    "eslint": "9.39.4",
    "eslint-config-next": "16.2.10",
    "prettier": "3.9.5",
    "tailwindcss": "4.3.2",
    "tsx": "4.23.0",
    "tsup": "8.5.1",
    "typescript": "6.0.3",
    "vitest": "4.1.10"
  }
}
~~~

- [ ] **Step 2: Define workspace package discovery and injected deploy dependencies**

Create `pnpm-workspace.yaml`:

~~~yaml
packages:
  - apps/*
  - packages/*

injectWorkspacePackages: true
syncInjectedDepsAfterScripts:
  - build
~~~

- [ ] **Step 3: Add formatting and Docker context rules**

Create `prettier.config.mjs` with `semi: true`, `singleQuote: false`, `trailingComma: "all"`, and `printWidth: 100`. Ignore `.next`, coverage, Playwright output, build output, migrations, and generated lockfile formatting. Make `.dockerignore` exclude Git data, local env files, local volumes, test reports, and build caches while retaining `.env.example` files.

- [ ] **Step 4: Extend secret and generated-file ignores**

Add `.env.test`, `.env.development`, `.env.production.local`, `.minio/`, and `*.local` without weakening the existing allow-list for example env files.

- [ ] **Step 5: Install with the pinned toolchain**

Run:

~~~powershell
corepack enable
corepack prepare pnpm@11.11.0 --activate
pnpm install
~~~

Expected: Node satisfies `>=22.13 <23`, pnpm reports `11.11.0`, and `pnpm-lock.yaml` is created. If the current shell still reports Node 23, switch the shell to Node 22.23.1 before installing; do not bypass the engine check.

- [ ] **Step 6: Commit the workspace root**

~~~bash
git add .node-version package.json pnpm-workspace.yaml pnpm-lock.yaml prettier.config.mjs .prettierignore .dockerignore .gitignore
git commit -m "chore: initialize pnpm workspace"
~~~

### Task 2: Add shared TypeScript, lint, and runtime environment configuration

**Files:**
- Create: `eslint.config.mjs`
- Create: `packages/config/package.json`
- Create: `packages/config/tsconfig.json`
- Create: `packages/config/typescript/base.json`
- Create: `packages/config/typescript/nextjs.json`
- Create: `packages/config/typescript/node.json`
- Create: `packages/config/src/env.test.ts`
- Create: `packages/config/src/env.ts`
- Create: `.env.example`
- Create: `.env.test.example`

- [ ] **Step 1: Create the config package manifest and TypeScript presets**

Use package name `@kagura/config`, ESM, private workspace version `0.0.0`, and source export `"./env": { "types": "./src/env.ts", "default": "./src/env.ts" }`. Add `zod@4.4.3`. Add scripts `build`, `dev`, `typecheck`, and `test` using `tsup`, `tsc`, and Vitest. `base.json` must enable `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax`, `moduleResolution: "Bundler"`, `target: "ES2022"`, and `skipLibCheck`. `nextjs.json` adds DOM libs, JSX preserve, and no emit; `node.json` uses Node types and no emit. Run `pnpm install` after creating the manifest so workspace links and `pnpm-lock.yaml` are current before the first test.

- [ ] **Step 2: Write failing environment tests**

Create `packages/config/src/env.test.ts` covering:

~~~ts
import { describe, expect, it } from "vitest";
import { parseRuntimeEnv } from "./env";

const validEnv = {
  NODE_ENV: "test",
  APP_URL: "http://localhost:3000",
  APP_TIMEZONE: "Asia/Shanghai",
  APP_RELEASE: "test-release",
  LOG_LEVEL: "info",
  DATABASE_URL: "postgres://kagura:local@localhost:55432/kagura_blog_test",
  REDIS_URL: "redis://localhost:56379/1",
};

describe("parseRuntimeEnv", () => {
  it("returns a typed environment for valid input", () => {
    expect(parseRuntimeEnv(validEnv).APP_TIMEZONE).toBe("Asia/Shanghai");
  });

  it("rejects an insecure production APP_URL", () => {
    expect(() =>
      parseRuntimeEnv({ ...validEnv, NODE_ENV: "production", APP_URL: "http://example.com" }),
    ).toThrow(/APP_URL/);
  });

  it("reports variable names without leaking values", () => {
    const secret = "do-not-print-this-value";
    expect(() => parseRuntimeEnv({ ...validEnv, DATABASE_URL: secret })).toThrow(/DATABASE_URL/);
    expect(() => parseRuntimeEnv({ ...validEnv, DATABASE_URL: secret })).not.toThrow(secret);
  });
});
~~~

- [ ] **Step 3: Run the focused test and verify RED**

Run: `pnpm --filter @kagura/config test -- src/env.test.ts`

Expected: FAIL because `./env` does not exist.

- [ ] **Step 4: Implement secret-safe environment parsing**

Create `packages/config/src/env.ts` with a Zod object for the fields in the test. Use `superRefine` to require HTTPS for production `APP_URL`, except loopback hosts. `parseRuntimeEnv` must throw one error listing only invalid variable paths, never values or the full input object.

- [ ] **Step 5: Add ESLint flat config and example env files**

Compose `eslint-config-next/core-web-vitals` and `eslint-config-next/typescript` in `eslint.config.mjs`. Add ignores for generated output, coverage, Playwright reports, and `packages/database/drizzle`. Add `react-hooks/exhaustive-deps: "error"` and prohibit explicit `any` except in generated files.

Set `.env.example` to local non-production values on ports 3000/3001, 55432, 56379, and 59000. Set `.env.test.example` to database `kagura_blog_test` and Redis database `1`. Use obvious local-only passwords, never production credentials. Create ignored local copies with `Copy-Item .env.example .env.local` and `Copy-Item .env.test.example .env.test`; never stage either copy.

- [ ] **Step 6: Run GREEN and static checks**

Run:

~~~bash
pnpm --filter @kagura/config test -- src/env.test.ts
pnpm --filter @kagura/config typecheck
pnpm lint
pnpm format:check
~~~

Expected: all commands exit 0.

- [ ] **Step 7: Commit shared configuration**

~~~bash
git add eslint.config.mjs packages/config .env.example .env.test.example pnpm-lock.yaml
git commit -m "chore: add shared runtime configuration"
~~~

### Task 3: Define the Web/Worker health contract

**Files:**
- Create: `packages/contracts/package.json`
- Create: `packages/contracts/tsconfig.json`
- Create: `packages/contracts/src/health.test.ts`
- Create: `packages/contracts/src/health.ts`

- [ ] **Step 1: Create the contract package**

Use package name `@kagura/contracts`, ESM, source export `"./health": { "types": "./src/health.ts", "default": "./src/health.ts" }`, and the same `build`, `dev`, `typecheck`, and `test` scripts as the config package. Do not add React, database, or runtime framework dependencies. Run `pnpm install` before the focused test.

- [ ] **Step 2: Write the failing health response test**

Test a `createHealthResponse` function with service `web`, release `abc123`, status `ok`, fixed timestamp, and checks. Assert the exact serializable object and assert that the checks object is readonly at the TypeScript boundary.

- [ ] **Step 3: Verify RED**

Run: `pnpm --filter @kagura/contracts test -- src/health.test.ts`

Expected: FAIL because `health.ts` does not exist.

- [ ] **Step 4: Implement the stable contract**

Create explicit exported types:

~~~ts
export type ServiceName = "web" | "worker";
export type HealthStatus = "ok" | "error";

export interface HealthCheck {
  readonly status: HealthStatus;
  readonly durationMs: number;
}

export interface HealthResponse {
  readonly service: ServiceName;
  readonly status: HealthStatus;
  readonly release: string;
  readonly timestamp: string;
  readonly checks?: Readonly<Record<string, HealthCheck>>;
}
~~~

`createHealthResponse` accepts a readonly input interface and returns only these fields. Do not add HTTP concerns to the contract package.

- [ ] **Step 5: Verify GREEN and commit**

Run `pnpm --filter @kagura/contracts test`, `pnpm --filter @kagura/contracts typecheck`, then commit:

~~~bash
git add packages/contracts pnpm-lock.yaml
git commit -m "feat: define service health contract"
~~~

### Task 4: Add isolated local PostgreSQL, Redis, and MinIO

**Files:**
- Create: `infra/docker/compose.dev.yml`
- Modify: `.env.example`
- Modify: `.env.test.example`
- Modify: `docs/development.md`

- [ ] **Step 1: Define the isolated development Compose project**

Create services named `kagura-blog-postgres`, `kagura-blog-redis`, `kagura-blog-minio`, and `kagura-blog-minio-init`. Use project-scoped named volumes and a `kagura-blog-dev` bridge network. Use host ports 55432, 56379, 59000, and 59001 to avoid common defaults and existing production services.

Pin images to PostgreSQL 17 Alpine, Redis 7.4 Alpine, `minio/minio:RELEASE.2025-04-22T22-12-26Z`, and `minio/mc:RELEASE.2025-04-16T18-13-26Z`. Before writing Compose, run `docker manifest inspect` for every exact tag; a registry timeout or missing tag blocks this step and must not be bypassed with `latest`. Add health checks. The init container creates a local `kagura-assets` bucket and must be idempotent.

- [ ] **Step 2: Validate Compose without starting services**

Run: `docker compose -p kagura-blog-dev -f infra/docker/compose.dev.yml config --quiet`

Expected: exit 0 with no unresolved variables.

- [ ] **Step 3: Start and inspect only the blog development services**

Run:

~~~bash
docker compose -p kagura-blog-dev -f infra/docker/compose.dev.yml up -d
docker compose -p kagura-blog-dev -f infra/docker/compose.dev.yml ps
~~~

Expected: PostgreSQL, Redis, and MinIO are healthy; the MinIO init container exits 0. Do not run commands against any existing non-blog Compose project.

- [ ] **Step 4: Document startup and teardown**

Update `docs/development.md` with the exact project name, ports, `pnpm infra:up`, `pnpm infra:down`, and the rule that local volumes are disposable and never reused by production.

- [ ] **Step 5: Commit local infrastructure**

~~~bash
git add infra/docker/compose.dev.yml .env.example .env.test.example docs/development.md
git commit -m "chore: add isolated local infrastructure"
~~~

### Task 5: Add the database client and executable baseline migration

**Files:**
- Create: `packages/database/package.json`
- Create: `packages/database/tsconfig.json`
- Create: `packages/database/drizzle.config.ts`
- Create: `packages/database/vitest.integration.config.ts`
- Create: `packages/database/src/schema.ts`
- Create: `packages/database/src/client.ts`
- Create: `packages/database/src/readiness.test.ts`
- Create: `packages/database/src/readiness.ts`
- Create: `packages/database/src/migrate.ts`
- Create: `packages/database/test/migrations.integration.test.ts`
- Generate: `packages/database/drizzle/0000_baseline.sql`
- Generate: `packages/database/drizzle/meta/_journal.json`

- [ ] **Step 1: Create the database package**

Use `@kagura/database`, `drizzle-orm@0.45.2`, and `postgres@3.4.9`; add `drizzle-kit@0.31.10` as a dev dependency. Export only `./client`, `./migrate`, and `./readiness`, each with `types` and `default` pointing to its corresponding `src/*.ts` file. Add scripts for `db:generate`, `db:migrate`, `test`, `test:integration`, `typecheck`, `build`, and `dev`. Run `pnpm install` before the readiness test.

- [ ] **Step 2: Write a failing readiness unit test**

Test `checkDatabaseReadiness` by injecting an async `execute` function. Assert `ok` on success, `error` on rejection, and a non-negative duration without relying on a real clock.

- [ ] **Step 3: Verify readiness RED**

Run: `pnpm --filter @kagura/database test -- src/readiness.test.ts`

Expected: FAIL because `readiness.ts` does not exist.

- [ ] **Step 4: Implement the client and readiness adapter**

`createDatabaseClient` must return a readonly object containing the Drizzle database, the underlying Postgres.js client, and an async `close()` method. `checkDatabaseReadiness` accepts an injected `execute` callback and clock, catches errors, and returns a `HealthCheck`; it must not log connection strings.

- [ ] **Step 5: Generate a custom baseline migration**

Keep `src/schema.ts` empty except for an explanatory comment and `export {}`. Run:

~~~bash
pnpm --filter @kagura/database db:generate -- --custom --name=baseline
~~~

Expected: Drizzle creates `drizzle/0000_baseline.sql` and its journal entry. Put `SELECT 1;` in the SQL file. Do not create placeholder business tables.

- [ ] **Step 6: Write the failing migration integration test**

The test reads `TEST_DATABASE_URL`, runs the migration twice, and queries `drizzle.__drizzle_migrations`. Assert that the baseline has one recorded hash and the second run is idempotent. Fail with a clear missing-variable message without printing the URL.

- [ ] **Step 7: Implement `runMigrations`**

Use `drizzle-orm/postgres-js/migrator`, a single-connection Postgres.js client, an explicit migrations folder argument, and `finally` cleanup. No application module may execute migrations implicitly on import.

- [ ] **Step 8: Verify unit and integration GREEN**

With the dev Compose services running and `TEST_DATABASE_URL` set from `.env.test`, run:

~~~bash
pnpm --filter @kagura/database test
pnpm --filter @kagura/database test:integration
pnpm --filter @kagura/database typecheck
~~~

Expected: all pass; running integration tests repeatedly does not create duplicate migration rows.

- [ ] **Step 9: Commit the database foundation**

~~~bash
git add packages/database pnpm-lock.yaml
git commit -m "feat: add database migration foundation"
~~~

### Task 6: Scaffold the minimal Next.js Web app and health endpoints

**Files:**
- Create: `apps/web/package.json`
- Create: `apps/web/next.config.ts`
- Create: `apps/web/postcss.config.mjs`
- Create: `apps/web/tsconfig.json`
- Create: `apps/web/vitest.config.ts`
- Create: `apps/web/src/data/site.ts`
- Create: `apps/web/src/app/globals.css`
- Create: `apps/web/src/app/layout.tsx`
- Create: `apps/web/src/app/page.tsx`
- Create: `apps/web/src/app/api/health/live/route.ts`
- Create: `apps/web/src/server/config/env.ts`
- Create: `apps/web/src/server/health/check-readiness.test.ts`
- Create: `apps/web/src/server/health/check-readiness.ts`
- Create: `apps/web/src/server/redis/check-redis.ts`
- Create: `apps/web/src/app/api/health/ready/route.ts`
- Create: `apps/web/src/instrumentation.ts`

- [ ] **Step 1: Create the Web package and Next.js configuration**

Use exact dependencies `next@16.2.10`, `react@19.2.7`, `react-dom@19.2.7`, `redis@6.1.0`, and workspace dependencies on config, contracts, and database. Configure `output: "standalone"`, the monorepo tracing root, and `transpilePackages` for the three workspace packages. Add scripts `dev`, `build`, `start`, `typecheck`, and `test`. Run `pnpm install`, then create the ignored local runtime file with `Copy-Item .env.local apps/web/.env.local`; CI continues to inject variables directly and does not depend on this file.

- [ ] **Step 2: Add the server-rendered brand shell**

Put the site name and author in `src/data/site.ts`. `layout.tsx` and `page.tsx` remain Server Components and use semantic `html`, `body`, `main`, `header`, and heading elements. The page must clearly state that this is the engineering foundation, not pretend the final visual design is complete. Use Tailwind 4 through `@import "tailwindcss"`; do not add arbitrary gradients, card grids, a Client Component, or placeholder remote images.

Next.js requires default exports for route and layout modules; keep all reusable components as named exports in later tasks.

- [ ] **Step 3: Add and test liveness**

Implement `GET /api/health/live` with no database or Redis access. It returns a typed `HealthResponse`, status 200, service `web`, the configured release or `dev`, and a current ISO timestamp. Add a direct route-unit test if the response construction contains behavior beyond the shared contract.

- [ ] **Step 4: Write readiness tests before implementation**

Create a test that injects database and Redis checks into `checkReadiness`. Cover all-success, database failure, and Redis failure. Assert overall `error` if either dependency fails and assert both checks still run so one failure does not hide the other.

- [ ] **Step 5: Verify readiness RED**

Run: `pnpm --filter @kagura/web test -- src/server/health/check-readiness.test.ts`

Expected: FAIL because `check-readiness.ts` does not exist.

- [ ] **Step 6: Implement readiness and adapters**

Use `Promise.all` over injected dependency checks. `check-redis.ts` creates a short-lived Redis client, attaches an error listener that does not log the URL, connects, pings, and always quits or disconnects. The ready route parses server env, calls database and Redis checks, and returns 200 for `ok` or 503 for `error`.

- [ ] **Step 7: Validate runtime env at server registration**

`src/instrumentation.ts` exports Next.js `register()` and validates runtime env only in the Node.js server runtime. Do not expose the parsed object to Client Components and do not serialize secrets.

- [ ] **Step 8: Verify the Web app**

Run:

~~~bash
pnpm --filter @kagura/web test
pnpm --filter @kagura/web typecheck
pnpm --filter @kagura/web build
pnpm --filter @kagura/web dev
~~~

Verify in a real browser that `/` renders, `/api/health/live` returns 200, and `/api/health/ready` returns 200 with local PostgreSQL and Redis. Stop the dev server before continuing.

- [ ] **Step 9: Commit the Web foundation**

~~~bash
git add apps/web pnpm-lock.yaml
git commit -m "feat: scaffold web health foundation"
~~~

### Task 7: Scaffold the Worker with independent lifecycle and health

**Files:**
- Create: `apps/worker/package.json`
- Create: `apps/worker/tsconfig.json`
- Create: `apps/worker/tsup.config.ts`
- Create: `apps/worker/vitest.config.ts`
- Create: `apps/worker/src/config/env.ts`
- Create: `apps/worker/src/health/check-readiness.test.ts`
- Create: `apps/worker/src/health/check-readiness.ts`
- Create: `apps/worker/src/health/create-health-server.test.ts`
- Create: `apps/worker/src/health/create-health-server.ts`
- Create: `apps/worker/src/index.ts`
- Create: `apps/worker/src/migrate.ts`

- [ ] **Step 1: Create the Worker package**

Use workspace dependencies on config, contracts, and database plus `redis@6.1.0` and `pino@10.3.1`. Add `dev: "node --env-file-if-exists=../../.env.local --import tsx --watch src/index.ts"`, `migrate: "node --env-file-if-exists=../../.env.local --import tsx src/migrate.ts"`, `build: "tsup"`, `start: "node dist/index.js"`, `typecheck`, and `test`. Configure tsup with ESM entries `src/index.ts` and `src/migrate.ts`, source maps, declarations, clean output, and `noExternal: [/.*/]` so bundled workspace infrastructure imports do not become undeclared runtime imports. Run `pnpm install` before the first Worker test.

- [ ] **Step 2: Write failing readiness and HTTP tests**

Test Worker readiness with injected checks exactly as Web readiness. Test `createHealthServer` on an ephemeral port: `/health/live` returns 200, `/health/ready` maps `ok` to 200 and `error` to 503, unknown paths return 404, and the server closes cleanly.

- [ ] **Step 3: Verify RED**

Run: `pnpm --filter @kagura/worker test`

Expected: FAIL because the health modules do not exist.

- [ ] **Step 4: Implement Worker config and health server**

Extend the shared runtime schema with `WORKER_HEALTH_PORT` coerced to an integer from 1 to 65535. Use Node's `http` module, explicit JSON content type, and no web framework. The health server accepts readonly callbacks and never owns database credentials.

- [ ] **Step 5: Implement process startup and shutdown**

`index.ts` parses env, creates dependency adapters, starts the health server, and registers idempotent `SIGTERM`/`SIGINT` shutdown. Shutdown stops the HTTP server, closes Redis/PostgreSQL clients, flushes Pino, and exits nonzero only on startup or shutdown failure. No hotspot scheduler is added in Phase 1.

- [ ] **Step 6: Add the migration entrypoint**

`migrate.ts` parses only the required database URL and `MIGRATIONS_DIR`, calls `runMigrations`, logs a release-scoped success message without the URL, and exits nonzero on failure.

- [ ] **Step 7: Verify Worker GREEN**

Run:

~~~bash
pnpm --filter @kagura/worker test
pnpm --filter @kagura/worker typecheck
pnpm --filter @kagura/worker build
pnpm --filter @kagura/worker dev
~~~

Verify `/health/live` and `/health/ready`, then send Ctrl+C and confirm the port is released.

- [ ] **Step 8: Commit the Worker foundation**

~~~bash
git add apps/worker pnpm-lock.yaml
git commit -m "feat: scaffold worker health foundation"
~~~

### Task 8: Add Playwright browser smoke coverage

**Files:**
- Create: `apps/web/playwright.config.ts`
- Create: `apps/web/tests/e2e/health.spec.ts`
- Modify: `apps/web/package.json`

- [ ] **Step 1: Write the browser smoke test**

Test the real browser path:

~~~ts
import { expect, test } from "@playwright/test";

test("renders the engineering foundation and exposes liveness", async ({ page, request }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "神乐的无月之境" })).toBeVisible();
  await expect(page.locator("main")).toBeVisible();

  const response = await request.get("/api/health/live");
  expect(response.status()).toBe(200);
  await expect(response.json()).resolves.toMatchObject({ service: "web", status: "ok" });
});
~~~

- [ ] **Step 2: Configure a production-shaped Web server**

Set base URL to `http://127.0.0.1:3000`, use Chromium, retain trace on first retry, and start `pnpm start` through Playwright `webServer`. Reuse an existing server only outside CI. Do not make Playwright build implicitly; the caller must run `pnpm build` first.

- [ ] **Step 3: Install Chromium and run the smoke test**

Run:

~~~bash
pnpm exec playwright install chromium
pnpm build
pnpm test:e2e
~~~

Expected: the heading and liveness checks pass in Chromium.

- [ ] **Step 4: Commit browser smoke coverage**

~~~bash
git add apps/web/playwright.config.ts apps/web/tests/e2e apps/web/package.json pnpm-lock.yaml
git commit -m "test: add web browser smoke coverage"
~~~

### Task 9: Build and smoke-test production-shaped containers

**Files:**
- Create: `infra/docker/web.Dockerfile`
- Create: `infra/docker/worker.Dockerfile`
- Create: `infra/docker/compose.smoke.yml`
- Create: `infra/scripts/verify-containers.mjs`
- Modify: `package.json`

- [ ] **Step 1: Add the Web multi-stage image**

Use `node:22.23.1-alpine`, Corepack, pnpm 11.11.0, frozen install, and `pnpm build`. Copy only Next standalone output and static files into the runtime stage. Run as the built-in non-root `node` user. Expose 3000 and use a Node-based health check; do not install curl solely for health checks.

- [ ] **Step 2: Add the Worker multi-stage image**

Build the workspace, run `pnpm --filter @kagura/worker deploy --prod /prod/worker`, and copy the deployed package plus `packages/database/drizzle` into the runtime image. Run as non-root `node`, expose 3001, and keep `dist/index.js` as the default command.

- [ ] **Step 3: Define smoke Compose without production resources**

Create isolated services for PostgreSQL, Redis, one-shot migration, Web, Worker, and smoke verification. Use project name `kagura-blog-smoke` when invoking it. The migration service uses the Worker image with `node dist/migrate.js`; Web and Worker wait for its successful completion. Do not include GHCR, SSH, BaoTa, public ports 80/443, production volumes, or any existing server container names.

- [ ] **Step 4: Implement deterministic smoke verification**

`verify-containers.mjs` polls Web `/api/health/ready` and Worker `/health/ready` for at most 60 seconds, verifies `status: "ok"` and the expected service name, then exits 0. It prints status codes and service names but never environment values.

- [ ] **Step 5: Validate Dockerfiles and compose**

Run:

~~~bash
docker compose -p kagura-blog-smoke -f infra/docker/compose.smoke.yml config --quiet
pnpm containers:smoke
~~~

Expected: both images build, the migration exits 0, readiness becomes healthy, smoke exits 0, and Compose stops without touching the development project.

- [ ] **Step 6: Inspect size and process identity**

Run `docker image ls kagura-blog-web:smoke` and `docker image ls kagura-blog-worker:smoke`, then run `docker image inspect --format '{{.Config.User}}' kagura-blog-web:smoke` and the same command for `kagura-blog-worker:smoke`. Expected user: `node` for both images. Record image sizes in the implementation handoff; do not invent a hard size budget before measurement.

- [ ] **Step 7: Commit container delivery checks**

~~~bash
git add infra/docker infra/scripts package.json pnpm-lock.yaml
git commit -m "build: add container smoke verification"
~~~

### Task 10: Add CI as the first delivery gate

**Files:**
- Create: `.github/workflows/ci.yml`
- Modify: `docs/testing.md`
- Modify: `docs/deployment.md`

- [ ] **Step 1: Define least-privilege workflow permissions**

Trigger on pull requests and pushes to `main`. Set `permissions: contents: read`, concurrency cancellation by ref, Node 22.23.1, pnpm 11.11.0, and frozen lockfile installs. Do not add `packages: write`, GitHub Environments, SSH actions, deployment secrets, or server addresses.

- [ ] **Step 2: Add the quality job**

Use PostgreSQL 17 and Redis 7.4 service containers with explicit health options. Set only local CI values for `APP_URL`, `APP_TIMEZONE=Asia/Shanghai`, `APP_RELEASE`, `LOG_LEVEL=info`, `DATABASE_URL`, `TEST_DATABASE_URL`, `REDIS_URL`, and `TEST_REDIS_URL`. Run in this order:

1. `pnpm format:check`
2. `pnpm lint`
3. `pnpm typecheck`
4. `pnpm test`
5. `pnpm test:integration`
6. `pnpm build`
7. `pnpm exec playwright install --with-deps chromium`
8. `pnpm test:e2e`

- [ ] **Step 3: Add a dependent container-smoke job**

After quality passes, run `pnpm containers:smoke`. Upload Compose logs only on failure and give the artifact a short retention period. Ensure log collection does not print environment files.

- [ ] **Step 4: Validate workflow syntax and local parity**

Run the same quality commands locally from a clean checkout, then run the smoke Compose command. Review `.github/workflows/ci.yml` manually to confirm there is no production deployment job.

- [ ] **Step 5: Update delivery documentation**

Replace planned Phase 1 commands in `docs/testing.md` and `docs/deployment.md` with actual scripts and workflow job names. Keep production CD explicitly deferred to Phase 6.

- [ ] **Step 6: Commit CI**

~~~bash
git add .github/workflows/ci.yml docs/testing.md docs/deployment.md
git commit -m "ci: add quality and image smoke gates"
~~~

### Task 11: Synchronize project status and perform the Phase 1 acceptance run

**Files:**
- Modify: `README.md`
- Modify: `AGENTS.md`
- Modify: `docs/README.md`
- Modify: `docs/ai-onboarding.md`
- Modify: `docs/architecture.md`
- Modify: `docs/configuration.md`
- Modify: `docs/development.md`
- Modify: `docs/roadmap.md`
- Modify: `docs/testing.md`
- Modify: `docs/superpowers/specs/2026-07-10-kagura-blog-design.md`

- [ ] **Step 1: Update current-state documentation from actual files**

Record the real Node/pnpm versions, package scripts, workspace structure, health routes, local ports, migration command, CI jobs, and container commands. Mark Phase 1 complete only after every acceptance command below passes. Do not describe later-phase features as implemented.

- [ ] **Step 2: Run React quality review**

Use `@react-best-practices` on every TSX file. Confirm Server Components remain the default, no client fetch-in-effect exists, semantic HTML and heading order are valid, `next/image` is used if any content image was added, and no reusable component uses a default export.

- [ ] **Step 3: Run the full static and automated suite**

Run from a clean Node 22.23.1 shell:

~~~bash
pnpm install --frozen-lockfile
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm test:integration
pnpm build
pnpm test:e2e
pnpm containers:smoke
~~~

Expected: every command exits 0. Report test counts and build outputs from actual command results.

- [ ] **Step 4: Verify runtime and failure paths**

Verify Web and Worker liveness do not depend on PostgreSQL/Redis. Stop Redis inside the smoke project and confirm readiness returns 503 while liveness remains 200; restart Redis and confirm readiness recovers. Confirm migration failure prevents Web/Worker startup in smoke Compose.

- [ ] **Step 5: Verify repository and secret hygiene**

Run:

~~~bash
git diff --check
git status --short
git grep -n -E "BEGIN (RSA|OPENSSH|EC) PRIVATE KEY|AKIA[0-9A-Z]{16}|gh[pousr]_[A-Za-z0-9]{20,}"
~~~

Expected: no whitespace errors, only intentional tracked changes, and no secret-pattern matches. Also inspect Docker build history to confirm no env values were passed as build arguments.

- [ ] **Step 6: Commit Phase 1 documentation**

~~~bash
git add README.md AGENTS.md docs
git commit -m "docs: record phase 1 engineering foundation"
~~~

- [ ] **Step 7: Produce the implementation handoff**

Report separately:

- Static checks and exact commands.
- Unit/integration/E2E test counts.
- Web and Worker builds.
- Browser verification path and viewport.
- Container smoke and dependency-failure results.
- Anything not run and why.

Do not claim production deployment, Live2D completion, final visual completion, or server hardening in this phase.
