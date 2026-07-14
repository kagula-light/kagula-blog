import { expect, test } from "@playwright/test";

test("renders the branded public shell and exposes liveness", async ({ page, request }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "神乐的无月之境" })).toBeVisible();
  await expect(page.locator("main")).toBeVisible();

  const response = await request.get("/api/health/live");
  expect(response.status()).toBe(200);
  await expect(response.json()).resolves.toMatchObject({ service: "web", status: "ok" });
});
