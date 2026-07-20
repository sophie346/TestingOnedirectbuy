/**
 * Run Playwright tests selected by ci-tests.config.json and collect reports under reports/.
 *
 * Usage:
 *   node scripts/run-ci-tests.js [suite]
 *   CI_TEST_SUITE=smoke node scripts/run-ci-tests.js
 *
 * Suites (see ci-tests.config.json → suites):
 *   smoke      — files listed in suites.smoke
 *   regression — tests with enabled: true (default on push)
 *   all        — every file in tests[]
 */
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const CONFIG_PATH = path.join(
  ROOT,
  process.env.CI_TESTS_CONFIG || "ci-tests.config.json",
);

function loadConfig() {
  if (!fs.existsSync(CONFIG_PATH)) {
    console.error(`Config not found: ${CONFIG_PATH}`);
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
}

function matchesSmokeEntry(file, entry) {
  const normalized = entry.replace(/\\/g, "/");
  return (
    file === normalized ||
    file.endsWith(`/${normalized}`) ||
    path.basename(file) === normalized
  );
}

function resolveTestFiles(config, suite) {
  const tests = config.tests || [];
  const suiteKey = (
    suite ||
    process.env.CI_TEST_SUITE ||
    "regression"
  ).toLowerCase();

  if (suiteKey === "all") {
    return tests.map((t) => t.file);
  }

  if (suiteKey === "smoke") {
    const smokeEntries = config.suites?.smoke;
    if (!Array.isArray(smokeEntries) || smokeEntries.length === 0) {
      console.error('Suite "smoke" requires suites.smoke in ci-tests.config.json');
      process.exit(1);
    }
    return tests
      .filter((t) => smokeEntries.some((entry) => matchesSmokeEntry(t.file, entry)))
      .map((t) => t.file);
  }

  // regression (default): honour enabled flag
  return tests.filter((t) => t.enabled !== false).map((t) => t.file);
}

function writeSummary(runDir, runId, { suite, testFiles, exitCode, configPath }) {
  let parsedResults = null;
  const resultsPath = path.join(runDir, "results.json");
  if (fs.existsSync(resultsPath)) {
    try {
      parsedResults = JSON.parse(fs.readFileSync(resultsPath, "utf8"));
    } catch {
      parsedResults = null;
    }
  }

  const htmlExists = fs.existsSync(path.join(runDir, "html", "index.html"));
  const summary = {
    runId,
    suite,
    timestamp: new Date().toISOString(),
    exitCode,
    browser: "chromium",
    config: path.relative(ROOT, configPath).replace(/\\/g, "/"),
    testFiles,
    reports: {
      directory: path.relative(ROOT, runDir).replace(/\\/g, "/"),
      html: htmlExists ? "html/index.html" : null,
      resultsJson: fs.existsSync(resultsPath) ? "results.json" : null,
    },
    stats: parsedResults?.stats ?? null,
  };

  fs.writeFileSync(
    path.join(runDir, "summary.json"),
    `${JSON.stringify(summary, null, 2)}\n`,
    "utf8",
  );

  fs.writeFileSync(
    path.join(ROOT, "reports", "latest.json"),
    `${JSON.stringify(
      {
        runId,
        path: `reports/${runId}`,
        timestamp: summary.timestamp,
        suite,
        exitCode,
        browser: "chromium",
      },
      null,
      2,
    )}\n`,
    "utf8",
  );

  console.log(`\nReports collected in reports/${runId}/`);
  if (summary.reports.html) {
    console.log(`  HTML:  reports/${runId}/html/index.html`);
  }
  if (summary.reports.resultsJson) {
    console.log(`  JSON:  reports/${runId}/results.json`);
  }
  console.log(`  Summary: reports/${runId}/summary.json`);
}

function main() {
  const suite = process.argv[2] || process.env.CI_TEST_SUITE || "regression";
  const config = loadConfig();
  const testFiles = resolveTestFiles(config, suite);

  if (testFiles.length === 0) {
    console.error(
      `No tests selected for suite "${suite}". Edit ${path.relative(ROOT, CONFIG_PATH)}.`,
    );
    process.exit(1);
  }

  console.log(`Suite: ${suite}`);
  console.log(`Browser: chromium`);
  console.log(`Running ${testFiles.length} test file(s):`);
  for (const file of testFiles) {
    console.log(`  - ${file}`);
  }

  const workers =
    process.env.PW_WORKERS !== undefined && process.env.PW_WORKERS !== ""
      ? process.env.PW_WORKERS
      : String(config.workers ?? 4);
  const retries =
    process.env.PW_RETRIES !== undefined && process.env.PW_RETRIES !== ""
      ? process.env.PW_RETRIES
      : config.retries !== undefined
        ? String(config.retries)
        : undefined;

  const runId = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const runDir = path.join(ROOT, "reports", runId);
  fs.mkdirSync(path.join(runDir, "html"), { recursive: true });

  // Write reports directly into reports/<runId>/ — no post-run copy.
  const env = {
    ...process.env,
    PW_WORKERS: workers,
    ...(retries !== undefined ? { PW_RETRIES: retries } : {}),
    PW_REPORT_OUTPUT_DIR: path.join("reports", runId, "html"),
    PW_JSON_REPORT_PATH: path.join("reports", runId, "results.json"),
    PW_JUNIT_REPORT_PATH: path.join("reports", runId, "junit.xml"),
  };

  const args = [
    "playwright",
    "test",
    "--project=chromium",
    ...testFiles,
  ];

  const result = spawnSync("npx", args, {
    cwd: ROOT,
    env,
    stdio: "inherit",
    shell: true,
  });

  const exitCode = result.status ?? 1;
  writeSummary(runDir, runId, {
    suite,
    testFiles,
    exitCode,
    configPath: CONFIG_PATH,
  });
  process.exit(exitCode);
}

main();
