const fs = require("fs/promises");
const path = require("path");
const {
  writeAnalysisHtmlReport,
  writeAnalysisIndexHtml,
} = require("../lib/ui-analysis-html-report");

const ANALYSIS_ROOT =
  process.env.UI_ANALYSIS_DIR || path.join("test-results", "ui-analysis");
const CAPTURE_ROOT =
  process.env.UI_CAPTURE_DIR || path.join("test-results", "ui-capture");

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
 * @param {string} captureRoot
 */
async function loadCapturesByTestFile(captureRoot) {
  const allFiles = await listFilesRecursive(captureRoot);
  const jsonFiles = allFiles.filter((file) => file.endsWith(".json"));
  /** @type {Map<string, Array<Record<string, unknown>>>} */
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

    const list = grouped.get(metadata.testFile) || [];
    list.push(metadata);
    grouped.set(metadata.testFile, list);
  }

  for (const [testFile, steps] of grouped) {
    steps.sort((a, b) => a.stepIndex - b.stepIndex);
    grouped.set(testFile, steps);
  }

  return grouped;
}

async function main() {
  const cwd = process.cwd();
  const analysisRoot = path.isAbsolute(ANALYSIS_ROOT)
    ? ANALYSIS_ROOT
    : path.join(cwd, ANALYSIS_ROOT);
  const captureRoot = path.isAbsolute(CAPTURE_ROOT)
    ? CAPTURE_ROOT
    : path.join(cwd, CAPTURE_ROOT);

  const analysisFiles = (await listFilesRecursive(analysisRoot)).filter((file) =>
    file.endsWith(".analysis.json"),
  );

  if (!analysisFiles.length) {
    console.error("No .analysis.json files found under", analysisRoot);
    process.exit(1);
  }

  const capturesByFile = await loadCapturesByTestFile(captureRoot);
  /** @type {Array<Awaited<ReturnType<typeof writeAnalysisHtmlReport>>>} */
  const htmlReports = [];

  for (const analysisFile of analysisFiles) {
    const analysis = JSON.parse(await fs.readFile(analysisFile, "utf8"));
    const htmlPath = analysisFile.replace(/\.analysis\.json$/i, ".analysis.html");
    const relativeFromAnalysis = path.relative(analysisRoot, analysisFile);
    const testFileGuess = relativeFromAnalysis.replace(/\.analysis\.json$/i, ".spec.js");
    const testFile = path.join("tests", testFileGuess).replace(/\\/g, "/");

    let steps = [];
    for (const [captureTestFile, captureSteps] of capturesByFile) {
      const rel = path.relative(cwd, captureTestFile).replace(/\\/g, "/");
      if (rel.endsWith(testFileGuess) || rel.includes(path.basename(testFileGuess, ".spec.js"))) {
        steps = captureSteps.map((step) => ({
          stepIndex: step.stepIndex,
          stepName: step.stepName,
          url: step.url,
          title: step.title,
          screenshotPath: step.screenshotPath,
          pageData: step.pageData || {},
        }));
        break;
      }
    }

    if (!steps.length) {
      for (const [, captureSteps] of capturesByFile) {
        const relTest = path
          .relative(cwd, captureSteps[0]?.testFile || "")
          .replace(/\\/g, "/");
        if (relTest.includes(path.basename(testFileGuess, ".spec.js"))) {
          steps = captureSteps.map((step) => ({
            stepIndex: step.stepIndex,
            stepName: step.stepName,
            url: step.url,
            title: step.title,
            screenshotPath: step.screenshotPath,
            pageData: step.pageData || {},
          }));
          break;
        }
      }
    }

    const htmlMeta = await writeAnalysisHtmlReport(htmlPath, analysis, {
      testFile: steps[0]?.testFile
        ? path.relative(cwd, steps[0].testFile).replace(/\\/g, "/")
        : testFile,
      testTitle: steps[0]?.stepName,
      steps,
      analysisRoot,
    });
    htmlReports.push(htmlMeta);
    console.log("Generated:", htmlPath);
  }

  const indexPath = path.join(analysisRoot, "index.html");
  await writeAnalysisIndexHtml(indexPath, htmlReports);
  console.log("Generated:", indexPath);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
