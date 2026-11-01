import { defineConfig } from "@playwright/test";

const stub = "http://localhost:54399";

export default defineConfig({
  testDir: "./tests",
  outputDir: "./test-results",
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: "http://localhost:3457",
    channel: "chrome",
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    locale: "en-US",
  },
  webServer: [
    { command: "node tests/stub.mjs", port: 54399 },
    {
      command: "next dev -p 3457",
      url: "http://localhost:3457/manifest.webmanifest",
      timeout: 120_000,
      env: {
        NEXT_PUBLIC_SUPABASE_URL: stub,
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "stub",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "stub",
        SUPABASE_SERVICE_ROLE_KEY: "stub",
        BILL_SIGNING_SECRET: "stub",
      },
    },
  ],
});
