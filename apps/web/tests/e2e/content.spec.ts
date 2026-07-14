import { expect, test } from "@playwright/test";

import { e2eIdentities } from "./identities";

async function loginAsAdministrator(page: import("@playwright/test").Page): Promise<void> {
  await page.goto("/login?next=/admin/posts");
  await page.getByLabel("用户名").fill(e2eIdentities.admin.username);
  await page.getByLabel("密码").fill(e2eIdentities.admin.password);
  await page.getByRole("button", { name: "登录" }).click();
  await expect(page).toHaveURL(/\/admin\/posts$/);
}

test("administrator creates, previews, publishes, and archives a Markdown post", async ({
  page,
}) => {
  await loginAsAdministrator(page);
  const slug = `e2e-content-${Date.now()}`;

  await page.getByRole("link", { name: "新建文章" }).click();
  await page.getByLabel("标题").fill("E2E Content Lifecycle");
  await page.getByLabel("文章路径").fill(slug);
  await page.getByLabel("摘要").fill("A browser-verified content lifecycle.");
  await page.getByLabel("Markdown 正文").fill("# E2E Content\n\n**Published safely.**");
  await page.getByRole("button", { name: "保存草稿" }).click();

  await expect(page).toHaveURL(/\/admin\/posts\/[a-f0-9-]+\/edit\?saved=1$/);
  await page.getByRole("link", { name: "预览" }).click();
  await expect(page.getByRole("heading", { name: "E2E Content Lifecycle" })).toBeVisible();
  await expect(page.getByText("Published safely.")).toBeVisible();

  await page.getByRole("link", { name: "返回编辑" }).click();
  await page.getByRole("button", { name: "发布", exact: true }).click();
  await expect(page).toHaveURL(/\/edit\?saved=1$/);
  await page.getByRole("link", { name: "预览" }).click();
  await expect(page.getByText("PUBLISHED", { exact: true })).toBeVisible();

  await page.getByRole("link", { name: "返回编辑" }).click();
  await page.getByRole("button", { name: "归档" }).click();
  await page.getByRole("link", { name: "预览" }).click();
  await expect(page.getByText("ARCHIVED", { exact: true })).toBeVisible();
});
