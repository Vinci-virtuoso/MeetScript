import { defineConfig, devices } from "@playwright/test";

// Runs against the production build served by wrangler dev (workerd), not astro dev, so the
// pipeline, bindings and headers under test are the deployed ones. `npm run verify` builds and
// migrates before this starts; the webServer command only serves.
const baseURL = "http://127.0.0.1:8787";

export default defineConfig({
  testDir: "tests/e2e",
  testMatch: "**/*.spec.{js,ts}",
  fullyParallel: true,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run preview",
    url: `${baseURL}/api/health`,
    reuseExistingServer: false,
    timeout: 120000,
  },
});
