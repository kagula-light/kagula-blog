# Phase 6 Live2D Mascot Runtime Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a rights-safe, optional Live2D mascot boundary with a stable poster fallback, persisted close preference, desktop idle loading, mobile/reduced-motion opt-in, and deterministic cleanup without claiming an unlicensed model is complete.

**Architecture:** The root layout composes one Server Component shell. One focused Client Component owns the browser lifecycle through a custom hook, while a single adapter dynamically imports `l2d-widget`; no Server Component or unrelated page imports the runtime. Server configuration resolves only relative model paths under the configured R2 public base URL, and production renders nothing when the feature is disabled.

**Tech Stack:** Next.js 16, React 19, TypeScript 6, `l2d-widget` 0.1.0, Vitest, Playwright, `next/image`.

---

## Planned File Structure

~~~text
apps/web/src/features/mascot/
  components/
    mascot-shell.tsx
    mascot-client.tsx
  hooks/
    use-mascot-runtime.ts
  lib/
    load-mascot.ts
    mascot-config.ts
    mascot-preferences.ts
  types.ts
~~~

`mascot-shell.tsx` is the only Server Component entrypoint. `mascot-client.tsx` renders controls and stable browser states. `use-mascot-runtime.ts` owns media queries, idle loading, page visibility and teardown. `load-mascot.ts` is the only module allowed to import the third-party runtime. `mascot-config.ts` rejects absolute, cross-origin and traversal model paths before they reach the browser.

### Task 1: Validate optional server configuration

**Files:**
- Modify: `apps/web/src/server/config/env.ts`
- Modify: `apps/web/src/server/config/env.test.ts`
- Create: `apps/web/src/features/mascot/lib/mascot-config.ts`
- Create: `apps/web/src/features/mascot/lib/mascot-config.test.ts`
- Modify: `.env.example`
- Modify: `.env.test.example`
- Modify: `infra/docker/compose.smoke.yml`
- Modify: `apps/web/playwright.config.ts`

- [ ] Add failing tests proving `MASCOT_ENABLED` defaults false, only accepts `true|false`, disabled mode needs no model path, and enabled model paths reject schemes, leading `//`, `..`, backslashes and cross-origin URLs.
- [ ] Define `MascotServerConfig` with `enabled`, `posterPath` and nullable `modelUrl`; resolve model paths with `new URL(relativePath, R2_PUBLIC_BASE_URL + "/")` only after relative-path validation.
- [ ] Extend `getServerEnv` with optional `MASCOT_ENABLED`, `MASCOT_MODEL_PATH` and `MASCOT_POSTER_PATH`, keeping the poster default `/brand/kagura-avatar.webp` and the model nullable.
- [ ] Set examples and smoke to false; set Playwright to true with `models/e2e-missing.model3.json` so CI can exercise the failure fallback without publishing a model.
- [ ] Run `pnpm -C apps/web exec vitest run src/server/config/env.test.ts src/features/mascot/lib/mascot-config.test.ts` and `pnpm -C apps/web typecheck`.
- [ ] Commit `feat: validate optional mascot configuration`.

### Task 2: Add preferences and runtime adapter

**Files:**
- Modify: `apps/web/package.json`
- Modify: `pnpm-lock.yaml`
- Create: `apps/web/src/features/mascot/types.ts`
- Create: `apps/web/src/features/mascot/lib/mascot-preferences.ts`
- Create: `apps/web/src/features/mascot/lib/mascot-preferences.test.ts`
- Create: `apps/web/src/features/mascot/lib/load-mascot.ts`
- Create: `apps/web/src/features/mascot/lib/load-mascot.test.ts`

- [ ] Install exact `l2d-widget@0.1.0` and inspect its shipped declaration before coding the adapter.
- [ ] Define lifecycle states `POSTER|LOADING|ACTIVE|SLEEPING|DISMISSED|ERROR` and a narrow `MascotRuntime` interface exposing only `sleep()` and `destroy()`.
- [ ] Write failing preference tests for missing, dismissed and invalid localStorage values under key `kagura-mascot-preference-v1`.
- [ ] Implement guarded preference read/write functions that catch storage denial and never throw into rendering.
- [ ] Write adapter tests with an injected module loader proving `createWidget({ model: { path } })` is called once, methods are narrowed, and partial initialization is destroyed on failure.
- [ ] Implement `loadMascot(modelUrl, loadModule = () => import("l2d-widget"))`; do not expose the third-party Widget outside this file.
- [ ] Run focused tests, typecheck, dependency license metadata check and build.
- [ ] Commit `feat: isolate mascot runtime and preferences`.

