import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "@playwright/test";

// locally, keep browsers inside the project folder; on CI use the default install location
if (existsSync(resolve(".tools/pw"))) process.env.PLAYWRIGHT_BROWSERS_PATH = resolve(".tools/pw");

const PORT = process.env.TEST_PORT ?? "3107";

export default defineConfig({
  testDir: "tests",
  testMatch: /.*\.spec\.ts/,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: { baseURL: process.env.BASE_URL ?? `http://localhost:${PORT}`, trace: "retain-on-failure", screenshot: "only-on-failure" },
  webServer: process.env.NO_SERVER ? undefined : { command: `npx next start -p ${PORT}`, url: `http://localhost:${PORT}`, reuseExistingServer: true, timeout: 120_000 },
});
