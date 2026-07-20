/**
 * CLI: clean old playwright-report / test-results artifacts.
 * Usage: node scripts/cleanup-artifacts.js [--dry-run]
 */
const { loadEnv, getBool } = require("../lib/env");
const { cleanupArtifacts } = require("../lib/cleanup");
const { createLogger } = require("../lib/logger");

loadEnv();
const log = createLogger("cleanup-cli");
const dryRun = process.argv.includes("--dry-run") || getBool("CLEANUP_DRY_RUN", false);

const result = cleanupArtifacts({ dryRun });
log.info(
  dryRun
    ? `Dry-run complete: ${result.total} path(s) would be removed`
    : `Cleanup complete: ${result.total} path(s) removed`,
);
