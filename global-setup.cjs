/**
 * Playwright global setup — load env, ensure artifact dirs, optional cleanup.
 */
const { loadEnv, getBool, getTestEnvironment } = require("./lib/env");
const { ensureArtifactDirs } = require("./lib/artifacts");
const { cleanupArtifacts } = require("./lib/cleanup");
const { createLogger } = require("./lib/logger");

const log = createLogger("global-setup");

module.exports = async () => {
  loadEnv();
  ensureArtifactDirs();

  const envName = getTestEnvironment();
  log.info(`Starting Playwright run (environment=${envName})`);

  // Automatic cleanup of stale local artifacts (opt-out with CLEANUP_ON_START=0)
  if (getBool("CLEANUP_ON_START", !getBool("CI", false))) {
    const result = cleanupArtifacts();
    if (result.total > 0) {
      log.info(`Cleaned ${result.total} stale artifact(s) before run`);
    }
  }
};
