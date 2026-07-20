/**
 * Shared path and timing constants for the Playwright framework.
 * Prefer importing these over scattering magic numbers.
 */

const path = require("path");

const ROOT_DIR = process.cwd();

const PATHS = {
  root: ROOT_DIR,
  testResults: path.join(ROOT_DIR, "test-results"),
  playwrightReport: path.join(ROOT_DIR, "playwright-report"),
  jsonReport: path.join(ROOT_DIR, "test-results", "results.json"),
  junitReport: path.join(ROOT_DIR, "test-results", "junit.xml"),
  blobReport: path.join(ROOT_DIR, "blob-report"),
  authDir: path.join(ROOT_DIR, "playwright", ".auth"),
  uiCapture: path.join(ROOT_DIR, "test-results", "ui-capture"),
  uiAnalysis: path.join(ROOT_DIR, "test-results", "ui-analysis"),
  screenshots: path.join(ROOT_DIR, "test-results", "screenshots"),
  videos: path.join(ROOT_DIR, "test-results", "videos"),
  traces: path.join(ROOT_DIR, "test-results", "traces"),
};

/** Default timeouts (ms). Individual tests may still override. */
const TIMEOUTS = {
  test: 300_000,
  expect: 10_000,
  action: 15_000,
  navigation: 30_000,
};

/** Artifact retention for local cleanup utilities (days). */
const CLEANUP = {
  reportRetentionDays: Number(process.env.REPORT_RETENTION_DAYS || 14),
  resultsRetentionDays: Number(process.env.RESULTS_RETENTION_DAYS || 7),
};

const ENVIRONMENTS = {
  local: "local",
  ci: "ci",
  staging: "staging",
  production: "production",
};

module.exports = {
  PATHS,
  TIMEOUTS,
  CLEANUP,
  ENVIRONMENTS,
};
