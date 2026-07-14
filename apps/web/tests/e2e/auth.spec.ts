import { expect, test } from "@playwright/test";

import { e2eIdentities } from "./identities";

test("redirects an unauthenticated administrator request to login", async ({ page }) => {
  await page.goto("/admin");

  await expect(page).toHaveURL(/\/login\?next=%2Fadmin$/);
  await expect(page.getByRole("heading", { name: "账号登录" })).toBeVisible();
});

test("uses the same message for unknown users and wrong passwords", async ({ page }) => {
  await page.goto("/login");

  for (const username of ["missing_e2e_user", e2eIdentities.admin.username]) {
    await page.getByLabel("用户名").fill(username);
    await page.getByLabel("密码").fill("wrong-password-value");
    await page.getByRole("button", { name: "登录" }).click();
    await expect(page.getByRole("alert")).toHaveText("用户名或密码错误");
  }
});

test("allows an administrator to login and sets a protected session cookie", async ({
  context,
  page,
}) => {
  await page.goto("/admin");
  await page.getByLabel("用户名").fill(e2eIdentities.admin.username);
  await page.getByLabel("密码").fill(e2eIdentities.admin.password);
  await page.getByRole("button", { name: "登录" }).click();

  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole("heading", { name: "管理后台" })).toBeVisible();
  const sessionCookie = (await context.cookies()).find(
    (cookie) => cookie.name === "kagura_playwright_session",
  );
  expect(sessionCookie).toMatchObject({ httpOnly: true, sameSite: "Lax" });
  expect(sessionCookie?.value).toBeTruthy();
});

test("revokes the current session on logout", async ({ context, page }) => {
  await page.goto("/login");
  await page.getByLabel("用户名").fill(e2eIdentities.admin.username);
  await page.getByLabel("密码").fill(e2eIdentities.admin.password);
  await page.getByRole("button", { name: "登录" }).click();
  await expect(page).toHaveURL(/\/admin$/);

  const oldSessionCookie = (await context.cookies()).find(
    (cookie) => cookie.name === "kagura_playwright_session",
  );
  expect(oldSessionCookie).toBeDefined();

  await page.getByRole("button", { name: "退出登录" }).click();
  await expect(page).toHaveURL(/\/login$/);

  await context.clearCookies();
  await context.addCookies([
    {
      name: oldSessionCookie!.name,
      value: oldSessionCookie!.value,
      url: "http://127.0.0.1:3000",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/login\?next=%2Fadmin$/);
});

test("keeps a regular user outside the administrator area", async ({ page }) => {
  await page.goto("/login?next=/admin");
  await page.getByLabel("用户名").fill(e2eIdentities.user.username);
  await page.getByLabel("密码").fill(e2eIdentities.user.password);
  await page.getByRole("button", { name: "登录" }).click();

  await expect(page).toHaveURL("http://127.0.0.1:3000/");
  await page.goto("/admin");
  await expect(page).toHaveURL("http://127.0.0.1:3000/");
});
