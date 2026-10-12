import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end configuration.
 *
 * In CI the web server is started by the workflow (with a real API + Postgres
 * service container) via WEB_SERVER_URL / API_BASE_URL. Locally, `playwright
 * test` will boot both dev servers itself.
 */
const WEB_URL = process.env.WEB_URL ?? "http://localhost:5173";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  timeout: 30_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: WEB_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: process.env.CI
    ? undefined
    : [
        {
          command: "pnpm --filter @notespp/api dev",
          url: "http://localhost:4000/health",
          reuseExistingServer: !process.env.CI,
          timeout: 60_000,
        },
        {
          command: "pnpm --filter @notespp/web dev",
          url: WEB_URL,
          reuseExistingServer: !process.env.CI,
          timeout: 60_000,
        },
      ],
});
