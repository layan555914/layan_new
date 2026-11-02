import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "**/*.spec.mjs",
  fullyParallel: false,
  retries: 0,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:4173",
    headless: true,
    viewport: { width: 1365, height: 900 },
    trace: "retain-on-failure"
  },
  webServer: {
    command: "node tests/e2e/server.mjs",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: !process.env.CI,
    timeout: 30_000
  }
});
