import { expect, test, type Page } from "@playwright/test";

const modelUrl = "https://assets.playwright.invalid/models/e2e-missing.model3.json";
const preferenceKey = "kagura-mascot-preference-v1";
const welcomeSessionKey = "kagura-welcome-seen";

interface FailedModelHarness {
  readonly pageErrors: Array<string>;
  readonly requestCount: () => number;
}

async function installFailedModelHarness(page: Page): Promise<FailedModelHarness> {
  let requests = 0;
  const pageErrors: Array<string> = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.route(modelUrl, async (route) => {
    requests += 1;
    await route.fulfill({ status: 404, contentType: "application/json", body: "{}" });
  });
  await page.addInitScript(({ key }) => window.sessionStorage.setItem(key, "1"), {
    key: welcomeSessionKey,
  });
  return { pageErrors, requestCount: () => requests };
}

test("falls back to the poster after one automatic desktop attempt", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const harness = await installFailedModelHarness(page);

  await page.goto("/");
  await expect(page.getByRole("search")).toBeVisible();
  await expect.poll(harness.requestCount).toBe(1);
  await expect(page.locator('.mascot-client[data-state="ERROR"]')).toBeVisible({ timeout: 8_000 });
  await expect(page.locator(".mascot-poster")).toBeVisible();
  expect(harness.requestCount()).toBe(1);
  expect(harness.pageErrors).toEqual([]);

  await page.screenshot({
    path: testInfo.outputPath("mascot-fallback-desktop.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "重试加载看板娘" }).click();
  await expect.poll(harness.requestCount).toBe(2);
});

test("persists close preference and reopens only on command", async ({ page }) => {
  const harness = await installFailedModelHarness(page);

  await page.goto("/");
  await expect.poll(harness.requestCount).toBe(1);
  await page.getByRole("button", { name: "关闭看板娘" }).click();
  await expect(page.getByRole("button", { name: "重新唤醒神乐静无月" })).toBeVisible();
  await expect
    .poll(() => page.evaluate((key) => window.localStorage.getItem(key), preferenceKey))
    .toBe("DISMISSED");

  await page.reload();
  await expect(page.getByRole("button", { name: "重新唤醒神乐静无月" })).toBeVisible();
  await page.waitForTimeout(2_200);
  expect(harness.requestCount()).toBe(1);

  await page.getByRole("button", { name: "重新唤醒神乐静无月" }).click();
  await expect.poll(harness.requestCount).toBe(2);
  expect(harness.pageErrors).toEqual([]);
});

test("keeps mobile model-free until explicit start", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const harness = await installFailedModelHarness(page);

  await page.goto("/");
  const launcher = page.getByRole("button", { name: "唤醒神乐静无月" });
  await expect(launcher).toBeVisible();
  await page.waitForTimeout(2_200);
  expect(harness.requestCount()).toBe(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({
    path: testInfo.outputPath("mascot-launcher-mobile.png"),
    fullPage: true,
  });

  await launcher.click();
  await expect.poll(harness.requestCount).toBe(1);
  expect(harness.pageErrors).toEqual([]);
});

test("keeps reduced-motion desktop model-free until explicit start", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  const harness = await installFailedModelHarness(page);

  await page.goto("/");
  const launcher = page.getByRole("button", { name: "唤醒神乐静无月" });
  await expect(launcher).toBeVisible();
  await page.waitForTimeout(2_200);
  expect(harness.requestCount()).toBe(0);

  await launcher.click();
  await expect.poll(harness.requestCount).toBe(1);
  expect(harness.pageErrors).toEqual([]);
});
