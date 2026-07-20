/**
 * Automatic cleanup of old Playwright reports and test-results.
 */

const fs = require("fs");
const path = require("path");
const { PATHS, CLEANUP } = require("./constants");
const { createLogger } = require("./logger");

const log = createLogger("cleanup");

/**
 * @param {string} targetPath
 * @returns {number} mtime ms
 */
function mtimeMs(targetPath) {
  try {
    return fs.statSync(targetPath).mtimeMs;
  } catch {
    return 0;
  }
}

/**
 * Remove files/dirs under `root` older than `retentionDays`.
 * Only deletes immediate children of timestamped report folders / loose files.
 * @param {string} root
 * @param {number} retentionDays
 * @param {{ dryRun?: boolean }} [options]
 * @returns {string[]} deleted paths
 */
function cleanupOlderThan(root, retentionDays, options = {}) {
  const deleted = [];
  if (!fs.existsSync(root)) return deleted;

  const maxAgeMs = retentionDays * 24 * 60 * 60 * 1000;
  const now = Date.now();
  const entries = fs.readdirSync(root, { withFileTypes: true });

  for (const entry of entries) {
    const full = path.join(root, entry.name);
    // Keep stable report filenames used by CI (results.json / junit.xml)
    if (
      entry.name === "results.json" ||
      entry.name === "junit.xml" ||
      entry.name === ".last-run.json"
    ) {
      continue;
    }
    const age = now - mtimeMs(full);
    if (age <= maxAgeMs) continue;

    if (options.dryRun) {
      log.info(`Would delete (dry-run): ${full}`);
      deleted.push(full);
      continue;
    }

    try {
      fs.rmSync(full, { recursive: true, force: true });
      deleted.push(full);
      log.info(`Deleted stale artifact: ${full}`);
    } catch (err) {
      log.warn(
        `Failed to delete ${full}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  return deleted;
}

/**
 * Clean timestamped HTML reports and old test-results (keeps latest JSON/JUnit).
 * @param {{ dryRun?: boolean; reportDays?: number; resultsDays?: number }} [options]
 */
function cleanupArtifacts(options = {}) {
  const reportDays = options.reportDays ?? CLEANUP.reportRetentionDays;
  const resultsDays = options.resultsDays ?? CLEANUP.resultsRetentionDays;

  const reportDeleted = cleanupOlderThan(
    PATHS.playwrightReport,
    reportDays,
    options,
  );
  const resultsDeleted = cleanupOlderThan(
    PATHS.testResults,
    resultsDays,
    options,
  );

  return {
    reportDeleted,
    resultsDeleted,
    total: reportDeleted.length + resultsDeleted.length,
  };
}

module.exports = {
  cleanupOlderThan,
  cleanupArtifacts,
};
