import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
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
      DATABASE_URL: "postgresql://kagura:test-only@127.0.0.1:55432/kagura_blog_test",
      REDIS_URL: "redis://127.0.0.1:56379/1",
    },
  },
});
