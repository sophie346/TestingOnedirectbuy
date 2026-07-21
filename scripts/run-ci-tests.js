/**
 * Run Playwright tests selected by a config file and collect reports under reports/.
 *
 * Configs:
 *   flows.config.json     — local `npm test` (toggle flows by id/name)
 *   ci-tests.config.json  — GitHub Actions `npm run test:ci` (toggle per file)
 *
 * Usage:
 *   node scripts/run-ci-tests.js [suite]
 *   CI_TESTS_CONFIG=flows.config.json node scripts/run-ci-tests.js
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

/** Deduplicate while preserving order. */
function uniqueFiles(files) {
  const seen = new Set();
  const out = [];
  for (const file of files) {
    const key = file.replace(/\\/g, "/");
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(key);
  }
  return out;
}

/**
 * flows.config.json — select by enabled flows (or all / single flow id).
 * Suite examples: regression | all | flow:3 | flow:Cart
 */
function resolveFlowTestFiles(config, suite) {
  const flows = config.flows || [];
  const suiteKey = (
    suite ||
    process.env.CI_TEST_SUITE ||
    "regression"
  ).toLowerCase();

  let selected = flows;

  if (suiteKey === "all") {
    selected = flows;
  } else if (suiteKey.startsWith("flow:")) {
    const token = suite.slice(5).trim();
    const byId = Number(token);
    selected = flows.filter((f) => {
      if (Number.isFinite(byId) && !Number.isNaN(byId)) {
        return f.id === byId;
      }
      return (
        String(f.id) === token ||
        String(f.name || "")
          .toLowerCase()
          .includes(token.toLowerCase())
      );
    });
    if (selected.length === 0) {
      console.error(
        `No flow matched "${token}". Use flow:<id> or flow:<name substring>.`,
      );
      process.exit(1);
    }
  } else {
    // regression / default — only enabled flows
    selected = flows.filter((f) => f.enabled !== false);
  }

  const files = selected.flatMap((f) => f.tests || []);
  return { testFiles: uniqueFiles(files), selectedFlows: selected };
}

function resolveTestFiles(config, suite) {
  // Local flows control file
  if (Array.isArray(config.flows) && config.flows.length > 0) {
    const { testFiles, selectedFlows } = resolveFlowTestFiles(config, suite);
    return { testFiles, selectedFlows };
  }

  const tests = config.tests || [];
  const suiteKey = (
    suite ||
    process.env.CI_TEST_SUITE ||
    "regression"
  ).toLowerCase();

  if (suiteKey === "all") {
    return { testFiles: tests.map((t) => t.file), selectedFlows: null };
  }

  if (suiteKey === "smoke") {
    const smokeEntries = config.suites?.smoke;
    if (!Array.isArray(smokeEntries) || smokeEntries.length === 0) {
      console.error('Suite "smoke" requires suites.smoke in ci-tests.config.json');
      process.exit(1);
    }
    return {
      testFiles: tests
        .filter((t) =>
          smokeEntries.some((entry) => matchesSmokeEntry(t.file, entry)),
        )
        .map((t) => t.file),
      selectedFlows: null,
    };
  }

  return {
    testFiles: tests.filter((t) => t.enabled !== false).map((t) => t.file),
    selectedFlows: null,
  };
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
  const { testFiles, selectedFlows } = resolveTestFiles(config, suite);
  const softPass = isSoftPassEnabled();

  if (testFiles.length === 0) {
    console.error(
      `No tests selected for suite "${suite}". Edit ${path.relative(ROOT, CONFIG_PATH)}.`,
    );
    process.exit(1);
  }

  console.log(`Config: ${path.relative(ROOT, CONFIG_PATH).replace(/\\/g, "/")}`);
  console.log(`Suite: ${suite}`);
  console.log(`Browser: chromium`);
  console.log(`Soft pass (CI green on UI issues): ${softPass ? "ON" : "OFF"}`);
  if (selectedFlows && selectedFlows.length > 0) {
    console.log(`Flows (${selectedFlows.length}):`);
    for (const flow of selectedFlows) {
      const flag = flow.enabled === false ? "off" : "on";
      console.log(`  - Flow ${flow.id}: ${flow.name} [${flag}]`);
    }
  }
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
  if (
    process.env.PW_HEADED === "1" ||
    process.env.PW_HEADED === "true" ||
    process.env.HEADLESS === "false" ||
    process.env.PW_HEADLESS === "0"
  ) {
    args.push("--headed");
  }

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
