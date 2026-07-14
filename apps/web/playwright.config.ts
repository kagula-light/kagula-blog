import { defineConfig, devices } from "@playwright/test";

const databaseUrl =
  process.env.TEST_DATABASE_URL ??
  process.env.DATABASE_URL ??
  "postgresql://kagura:test-only@127.0.0.1:55432/kagura_blog_test";
const redisUrl = process.env.TEST_REDIS_URL ?? process.env.REDIS_URL ?? "redis://127.0.0.1:56379/1";

export default defineConfig({
  testDir: "./tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:3000",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "pnpm start",
    url: "http://127.0.0.1:3000/api/health/live",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    env: {
      NODE_ENV: "production",
      APP_URL: "http://127.0.0.1:3000",
      APP_TIMEZONE: "Asia/Shanghai",
      APP_RELEASE: "playwright",
      LOG_LEVEL: "warn",
      DATABASE_URL: databaseUrl,
      REDIS_URL: redisUrl,
      SESSION_SECRET: "playwright_session_secret_not_for_production",
      SESSION_COOKIE_NAME: "kagura_playwright_session",
      SESSION_TTL_HOURS: "24",
    },
  },
});
