import { expect, test, type Locator } from "@playwright/test";

import { e2eIdentities } from "./identities";

async function ensurePressed(button: Locator): Promise<void> {
  if ((await button.getAttribute("aria-pressed")) === "true") {
    await button.click();
    await expect(button).toHaveAttribute("aria-pressed", "false");
  }
  await button.click();
  await expect(button).toHaveAttribute("aria-pressed", "true");
}

test("persists reader likes and favorites across article and account pages", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("用户名").fill(e2eIdentities.user.username);
  await page.getByLabel("密码").fill(e2eIdentities.user.password);
  await page.getByRole("button", { name: "登录" }).click();
  await expect(page).toHaveURL("http://127.0.0.1:3000/");

  await page.goto("/articles/e2e-public-article");
  const likeButton = page.getByRole("button", { name: /点赞/ });
  const favoriteButton = page.getByRole("button", { name: /收藏/ });
  await ensurePressed(likeButton);
  await ensurePressed(favoriteButton);

  await page.reload();
  await expect(page.getByRole("button", { name: /已点赞/ })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByRole("button", { name: /已收藏/ })).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  await page.goto("/account");
  await expect(page.getByRole("heading", { name: e2eIdentities.user.displayName })).toBeVisible();
  await expect(page.getByRole("link", { name: "E2E 公开文章" })).toBeVisible();
});
