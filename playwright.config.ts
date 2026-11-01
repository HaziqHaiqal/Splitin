import { execSync } from "node:child_process";
import { defineConfig } from "@playwright/test";

function localDatabase() {
  try {
    return JSON.parse(execSync("supabase status -o json", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }));
  } catch {
    throw new Error("The local database isn't running. Open OrbStack or Docker, then run: supabase start");
  }
}

const local = localDatabase();
process.env.TEST_SUPABASE_URL = local.API_URL;
process.env.TEST_SERVICE_KEY = local.SECRET_KEY;
process.env.TEST_ANON_KEY = local.PUBLISHABLE_KEY;

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
  webServer: {
    command: "next dev -p 3457",
    url: "http://localhost:3457/manifest.webmanifest",
    timeout: 120_000,
    env: {
      NEXT_PUBLIC_SUPABASE_URL: local.API_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: local.PUBLISHABLE_KEY,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: local.PUBLISHABLE_KEY,
      SUPABASE_SERVICE_ROLE_KEY: local.SECRET_KEY,
      BILL_SIGNING_SECRET: "test",
    },
  },
});
