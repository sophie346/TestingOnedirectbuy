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
/** CI fast mode: shorter timeouts, no video, lean reporters (default on when CI=1). */
const ciFast =
  process.env.CI_FAST === "1" ||
  process.env.CI_FAST === "true" ||
  (ci && process.env.CI_FAST !== "0" && process.env.CI_FAST !== "false");
const testEnv = (
  process.env.TEST_ENV || (ci ? "ci" : "local")
).toLowerCase();

/**
 * Unique report folder per run: playwright-report/YYYY-MM-DD_HH-mm-ss
 * Override via PW_REPORT_OUTPUT_DIR / PW_JSON_REPORT_PATH / PW_JUNIT_REPORT_PATH
 * (used by scripts/run-ci-tests.js to write straight into reports/).
 */
const reportTimestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const reportOutputDir =
  process.env.PW_REPORT_OUTPUT_DIR ||
  path.join("playwright-report", reportTimestamp);
const uiAnalysisOutputDir = path.join(
  "test-results",
  "ui-analysis",
  reportTimestamp,
);
const jsonReportPath =
  process.env.PW_JSON_REPORT_PATH || path.join("test-results", "results.json");
const junitReportPath =
  process.env.PW_JUNIT_REPORT_PATH || path.join("test-results", "junit.xml");

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
 * Configurable workers via PW_WORKERS.
 * Local default 1 (serial-safe). CI fast default 4.
 */
const workers =
  process.env.PW_WORKERS !== undefined && process.env.PW_WORKERS !== ""
    ? Number(process.env.PW_WORKERS) || 1
    : ciFast
      ? 4
      : 1;

const retries =
  process.env.PW_RETRIES !== undefined
    ? Number(process.env.PW_RETRIES) || 0
    : ciFast
      ? 1
      : ci
        ? 2
        : 0;

console.log(
  `[config] env=${testEnv} ci=${ci} fast=${ciFast} headless=${useHeadless} workers=${workers} retries=${retries} browser=chromium`,
);

/**
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  globalSetup: "./global-setup.cjs",
  testDir: "./tests",
  outputDir: "test-results",
  /* Fail fast on CI so hung tests don't burn the whole job. */
  timeout: ciFast ? 90_000 : 300_000,
  expect: {
    timeout: ciFast ? 8_000 : 10_000,
  },
  /* Parallelize independent tests on CI (serial describes stay serial). */
  fullyParallel: ciFast,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!ci,
  /* Retry on CI only (override with PW_RETRIES) */
  retries,
  /* One browser at a time locally (override with PW_WORKERS=4). */
  workers,
  /* Lean reporters on CI for faster teardown / smaller artifacts. */
  reporter: [
    [ciFast ? "line" : "list"],
    ["html", { outputFolder: reportOutputDir, open: "never" }],
    ["json", { outputFile: jsonReportPath }],
    ...(ciFast
      ? []
      : [
          ["junit", { outputFile: junitReportPath }],
          ["./reporters/devIssuesReporter.js"],
        ]),
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

    actionTimeout: ciFast ? 10_000 : 15_000,
    navigationTimeout: ciFast ? 20_000 : 30_000,

    /* Screenshot on failure for Playwright HTML report + debugging */
    screenshot: "only-on-failure",

    /* Video is expensive I/O — off in fast CI; local keeps on-failure. */
    video: ciFast ? "off" : "retain-on-failure",

    /* Trace only when a retry happens (saves time on green runs). */
    trace: ciFast ? "on-first-retry" : "retain-on-failure",

    ignoreHTTPSErrors: process.env.IGNORE_HTTPS_ERRORS === "1",

    ...(ci
      ? {
          launchOptions: {
            args: ["--disable-dev-shm-usage", "--no-sandbox"],
          },
        }
      : {}),
  },

  /* Chromium only — never Firefox/WebKit. CI uses bundled Chromium (not system Chrome). */
  projects: [
    {
      name: "chromium",
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
