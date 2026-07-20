const fs = require("fs/promises");
const path = require("path");
const {
  uploadMultipartFile,
  isReportUploadEnabled,
} = require("../lib/upload-report");

/** Wait until a file exists (reporter onEnd order can vary). */
async function waitForFileReady(filePath, maxMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    try {
      await fs.access(filePath);
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 200));
    }
  }
  throw new Error(`Timeout waiting for file at ${filePath}`);
}

/**
 * Runs after the HTML report and UI analysis are written. POSTs each `index.html`
 * (multipart field `htmlFile`) to REPORT_UPLOAD_URL.
 *
 * Upload runs on pass or fail as long as REPORT_UPLOAD is enabled.
 *
 * Env:
 * - PW_REPORT_OUTPUT_DIR — Playwright HTML report folder (set by playwright.config.js)
 * - PW_UI_ANALYSIS_OUTPUT_DIR — UI analysis folder with index.html (set by config / uiAnalysisReporter)
 * - REPORT_UPLOAD=1 — enable upload when REPORT_UPLOAD_AUTH_TOKEN is set (off by default locally)
 * - REPORT_UPLOAD=0|false — skip upload
 * - REPORT_UPLOAD_URL — override endpoint (default dev.onechanneladmin.com upload API)
 * - REPORT_UPLOAD_FIELD_NAME — multipart file field (default htmlFile)
 * - REPORT_UPLOAD_NAME — Playwright report display name
 * - REPORT_UPLOAD_UI_ANALYSIS_NAME — UI analysis report display name
 * - REPORT_UPLOAD_AUTH_TOKEN — Bearer JWT (required when upload is enabled)
 * - REPORT_UPLOAD_STRICT=1 — rethrow upload errors (fail the run)
 */
class UploadReporter {
  /**
   * @param {{ uploadUrl?: string; fieldName?: string }} [options]
   */
  constructor(options) {
    this.options = options || {};
  }

  /**
   * @param {{
   *   filePath: string;
   *   name: string;
   *   description?: string;
   *   optional?: boolean;
   * }} item
   */
  async uploadHtmlIndex(item) {
    const strict =
      process.env.REPORT_UPLOAD_STRICT === "1" ||
      process.env.REPORT_UPLOAD_STRICT === "true";

    try {
      await waitForFileReady(item.filePath);
      await uploadMultipartFile(item.filePath, {
        url: this.options.uploadUrl || process.env.REPORT_UPLOAD_URL,
        fieldName: this.options.fieldName || process.env.REPORT_UPLOAD_FIELD_NAME,
        name: item.name,
        description: item.description || "",
        filename: "index.html",
        mimeType: "text/html",
      });
      console.log(`[uploadReporter] Uploaded: ${item.name} (${item.filePath})`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (item.optional) {
        console.warn(
          `[uploadReporter] Skipped optional upload (${item.name}):`,
          message,
        );
        return;
      }
      console.error(`[uploadReporter] Upload failed (${item.name}):`, message);
      if (strict) {
        throw err;
      }
    }
  }

  /** @param {import('@playwright/test/reporter').FullResult} result */
  async onEnd(result) {
    const reportDir = process.env.PW_REPORT_OUTPUT_DIR;
    if (reportDir) {
      const absolute = path.isAbsolute(reportDir)
        ? reportDir
        : path.join(process.cwd(), reportDir);
      console.log(`[playwright] HTML report saved: ${absolute}`);
      console.log(
        `[playwright] Open report: npx playwright show-report "${absolute}"`,
      );
    }

    const uiAnalysisDir =
      process.env.PW_UI_ANALYSIS_OUTPUT_DIR || process.env.UI_ANALYSIS_DIR;
    if (uiAnalysisDir) {
      const absolute = path.isAbsolute(uiAnalysisDir)
        ? uiAnalysisDir
        : path.join(process.cwd(), uiAnalysisDir);
      console.log(`[uiAnalysisReporter] HTML analysis folder: ${absolute}`);
    }

    if (!isReportUploadEnabled()) {
      return;
    }

    const uploadUrl = this.options.uploadUrl || process.env.REPORT_UPLOAD_URL;
    const statusLabel = result.status === "passed" ? "passed" : "failed/interrupted";
    const runDescription = `Playwright run ${statusLabel} at ${new Date().toISOString()}`;

    /** @type {Array<{ filePath: string; name: string; description: string; optional?: boolean }>} */
    const queue = [];

    if (reportDir) {
      const absolute = path.isAbsolute(reportDir)
        ? reportDir
        : path.join(process.cwd(), reportDir);
      queue.push({
        filePath: path.join(absolute, "index.html"),
        name:
          process.env.REPORT_UPLOAD_NAME || "Playwright HTML Report",
        description:
          process.env.REPORT_UPLOAD_DESCRIPTION || runDescription,
        optional: false,
      });
    } else {
      console.warn(
        "[uploadReporter] PW_REPORT_OUTPUT_DIR is not set; skipping Playwright report upload.",
      );
    }

    if (uiAnalysisDir) {
      const absolute = path.isAbsolute(uiAnalysisDir)
        ? uiAnalysisDir
        : path.join(process.cwd(), uiAnalysisDir);
      queue.push({
        filePath: path.join(absolute, "index.html"),
        name:
          process.env.REPORT_UPLOAD_UI_ANALYSIS_NAME ||
          "UI Analysis HTML Report",
        description:
          process.env.REPORT_UPLOAD_UI_ANALYSIS_DESCRIPTION || runDescription,
        optional: true,
      });
    }

    if (!queue.length) {
      console.warn("[uploadReporter] No report paths configured; skipping upload.");
      return;
    }

    console.log(
      `[uploadReporter] Uploading ${queue.length} HTML report(s) to ${uploadUrl || "default endpoint"}…`,
    );

    for (const item of queue) {
      await this.uploadHtmlIndex(item);
    }
  }
}

module.exports = UploadReporter;
