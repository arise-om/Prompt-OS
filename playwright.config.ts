import { defineConfig } from "@playwright/test";

const baseURL = process.env.PROMPT_OS_BASE_URL?.trim();

if (!baseURL) {
  throw new Error("PROMPT_OS_BASE_URL is required for Playwright E2E tests");
}

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 5 * 60 * 1000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  reporter: process.env.CI ? "line" : "list",
  use: {
    baseURL,
    trace: "retain-on-failure",
    video: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { browserName: "chromium" },
    },
  ],
});
