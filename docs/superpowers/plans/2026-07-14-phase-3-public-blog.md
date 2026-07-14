# Phase 3 Public Blog Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the engineering placeholder with a responsive, image-led public blog that exposes only published content and provides article reading, discovery, RSS, and sitemap surfaces.

**Architecture:** Add public-only post queries behind a server repository, compose public routes from Server Components, and isolate welcome-session and mobile table-of-contents behavior in focused Client Components. Original raster assets live under `public/brand`; the public page never imports admin actions or database primitives directly.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 6, Drizzle ORM, PostgreSQL 17, `next/image`, CSS motion with reduced-motion fallbacks, Vitest, Playwright.

---

## Planned File Structure

~~~text
apps/web/
  public/brand/
    kagura-hero.webp
    kagura-hero-mobile.webp
    kagura-avatar.webp
    default-cover.webp
    asset-manifest.md
  src/app/
    page.tsx
    articles/[slug]/page.tsx
    archive/page.tsx
    categories/[slug]/page.tsx
    tags/[slug]/page.tsx
    search/page.tsx
    feed.xml/route.ts
    sitemap.ts
  src/components/site/
    site-header.tsx
    welcome-scene.tsx
    featured-post.tsx
    post-stream.tsx
    site-footer.tsx
  src/components/article/
    article-layout.tsx
    article-toc.tsx
  src/features/posts/server/
    public-post-repository.test.ts
    public-post-repository.ts
  tests/e2e/public-blog.spec.ts
docs/ui-design.md
docs/features.md
docs/testing.md
~~~

The welcome scene is the only immersive viewport. Once dismissed, the page becomes a calm reading index with one featured image, dense article rows, and no marketing copy. Published filtering remains server-side; draft, scheduled, and archived records cannot be recovered through route parameters, feeds, search, or metadata.

### Task 1: Define public content query contracts

- [ ] Write failing tests for published-only list/detail, slug redirects, category/tag filtering, archive grouping, and search.
- [ ] Implement a public repository with stable view models and bounded query limits.
- [ ] Add PostgreSQL integration tests proving unpublished records never appear.
- [ ] Run Web unit tests, typecheck, and CI integration tests.

### Task 2: Create and record original brand assets

- [ ] Generate one desktop hero, one mobile crop, one avatar, and one default cover from the approved original character brief.
- [ ] Convert assets to WebP with explicit dimensions and reasonable byte budgets.
- [ ] Record generation tool, date, prompt, modifications, hashes, and rights status in `asset-manifest.md`.
- [ ] Verify every asset renders and contains nonblank pixels.

### Task 3: Build the public shell and welcome scene

- [ ] Replace the engineering placeholder with semantic header, main, and footer landmarks.
- [ ] Implement a session-only welcome scene with skip, Beijing time, keyboard focus handoff, and reduced-motion fallback.
- [ ] Keep content in the DOM and usable if JavaScript or animation fails.
- [ ] Verify 1440, 1280, 768, 390, and 360 pixel widths.

### Task 4: Build the homepage content index

- [ ] Render one image-led featured article and a dense recent-article stream from Server Component data.
- [ ] Add search, categories/tags, archive, and current-hotspot entry points without fake metrics.
- [ ] Use stable image ratios and default-cover fallbacks.
- [ ] Add empty states that still expose navigation and search.

### Task 5: Build the article reading route

- [ ] Resolve current slug or permanent redirect; return 404 for unpublished content.
- [ ] Render cover, metadata, manual summary, sanitized body, tags, license, and adjacent posts.
- [ ] Extract headings into a desktop sticky table of contents and mobile disclosure without changing stored HTML.
- [ ] Constrain prose, code, table, image, and long-word overflow.

### Task 6: Add discovery and SEO outputs

- [ ] Add search, archive, category, and tag pages using the public repository.
- [ ] Add canonical metadata, Open Graph fallback image, JSON-LD article data, RSS, sitemap, and robots behavior.
- [ ] Verify feeds and maps expose only published canonical URLs.

### Task 7: Add browser acceptance and visual QA

- [ ] Add Playwright coverage for welcome-session behavior, published navigation, unpublished 404, search, article overflow, and reduced motion.
- [ ] Capture desktop/mobile screenshots in CI or the target server browser.
- [ ] Check console errors, failed assets, horizontal overflow, focus order, and fixed-control overlap.
- [ ] Run React best-practices and Impeccable audits across all TSX/CSS changes.

### Task 8: Synchronize documentation and pass CI

- [ ] Update current-state feature, UI, architecture, testing, roadmap, and asset-rights documentation.
- [ ] Run formatting, lint, typecheck, all unit/integration tests, build, Playwright, container smoke, diff check, and secret scan.
- [ ] Record the successful GitHub Actions run without claiming target-server deployment.

## Completion Gate

Phase 3 is complete only when a visitor can reach a real article from the branded homepage, draft/scheduled/archived content remains inaccessible across every public surface, desktop/mobile/reduced-motion checks pass, generated assets have a recorded rights trail, and GitHub Actions passes integration, browser, and Linux container verification.
