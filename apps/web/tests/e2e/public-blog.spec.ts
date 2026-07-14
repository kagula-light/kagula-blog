import { expect, test } from "@playwright/test";

const publishedSlug = "e2e-public-article";
const draftSlug = "e2e-hidden-draft";

async function skipWelcomeOnLoad(page: import("@playwright/test").Page): Promise<void> {
  await page.addInitScript(() => window.sessionStorage.setItem("kagura-welcome-seen", "1"));
}

test("welcome scene appears once per browser session and hands focus to content", async ({
  page,
}) => {
  await page.goto("/");
  const welcome = page.getByRole("dialog", { name: "神乐的无月之境" });
  await expect(welcome).toBeVisible();
  await page.getByRole("button", { name: "进入书库" }).click();
  await expect(welcome).toBeHidden();
  await expect(page.locator("#main-content")).toBeFocused();

  await page.reload();
  await expect(welcome).toBeHidden();
  await expect(page.getByRole("heading", { name: /在深夜/ })).toBeVisible();
});

test("visitor reaches a published article from the homepage and can search for it", async ({
  page,
}, testInfo) => {
  await skipWelcomeOnLoad(page);
  await page.goto("/");
  await page.getByRole("link", { name: "E2E 公开文章", exact: true }).first().click();
  await expect(page).toHaveURL(`/articles/${publishedSlug}`);
  await expect(page.getByRole("heading", { name: "E2E 公开文章", level: 1 })).toBeVisible();
  await expect(page.getByText("只有公开文章会进入这片星图。", { exact: true })).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("public-article-desktop.png"),
    fullPage: true,
  });

  await page.goto("/search?q=星图可见性");
  await expect(page.getByRole("link", { name: "E2E 公开文章", exact: true })).toBeVisible();
});

test("draft content stays unavailable across page and feed surfaces", async ({ page, request }) => {
  await skipWelcomeOnLoad(page);
  const draftResponse = await request.get(`/articles/${draftSlug}`);
  expect(draftResponse.status()).toBe(404);

  const searchResponse = await request.get("/search?q=绝不能公开的草稿针");
  expect(await searchResponse.text()).not.toContain("E2E 隐藏草稿");

  const feedResponse = await request.get("/feed.xml");
  expect(feedResponse.status()).toBe(200);
  const feed = await feedResponse.text();
  expect(feed).toContain("E2E 公开文章");
  expect(feed).not.toContain("E2E 隐藏草稿");
});

test("mobile article has no page-level horizontal overflow", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await skipWelcomeOnLoad(page);
  await page.goto(`/articles/${publishedSlug}`);
  await expect(page.getByRole("heading", { name: "E2E 公开文章", level: 1 })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({ path: testInfo.outputPath("public-article-mobile.png"), fullPage: true });
});

test("reduced-motion visitors do not receive the welcome drift animation", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.getByRole("dialog", { name: "神乐的无月之境" })).toBeVisible();
  const animationName = await page.locator(".welcome-art img").evaluate((element) => {
    return window.getComputedStyle(element).animationName;
  });
  expect(animationName).toBe("none");
});
