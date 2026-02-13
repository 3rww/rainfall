import { defineConfig, devices } from "@playwright/test";

const PORT = 4173;
const BASE_URL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  expect: {
    timeout: 10_000
  },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry"
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] }
    }
  ],
  webServer: {
    command: `npx vite --host 127.0.0.1 --port ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    stdout: "pipe",
    stderr: "pipe",
    env: {
      ...process.env,
      VITE_E2E_TEST: "true",
      VITE_ENABLE_SHARE_STATE: "false",
      VITE_MAPBOX_TOKEN: process.env.VITE_MAPBOX_TOKEN || "test-token",
      VITE_MAPBOX_STYLE_BASEMAP: "http://mock.api/style.json",
      VITE_API_URL_ROOT: "http://mock.api/"
    }
  }
});
