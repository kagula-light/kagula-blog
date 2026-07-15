import { expect, test, type Page } from "@playwright/test";

const preferenceKey = "kagura-mascot-preference-v1";
const welcomeSessionKey = "kagura-welcome-seen";

interface FailedModelHarness {
  readonly pageErrors: Array<string>;
}

async function installFailedModelHarness(page: Page): Promise<FailedModelHarness> {
  const pageErrors: Array<string> = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.addInitScript(({ key }) => window.sessionStorage.setItem(key, "1"), {
    key: welcomeSessionKey,
  });
  return { pageErrors };
}

async function expectMascotFallback(page: Page): Promise<void> {
  await expect(page.locator('.mascot-client[data-state="ERROR"]')).toBeVisible({
    timeout: 8_000,
  });
  await expect(page.locator(".mascot-poster")).toBeVisible();
  await expect(page.getByRole("button", { name: "重试加载看板娘" })).toBeVisible();
}

test("falls back to the poster after one automatic desktop attempt", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const harness = await installFailedModelHarness(page);

  await page.goto("/");
  await expect(page.getByRole("search")).toBeVisible();
  await expectMascotFallback(page);
  expect(harness.pageErrors).toEqual([]);

  await page.screenshot({
    path: testInfo.outputPath("mascot-fallback-desktop.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "重试加载看板娘" }).click();
  await expectMascotFallback(page);
});

test("persists close preference and reopens only on command", async ({ page }) => {
  const harness = await installFailedModelHarness(page);

  await page.goto("/");
  await expectMascotFallback(page);
  await page.getByRole("button", { name: "关闭看板娘" }).click();
  await expect(page.getByRole("button", { name: "重新唤醒神乐静无月" })).toBeVisible();
  await expect
    .poll(() => page.evaluate((key) => window.localStorage.getItem(key), preferenceKey))
    .toBe("DISMISSED");

  await page.reload();
  await expect(page.getByRole("button", { name: "重新唤醒神乐静无月" })).toBeVisible();
  await page.waitForTimeout(2_200);
  await expect(page.locator('.mascot-client[data-state="DISMISSED"]')).toBeVisible();

  await page.getByRole("button", { name: "重新唤醒神乐静无月" }).click();
  await expectMascotFallback(page);
  expect(harness.pageErrors).toEqual([]);
});

test("keeps mobile model-free until explicit start", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const harness = await installFailedModelHarness(page);

  await page.goto("/");
  const launcher = page.getByRole("button", { name: "唤醒神乐静无月" });
  await expect(launcher).toBeVisible();
  await page.waitForTimeout(2_200);
  await expect(page.locator('.mascot-client[data-state="POSTER"]')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({
    path: testInfo.outputPath("mascot-launcher-mobile.png"),
    fullPage: true,
  });

  await launcher.click();
  await expectMascotFallback(page);
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
  await expect(page.locator('.mascot-client[data-state="POSTER"]')).toBeVisible();

  await launcher.click();
  await expectMascotFallback(page);
  expect(harness.pageErrors).toEqual([]);
});
