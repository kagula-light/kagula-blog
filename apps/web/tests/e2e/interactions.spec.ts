import { expect, test, type BrowserContext, type Locator, type Page } from "@playwright/test";

import { e2eIdentities } from "./identities";

async function ensurePressed(button: Locator): Promise<void> {
  if ((await button.getAttribute("aria-pressed")) === "true") {
    await button.click();
    await expect(button).toHaveAttribute("aria-pressed", "false");
  }
  await button.click();
  await expect(button).toHaveAttribute("aria-pressed", "true");
}

async function login(page: Page, identity: (typeof e2eIdentities)[keyof typeof e2eIdentities]) {
  await page.goto("/login");
  await page.getByLabel("用户名").fill(identity.username);
  await page.getByLabel("密码").fill(identity.password);
  await page.getByRole("button", { name: "登录" }).click();
}

async function closeContext(context: BrowserContext): Promise<void> {
  await context.close();
}

test("persists reader likes and favorites across article and account pages", async ({ page }) => {
  await login(page, e2eIdentities.user);
  await expect(page).toHaveURL("http://127.0.0.1:3000/");

  await page.goto("/articles/e2e-public-article");
  const likeButton = page.getByRole("button", { name: /点赞/ });
  const favoriteButton = page.getByRole("button", { name: /收藏/ });
  await ensurePressed(likeButton);
  await ensurePressed(favoriteButton);

  const pendingComment = `等待审核-${Date.now()}`;
  await page.getByLabel("发表评论").fill(pendingComment);
  await page.getByRole("button", { name: "提交评论" }).click();
  await expect(page.getByText("评论已提交，等待审核", { exact: true })).toBeVisible();
  await expect(page.locator(".comment-list").getByText(pendingComment)).toHaveCount(0);

  await page.reload();
  await expect(page.getByRole("button", { name: /已点赞/ })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByRole("button", { name: /已收藏/ })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.locator(".comment-list").getByText(pendingComment)).toHaveCount(0);

  await page.goto("/account");
  await expect(page.getByRole("heading", { name: e2eIdentities.user.displayName })).toBeVisible();
  await expect(page.getByRole("link", { name: "E2E 公开文章" })).toBeVisible();
});

test("approves a pending comment, enforces mute, and revokes a banned session", async ({
  browser,
  page,
}, testInfo) => {
  await login(page, e2eIdentities.governed);
  await expect(page).toHaveURL("http://127.0.0.1:3000/");
  await page.goto("/articles/e2e-public-article");

  const pendingComment = `治理审核-${Date.now()}`;
  await page.getByLabel("发表评论").fill(pendingComment);
  await page.getByRole("button", { name: "提交评论" }).click();
  await expect(page.getByText("评论已提交，等待审核", { exact: true })).toBeVisible();
  await expect(page.locator(".comment-list").getByText(pendingComment)).toHaveCount(0);

  const adminContext = await browser.newContext();
  const adminPage = await adminContext.newPage();
  try {
    await login(adminPage, e2eIdentities.admin);
    await adminPage.goto("/admin/comments?status=PENDING");
    const commentRow = adminPage.getByRole("row", { name: new RegExp(pendingComment) });
    await expect(commentRow).toBeVisible();
    await commentRow.getByRole("button", { name: "批准" }).click();
    await expect(adminPage.getByText("评论审核状态已更新", { exact: true })).toBeVisible();

    await page.reload();
    await expect(page.locator(".comment-list").getByText(pendingComment)).toBeVisible();

    await adminPage.goto(`/admin/users?q=${e2eIdentities.governed.username}`);
    let userRow = adminPage.getByRole("row", { name: new RegExp(e2eIdentities.governed.username) });
    await expect(userRow).toBeVisible();
    await userRow.getByRole("button", { name: "禁言" }).click();
    await expect(adminPage.getByText("用户状态已更新", { exact: true })).toBeVisible();

    const mutedComment = `禁言拒绝-${Date.now()}`;
    await page.getByLabel("发表评论").fill(mutedComment);
    await page.getByRole("button", { name: "提交评论" }).click();
    await expect(page.getByText("当前账号不能提交评论", { exact: true })).toBeVisible();

    await adminPage.reload();
    userRow = adminPage.getByRole("row", { name: new RegExp(e2eIdentities.governed.username) });
    await userRow.getByRole("button", { name: "恢复" }).click();
    await expect(adminPage.getByText("用户状态已更新", { exact: true })).toBeVisible();
    await adminPage.reload();
    userRow = adminPage.getByRole("row", { name: new RegExp(e2eIdentities.governed.username) });
    await userRow.getByRole("button", { name: "封禁" }).click();
    await expect(adminPage.getByText("用户状态已更新", { exact: true })).toBeVisible();
    await adminPage.screenshot({
      path: testInfo.outputPath("admin-user-governance.png"),
      fullPage: true,
    });

    await page.goto("/account");
    await expect(page).toHaveURL(/\/login\?next=%2Faccount$/);
  } finally {
    await closeContext(adminContext);
  }
});

test("keeps muted and banned credentials within their server-side boundaries", async ({ page }) => {
  await login(page, e2eIdentities.muted);
  await expect(page).toHaveURL("http://127.0.0.1:3000/");
  await page.goto("/articles/e2e-public-article");
  await page.getByLabel("发表评论").fill("禁言账号不能提交");
  await page.getByRole("button", { name: "提交评论" }).click();
  await expect(page.getByText("当前账号不能提交评论", { exact: true })).toBeVisible();

  await page.context().clearCookies();
  await login(page, e2eIdentities.banned);
  await expect(page.getByText("用户名或密码错误", { exact: true })).toBeVisible();
});
