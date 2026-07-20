/**
 * Run Playwright tests selected by ci-tests.config.json and collect reports under reports/.
 *
 * Usage:
 *   node scripts/run-ci-tests.js [suite]
 *   CI_TEST_SUITE=smoke node scripts/run-ci-tests.js
 *
 * Soft pass (CI green): set CI_SOFT_PASS=1 (default when CI=1).
 * UI issues are written to reports/<run>/ISSUES.md with markers — they do not fail the job.
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

  return tests.filter((t) => t.enabled !== false).map((t) => t.file);
}

function isSoftPassEnabled() {
  if (process.env.CI_SOFT_PASS === "0" || process.env.CI_SOFT_PASS === "false") {
    return false;
  }
  if (process.env.CI_SOFT_PASS === "1" || process.env.CI_SOFT_PASS === "true") {
    return true;
  }
  // Default on when running under CI
  return Boolean(process.env.CI);
}

function appendGithubSummary(runDir, softPass, playwrightExit, issueCount) {
  const summaryFile = process.env.GITHUB_STEP_SUMMARY;
  if (!summaryFile) return;

  const issuesPath = path.join(runDir, "ISSUES.md");
  let issuesBody = "";
  if (fs.existsSync(issuesPath)) {
    issuesBody = fs.readFileSync(issuesPath, "utf8");
  }

  const lines = [
    `## Playwright CI (Chromium)`,
    "",
    softPass
      ? `✅ **Job result: PASSED (soft pass)** — UI issues are advisory.`
      : `Playwright exit code: \`${playwrightExit}\``,
    "",
    `| Field | Value |`,
    `| --- | --- |`,
    `| Soft pass | ${softPass ? "yes" : "no"} |`,
    `| Playwright exit | ${playwrightExit} |`,
    `| Issues recorded | ${issueCount} |`,
    `| Reports | \`reports/${path.basename(runDir)}/\` |`,
    "",
  ];

  if (issuesBody) {
    lines.push(`### Issues report`);
    lines.push("");
    lines.push(issuesBody);
  }

  fs.appendFileSync(summaryFile, `${lines.join("\n")}\n`, "utf8");
}

function countIssues(runDir) {
  const jsonPath = path.join(runDir, "ISSUES.json");
  if (!fs.existsSync(jsonPath)) return 0;
  try {
    const data = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
    return Array.isArray(data.issues) ? data.issues.length : 0;
  } catch {
    return 0;
  }
}

function writeSummary(runDir, runId, { suite, testFiles, exitCode, softPass, configPath }) {
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
  const issuesExists = fs.existsSync(path.join(runDir, "ISSUES.md"));
  const issueCount = countIssues(runDir);

  const summary = {
    runId,
    suite,
    timestamp: new Date().toISOString(),
    exitCode,
    softPass,
    effectiveExitCode: softPass ? 0 : exitCode,
    browser: "chromium",
    issueCount,
    config: path.relative(ROOT, configPath).replace(/\\/g, "/"),
    testFiles,
    reports: {
      directory: path.relative(ROOT, runDir).replace(/\\/g, "/"),
      html: htmlExists ? "html/index.html" : null,
      resultsJson: fs.existsSync(resultsPath) ? "results.json" : null,
      issues: issuesExists ? "ISSUES.md" : null,
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
        exitCode: summary.effectiveExitCode,
        softPass,
        issueCount,
        browser: "chromium",
      },
      null,
      2,
    )}\n`,
    "utf8",
  );

  console.log(`\nReports collected in reports/${runId}/`);
  if (summary.reports.html) {
    console.log(`  HTML:   reports/${runId}/html/index.html`);
  }
  if (summary.reports.resultsJson) {
    console.log(`  JSON:   reports/${runId}/results.json`);
  }
  if (summary.reports.issues) {
    console.log(`  Issues: reports/${runId}/ISSUES.md  (${issueCount} issue(s))`);
  }
  console.log(`  Summary: reports/${runId}/summary.json`);
  if (softPass) {
    console.log(
      `\nCI_SOFT_PASS=1 → exiting 0 (green). Review ISSUES.md for marked UI findings.`,
    );
  }

  appendGithubSummary(runDir, softPass, exitCode, issueCount);
}

function main() {
  const suite = process.argv[2] || process.env.CI_TEST_SUITE || "regression";
  const config = loadConfig();
  const testFiles = resolveTestFiles(config, suite);
  const softPass = isSoftPassEnabled();

  if (testFiles.length === 0) {
    console.error(
      `No tests selected for suite "${suite}". Edit ${path.relative(ROOT, CONFIG_PATH)}.`,
    );
    process.exit(1);
  }

  console.log(`Suite: ${suite}`);
  console.log(`Browser: chromium`);
  console.log(`Soft pass (CI green on UI issues): ${softPass ? "ON" : "OFF"}`);
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

  const env = {
    ...process.env,
    PW_WORKERS: workers,
    ...(retries !== undefined ? { PW_RETRIES: retries } : {}),
    CI_SOFT_PASS: softPass ? "1" : "0",
    PW_REPORT_OUTPUT_DIR: path.join("reports", runId, "html"),
    PW_JSON_REPORT_PATH: path.join("reports", runId, "results.json"),
    PW_JUNIT_REPORT_PATH: path.join("reports", runId, "junit.xml"),
  };

  const args = ["playwright", "test", "--project=chromium", ...testFiles];

  const result = spawnSync("npx", args, {
    cwd: ROOT,
    env,
    stdio: "inherit",
    shell: true,
  });

  const playwrightExit = result.status ?? 1;
  writeSummary(runDir, runId, {
    suite,
    testFiles,
    exitCode: playwrightExit,
    softPass,
    configPath: CONFIG_PATH,
  });

  process.exit(softPass ? 0 : playwrightExit);
}

main();