### Task 3: Implement deterministic client lifecycle

**Files:**
- Create: `apps/web/src/features/mascot/hooks/use-mascot-runtime.ts`
- Create: `apps/web/src/features/mascot/hooks/use-mascot-runtime.test.ts`
- Create: `apps/web/src/features/mascot/components/mascot-client.tsx`
- Create: `apps/web/src/features/mascot/components/mascot-shell.tsx`
- Modify: `apps/web/src/components/site/welcome-scene.tsx`
- Modify: `apps/web/src/app/layout.tsx`

- [ ] Extract and test a pure auto-load decision: require enabled model, desktop width above 768 px, no reduced motion, not dismissed, welcome session completed and no previous automatic attempt.
- [ ] Implement the hook with `matchMedia`, `requestIdleCallback` plus timeout fallback, visibility sleep, explicit start, explicit retry, dismiss and cleanup; every timer/listener/runtime receives a teardown path.
- [ ] Dispatch `kagura:welcome-complete` when the welcome scene is skipped or exits, and treat an existing `kagura-welcome-seen=1` session value as already complete.
- [ ] Build `MascotClient` with fixed state-driven controls: start/retry, sleep and close buttons with accessible names and native `title` tooltips. Closing destroys runtime and persists `DISMISSED`.
- [ ] Build `MascotShell` as a stable `aside` with `next/image` poster and Client Component; return null only when server config is disabled.
- [ ] Compose the shell once in the root layout after page children.
- [ ] Run component logic tests, Web unit tests, typecheck and build; execute the React best-practices checklist.
- [ ] Commit `feat: add optional mascot shell and lifecycle`.

### Task 4: Add stable responsive presentation

**Files:**
- Modify: `apps/web/src/app/globals.css`
- Modify: `docs/ui-design.md`
- Modify: `docs/live2d-mascot.md`

- [ ] Add a desktop fixed safe-area container with explicit 15rem by 20rem bounds, a 4rem mobile launcher, `z-index` below dialogs, and no content-dependent dimension changes.
- [ ] Keep the poster visible for `POSTER|LOADING|ERROR|SLEEPING`; reveal runtime canvas only for `ACTIVE`.
- [ ] Disable transitions under `prefers-reduced-motion`; mobile and reduced-motion styles must not hide the explicit launcher.
- [ ] Ensure controls are icon-sized squares using familiar text symbols only when no icon library exists, each with accessible names and tooltips.
- [ ] Record that current procedural poster has no character and that model visual completion remains blocked on an authorized original model.
- [ ] Run format, Lint, typecheck and build.
- [ ] Commit `feat: style mascot fallback and controls`.

### Task 5: Add remote browser acceptance

**Files:**
- Create: `apps/web/tests/e2e/mascot.spec.ts`
- Modify: `apps/web/tests/e2e/global-setup.ts` only if deterministic state cleanup is required
- Modify: `docs/testing.md`

- [ ] Test desktop failed-model behavior: page content is interactive first, request is attempted once, poster remains visible, retry is explicit and console has no unhandled error.
- [ ] Test close preference: close, reload and prove no automatic model request plus a stable reopen control.
- [ ] Test 390 px and reduced-motion: before explicit start there is no model request; launcher does not overlap the main content width.
- [ ] Capture 1440x900 and 390x844 screenshots. Do not perform a Canvas-pixel success assertion because no authorized model is configured.
- [ ] Run `pnpm -C apps/web exec playwright test --list` locally without starting services, then push for GitHub Actions PostgreSQL/Chromium/container execution.
- [ ] Update docs with exact passing counts and distinguish component/fallback verification from model visual verification.
- [ ] Commit `test: verify mascot fallback and preferences`.

## Plan Self-Review

- The third-party runtime is absent from Server Components and first-load imports.
- Disabled production configuration renders no widget; missing or failed models preserve the site and poster.
- Mobile and reduced-motion modes never auto-request the model.
- Close preference survives reload and is not cleared by releases.
- All browser listeners, idle callbacks, timers and runtime objects have cleanup.
- No model, texture, motion or expression is added without a rights record.
- Browser acceptance cannot claim a nonblank animated Canvas until an authorized original model is supplied.
