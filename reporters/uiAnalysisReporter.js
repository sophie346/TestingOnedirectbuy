const fs = require("fs/promises");
const path = require("path");
const {
  analyzeUiCaptures,
  formatAnalysisMarkdown,
  DEFAULT_MODEL,
} = require("../lib/openai-ui-analysis");
const {
  writeAnalysisHtmlReport,
  writeAnalysisIndexHtml,
} = require("../lib/ui-analysis-html-report");

require("dotenv").config({ path: path.resolve(process.cwd(), ".env") });

const CAPTURE_ROOT =
  process.env.UI_CAPTURE_DIR || path.join("test-results", "ui-capture");
const ANALYSIS_ROOT =
  process.env.UI_ANALYSIS_DIR || path.join("test-results", "ui-analysis");

/**
 * @param {string} dir
 */
async function listFilesRecursive(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
  /** @type {string[]} */
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listFilesRecursive(fullPath)));
    } else {
      files.push(fullPath);
    }
  }
  return files;
}

/**
 * Group JSON capture metadata by originating test (file + title).
 * @param {string} captureRoot
 */
async function loadCapturesByTestFile(captureRoot) {
  const allFiles = await listFilesRecursive(captureRoot);
  const jsonFiles = allFiles.filter((file) => file.endsWith(".json"));

  /** @type {Map<string, import('../lib/openai-ui-analysis').StepCapture[]>} */
  const grouped = new Map();

  for (const jsonFile of jsonFiles) {
    const raw = await fs.readFile(jsonFile, "utf8");
    const metadata = JSON.parse(raw);
    if (!metadata?.testFile || !metadata?.screenshotPath) continue;

    const screenshotExists = await fs
      .access(metadata.screenshotPath)
      .then(() => true)
      .catch(() => false);
    if (!screenshotExists) continue;

    const groupKey = `${metadata.testFile}::${metadata.testTitle || "unknown"}`;
    const list = grouped.get(groupKey) || [];
    list.push({
      stepIndex: metadata.stepIndex,
      stepName: metadata.stepName,
      url: metadata.url,
      title: metadata.title,
      screenshotPath: metadata.screenshotPath,
      pageData: metadata.pageData || {},
    });
    grouped.set(groupKey, list);
  }

  for (const [groupKey, steps] of grouped) {
    steps.sort((a, b) => a.stepIndex - b.stepIndex);
    grouped.set(groupKey, steps);
  }

  return grouped;
}

class UiAnalysisReporter {
  /** @param {import('@playwright/test/reporter').FullResult} result */
  async onEnd(result) {
    const analysisRoot = path.isAbsolute(ANALYSIS_ROOT)
      ? ANALYSIS_ROOT
      : path.join(process.cwd(), ANALYSIS_ROOT);
    process.env.PW_UI_ANALYSIS_OUTPUT_DIR = analysisRoot;

    const disabled =
      process.env.UI_ANALYSIS === "0" || process.env.UI_ANALYSIS === "false";
    if (disabled) {
      return;
    }

    if (!process.env.OPENAI_API_KEY) {
      console.warn(
        "[uiAnalysisReporter] OPENAI_API_KEY is not set; skipping UI analysis.",
      );
      return;
    }

    console.log(
      `[uiAnalysisReporter] Running UI analysis after ${result.status} run…`,
    );

    const captureRoot = path.isAbsolute(CAPTURE_ROOT)
      ? CAPTURE_ROOT
      : path.join(process.cwd(), CAPTURE_ROOT);

    let grouped;
    try {
      grouped = await loadCapturesByTestFile(captureRoot);
    } catch {
      console.warn("[uiAnalysisReporter] No UI captures found to analyze.");
      return;
    }

    if (!grouped.size) {
      console.warn("[uiAnalysisReporter] No UI captures found to analyze.");
      return;
    }

    await fs.mkdir(analysisRoot, { recursive: true });

    /** @type {Array<Awaited<ReturnType<typeof writeAnalysisHtmlReport>>>} */
    const htmlReports = [];

    for (const [groupKey, steps] of grouped) {
      const testFile = groupKey.split("::")[0];
      const testTitle = groupKey.split("::")[1] || steps[0]?.stepName || "test";
      const relativeFile = path.relative(process.cwd(), testFile);
      const titleSlug = testTitle
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 60);
      const outputBase = path.join(
        analysisRoot,
        relativeFile.replace(/\.spec\.js$/i, ""),
        titleSlug || "test",
      );
      await fs.mkdir(path.dirname(outputBase), { recursive: true });

      try {
        const analysis = await analyzeUiCaptures(steps, {
          testFile: relativeFile,
          testTitle,
        });

        const jsonPath = `${outputBase}.analysis.json`;
        const mdPath = `${outputBase}.analysis.md`;
        const flowPath = `${outputBase}.recommended-flow.json`;
        const htmlPath = `${outputBase}.analysis.html`;

        await fs.writeFile(jsonPath, JSON.stringify(analysis, null, 2), "utf8");
        await fs.writeFile(
          mdPath,
          formatAnalysisMarkdown(analysis, {
            testFile: relativeFile,
          }),
          "utf8",
        );
        await fs.writeFile(
          flowPath,
          JSON.stringify(analysis.recommendedFlow || [], null, 2),
          "utf8",
        );

        const htmlMeta = await writeAnalysisHtmlReport(htmlPath, analysis, {
          testFile: relativeFile,
          testTitle,
          steps,
          model: DEFAULT_MODEL,
          analysisRoot,
        });
        htmlReports.push(htmlMeta);

        console.log(`[uiAnalysisReporter] UI analysis saved for ${relativeFile}`);
        console.log(`  - ${jsonPath}`);
        console.log(`  - ${mdPath}`);
        console.log(`  - ${flowPath}`);
        console.log(`  - ${htmlPath}`);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(
          `[uiAnalysisReporter] Analysis failed for ${relativeFile}:`,
          message,
        );
        const strict =
          process.env.UI_ANALYSIS_STRICT === "1" ||
          process.env.UI_ANALYSIS_STRICT === "true";
        if (strict) {
          throw err;
        }
      }
    }

    if (htmlReports.length) {
      const indexPath = path.join(analysisRoot, "index.html");
      await writeAnalysisIndexHtml(indexPath, htmlReports);
      console.log(`[uiAnalysisReporter] HTML index saved: ${indexPath}`);
    } else {
      console.warn(
        "[uiAnalysisReporter] No HTML reports generated (analysis errors or no captures).",
      );
    }
  }
}

module.exports = UiAnalysisReporter;
