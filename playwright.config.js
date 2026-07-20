// @ts-check
import path from "path";
import { config as loadDotenv } from "dotenv";
import { defineConfig, devices } from "@playwright/test";

/**
 * Environment variables are loaded from `.env` here and again in global-setup.cjs.
 * Shared helpers live under lib/ (env, logger, constants, cleanup).
 * See `.env.example`.
 */
loadDotenv({ path: path.resolve(process.cwd(), ".env") });

// Generic aliases → product-specific vars (same mapping as lib/env.js)
if (process.env.BASE_URL && !process.env.PLAYWRIGHT_BASE_URL) {
  process.env.PLAYWRIGHT_BASE_URL = process.env.BASE_URL;
}
if (process.env.USERNAME && !process.env.TEST_LOGIN_EMAIL) {
  process.env.TEST_LOGIN_EMAIL = process.env.USERNAME;
}
if (process.env.PASSWORD && !process.env.TEST_LOGIN_PASSWORD) {
  process.env.TEST_LOGIN_PASSWORD = process.env.PASSWORD;
}
if (process.env.API_TOKEN && !process.env.REPORT_UPLOAD_AUTH_TOKEN) {
  process.env.REPORT_UPLOAD_AUTH_TOKEN = process.env.API_TOKEN;
}
if (process.env.API_URL && !process.env.REPORT_API_URL) {
  process.env.REPORT_API_URL = process.env.API_URL;
}

const ci = Boolean(process.env.CI);
const testEnv = (
  process.env.TEST_ENV || (ci ? "ci" : "local")
).toLowerCase();

/**
 * Unique report folder per run: playwright-report/YYYY-MM-DD_HH-mm-ss
 * So each run (single file or full suite) gets its own report and nothing is overwritten.
 */
const reportTimestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const reportOutputDir = path.join("playwright-report", reportTimestamp);
const uiAnalysisOutputDir = path.join(
  "test-results",
  "ui-analysis",
  reportTimestamp,
);
const jsonReportPath = path.join("test-results", "results.json");
const junitReportPath = path.join("test-results", "junit.xml");

/** Used by reporters/uploadReporter.js to zip and upload the HTML report after the run. */
process.env.PW_REPORT_OUTPUT_DIR = reportOutputDir;
/** Timestamped per run so UI analysis HTML is kept even when tests fail. */
process.env.UI_ANALYSIS_DIR = uiAnalysisOutputDir;
process.env.PW_UI_ANALYSIS_OUTPUT_DIR = uiAnalysisOutputDir;
process.env.PW_JSON_REPORT_PATH = jsonReportPath;
process.env.PW_JUNIT_REPORT_PATH = junitReportPath;

/**
 * Local runs default to headed browsers so you can watch tests.
 * - PW_HEADED=1 / HEADLESS=false → headed
 * - PW_HEADLESS=1 / HEADLESS=true → headless
 * - CI always runs headless unless PW_HEADED=1
 */
const headedFlag =
  process.env.PW_HEADED === "1" || process.env.PW_HEADED === "true";
const headlessFlag =
  process.env.PW_HEADLESS === "1" ||
  process.env.PW_HEADLESS === "true" ||
  process.env.HEADLESS === "1" ||
  process.env.HEADLESS === "true";
const useHeadless = headedFlag ? false : headlessFlag ? true : ci;

/**
 * Configurable workers via PW_WORKERS. Default 1 (serial-safe for shared apps).
 */
const workers =
  process.env.PW_WORKERS !== undefined && process.env.PW_WORKERS !== ""
    ? Number(process.env.PW_WORKERS) || 1
    : 1;

const retries =
  process.env.PW_RETRIES !== undefined
    ? Number(process.env.PW_RETRIES) || 0
    : ci
      ? 2
      : 0;

console.log(
  `[config] env=${testEnv} ci=${ci} headless=${useHeadless} workers=${workers} retries=${retries}`,
);

/**
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  globalSetup: "./global-setup.cjs",
  testDir: "./tests",
  outputDir: "test-results",
  /* Maximum time one test can run for. */
  timeout: 300000, // 5 minutes (long test with many steps)
  expect: {
    timeout: 10_000,
  },
  /* Run tests in files in parallel */
  fullyParallel: false,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!ci,
  /* Retry on CI only (override with PW_RETRIES) */
  retries,
  /* One browser at a time locally (override with PW_WORKERS=4). */
  workers,
  /* Reporter: list + HTML + JSON + JUnit + optional custom reporters */
  reporter: [
    ["list"],
    ["html", { outputFolder: reportOutputDir, open: "never" }],
    ["json", { outputFile: jsonReportPath }],
    ["junit", { outputFile: junitReportPath }],
    ["./reporters/devIssuesReporter.js"],
    // OpenAI UI analysis — opt-in via UI_ANALYSIS=1
    ...(process.env.UI_ANALYSIS === "1" || process.env.UI_ANALYSIS === "true"
      ? [["./reporters/uiAnalysisReporter.js"]]
      : []),
    // HTML API upload — opt-in via REPORT_UPLOAD=1
    ...(process.env.REPORT_UPLOAD === "1" || process.env.REPORT_UPLOAD === "true"
      ? [["./reporters/uploadReporter.js"]]
      : []),
  ],
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL when tests use relative goto(); product helpers still use their own URLs. */
    baseURL:
      process.env.BASE_URL ||
      process.env.ONEDIRECTBUY_BASE_URL ||
      process.env.PLAYWRIGHT_BASE_URL ||
      undefined,

    headless: useHeadless,

    actionTimeout: 15_000,
    navigationTimeout: 30_000,

    /* Screenshot on failure for Playwright HTML report + debugging */
    screenshot: "only-on-failure",

    /* Video on failure */
    video: "retain-on-failure",

    /* Trace on failure */
    trace: "retain-on-failure",

    ignoreHTTPSErrors: process.env.IGNORE_HTTPS_ERRORS === "1",
  },

  /* OneDirectBuy only. CI uses Playwright Chromium; local keeps Google Chrome when available. */
  projects: [
    {
      name: "onedirectbuy",
      testDir: "./tests/OneDirectBuy",
      use: {
        ...devices["Desktop Chrome"],
        ...(ci || process.env.PW_USE_CHROME === "0"
          ? {}
          : { channel: "chrome" }),
      },
    },
  ],
});
