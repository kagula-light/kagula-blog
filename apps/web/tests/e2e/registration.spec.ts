import { expect, test } from "@playwright/test";

test("registers a reader and opens the protected account page", async ({
  context,
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const suffix = `${Date.now()}${testInfo.retry}`.slice(-12);
  const username = `reader_${suffix}`;
  const displayName = "星图新读者";

  await page.goto("/register");
  await page.getByLabel("用户名").fill(username);
  await page.getByLabel("展示名称").fill(displayName);
  await page.getByLabel("密码", { exact: true }).fill("correct horse battery staple");
  await page.getByLabel("确认密码").fill("correct horse battery staple");

  const challengeResponse = page.locator('input[name="cf-turnstile-response"]');
  await expect(challengeResponse).toBeAttached();
  await expect.poll(() => challengeResponse.inputValue()).not.toBe("");
  await page.getByRole("button", { name: "创建账号" }).click();

  await expect(page).toHaveURL(/\/account$/);
  await expect(page.getByRole("heading", { name: displayName })).toBeVisible();
  await expect(page.getByText("正常", { exact: true })).toBeVisible();
  const sessionCookie = (await context.cookies()).find(
    (cookie) => cookie.name === "kagura_playwright_session",
  );
  expect(sessionCookie).toMatchObject({ httpOnly: true, sameSite: "Lax" });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    await page.evaluate(() => document.documentElement.clientWidth),
  );
  await page.screenshot({
    path: testInfo.outputPath("registration-account-mobile.png"),
    fullPage: true,
  });
});
