import { expect, test, type Page } from "@playwright/test";
import { createDatabaseClient } from "@kagula/database/client";
import { hotspotCandidates } from "@kagula/database/schema";
import { eq } from "drizzle-orm";

import { e2eIdentities } from "./identities";

test.describe.configure({ mode: "serial" });

async function loginAsAdministrator(page: Page): Promise<void> {
  await page.goto("/login?next=/admin/hotspots");
  await page.getByLabel("用户名").fill(e2eIdentities.admin.username);
  await page.getByLabel("密码").fill(e2eIdentities.admin.password);
  await page.getByRole("button", { name: "登录" }).click();
  await expect(page).toHaveURL(/\/admin\/hotspots$/);
}

async function resetPendingCandidate(): Promise<void> {
  const databaseUrl = process.env.TEST_DATABASE_URL;
  if (!databaseUrl) throw new Error("TEST_DATABASE_URL is required for hotspot E2E setup");

  const database = createDatabaseClient(databaseUrl);
  try {
    const [candidate] = await database.db
      .update(hotspotCandidates)
      .set({
        displayTitle: "E2E 待审核热点",
        status: "PENDING",
        publicOrder: null,
        reviewedByUserId: null,
        reviewedAt: null,
        expiresAt: null,
        updatedAt: new Date(),
      })
      .where(eq(hotspotCandidates.externalId, "e2e-hotspot-pending"))
      .returning({ id: hotspotCandidates.id });
    if (!candidate) throw new Error("Playwright pending hotspot candidate was not found");
  } finally {
    await database.close();
  }
}

test("keeps pending and source-health internals off public hotspot pages", async ({
  page,
}, testInfo) => {
  await page.goto("/hotspots");
  await expect(page.getByRole("heading", { name: "每日热点", level: 1 })).toBeVisible();
  const approvedLink = page.getByRole("link", { name: "E2E 已公开热点" });
  await expect(approvedLink).toBeVisible();
  await expect(page.getByText("E2E 待审核热点", { exact: true })).toHaveCount(0);
  await expect(page.getByText("E2E source unavailable", { exact: true })).toHaveCount(0);
  await expect(approvedLink).toHaveAttribute("rel", /noopener/);
  await expect(approvedLink).toHaveAttribute("rel", /noreferrer/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({
    path: testInfo.outputPath("hotspots-current-desktop.png"),
    fullPage: true,
  });

  await page.getByRole("link", { name: /2097-01-02/ }).click();
  await expect(page).toHaveURL(/\/hotspots\/archive\/2097-01-02$/);
  await expect(page.getByRole("link", { name: "E2E 归档热点" })).toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/hotspots");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({
    path: testInfo.outputPath("hotspots-current-mobile.png"),
    fullPage: true,
  });
});

test("administrator approves a pending candidate and publishes it", async ({ page }, testInfo) => {
  await resetPendingCandidate();
  await loginAsAdministrator(page);
  const pendingRow = page.getByRole("row", { name: /E2E 待审核热点/ });
  await expect(pendingRow).toBeVisible();
  await expect(pendingRow.getByText("连续失败 2 次", { exact: true })).toBeVisible();
  const titleInput = pendingRow.getByLabel("E2E 待审核热点的公开标题");
  await titleInput.focus();
  await expect(titleInput).toBeFocused();
  await titleInput.fill("E2E 审核后公开热点");
  await pendingRow.getByLabel("E2E 待审核热点的公开顺序").fill("2");
  await pendingRow.getByRole("button", { name: "批准" }).click();
  await expect(page.getByText("热点审核已保存", { exact: true })).toBeVisible();

  await page.goto("/hotspots");
  await expect(page.getByRole("link", { name: "E2E 审核后公开热点" })).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("hotspots-approved-desktop.png"),
    fullPage: true,
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/admin/hotspots?status=APPROVED");
  await expect(page.getByRole("heading", { name: "热点审核" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({ path: testInfo.outputPath("hotspots-admin-mobile.png"), fullPage: true });
});
