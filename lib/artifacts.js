/**
 * Artifact path helpers for screenshots, videos, and traces.
 */

const fs = require("fs");
const path = require("path");
const { PATHS } = require("./constants");
const { createLogger } = require("./logger");

const log = createLogger("artifacts");

/**
 * Ensure standard artifact directories exist.
 */
function ensureArtifactDirs() {
  for (const dir of [
    PATHS.testResults,
    PATHS.screenshots,
    PATHS.videos,
    PATHS.traces,
    PATHS.playwrightReport,
  ]) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * Collect attachment paths from a Playwright test result / JSON suite node.
 * @param {Array<{ name?: string; path?: string; contentType?: string }>|undefined} attachments
 */
function classifyAttachments(attachments = []) {
  /** @type {{ screenshotPath: string; videoPath: string; tracePath: string }} */
  const out = { screenshotPath: "", videoPath: "", tracePath: "" };
  for (const attachment of attachments) {
    const name = String(attachment.name || "").toLowerCase();
    const filePath = attachment.path || "";
    if (!filePath) continue;
    if (name.includes("screenshot") || name === "screenshot") {
      out.screenshotPath = out.screenshotPath || filePath;
    } else if (name.includes("video") || name === "video") {
      out.videoPath = out.videoPath || filePath;
    } else if (name.includes("trace") || name === "trace") {
      out.tracePath = out.tracePath || filePath;
    }
  }
  return out;
}

/**
 * Walk test-results for common artifact extensions (fallback when JSON lacks paths).
 * @param {string} [root]
 */
function listArtifactsByType(root = PATHS.testResults) {
  /** @type {{ screenshots: string[]; videos: string[]; traces: string[] }} */
  const found = { screenshots: [], videos: [], traces: [] };
  if (!fs.existsSync(root)) return found;

  /**
   * @param {string} dir
   */
  function walk(dir) {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
        continue;
      }
      const lower = entry.name.toLowerCase();
      if (lower.endsWith(".png") || lower.endsWith(".jpg") || lower.endsWith(".jpeg")) {
        found.screenshots.push(full);
      } else if (lower.endsWith(".webm") || lower.endsWith(".mp4")) {
        found.videos.push(full);
      } else if (lower.endsWith(".zip") && lower.includes("trace")) {
        found.traces.push(full);
      } else if (lower === "trace.zip") {
        found.traces.push(full);
      }
    }
  }

  walk(root);
  log.debug("Listed artifacts", {
    screenshots: found.screenshots.length,
    videos: found.videos.length,
    traces: found.traces.length,
  });
  return found;
}

module.exports = {
  ensureArtifactDirs,
  classifyAttachments,
  listArtifactsByType,
};
