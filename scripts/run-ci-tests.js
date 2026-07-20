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

function copyIfExists(source, destination) {
  if (!fs.existsSync(source)) {
    return false;
  }
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  const stat = fs.statSync(source);
  if (stat.isDirectory()) {
    fs.cpSync(source, destination, { recursive: true });
  } else {
    fs.copyFileSync(source, destination);
  }
  return true;
}

function findLatestSubdir(parentDir) {
  if (!fs.existsSync(parentDir)) {
    return null;
  }
  const entries = fs
    .readdirSync(parentDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const fullPath = path.join(parentDir, entry.name);
      return { name: entry.name, mtime: fs.statSync(fullPath).mtimeMs, fullPath };
    })
    .sort((a, b) => b.mtime - a.mtime);
  return entries[0]?.fullPath ?? null;
}

function collectReports(runId, { suite, testFiles, exitCode, configPath }) {
  const runDir = path.join(ROOT, "reports", runId);
  fs.mkdirSync(runDir, { recursive: true });

  const htmlSource = findLatestSubdir(path.join(ROOT, "playwright-report"));
  const copied = {
    html: htmlSource
      ? copyIfExists(htmlSource, path.join(runDir, "html"))
      : false,
    resultsJson: copyIfExists(
      path.join(ROOT, "test-results", "results.json"),
      path.join(runDir, "results.json"),
    ),
    junitXml: copyIfExists(
      path.join(ROOT, "test-results", "junit.xml"),
      path.join(runDir, "junit.xml"),
    ),
  };

  let parsedResults = null;
  const resultsPath = path.join(runDir, "results.json");
  if (fs.existsSync(resultsPath)) {
    try {
      parsedResults = JSON.parse(fs.readFileSync(resultsPath, "utf8"));
    } catch {
      parsedResults = null;
    }
  }

  const summary = {
    runId,
    suite,
    timestamp: new Date().toISOString(),
    exitCode,
    config: path.relative(ROOT, configPath),
    testFiles,
    reports: {
      directory: path.relative(ROOT, runDir).replace(/\\/g, "/"),
      html: copied.html ? "html/index.html" : null,
      resultsJson: copied.resultsJson ? "results.json" : null,
      junitXml: copied.junitXml ? "junit.xml" : null,
    },
    stats: parsedResults?.stats ?? null,
  };

  fs.writeFileSync(
    path.join(runDir, "summary.json"),
    `${JSON.stringify(summary, null, 2)}\n`,
    "utf8",
  );

  fs.mkdirSync(path.join(ROOT, "reports"), { recursive: true });
  fs.writeFileSync(
    path.join(ROOT, "reports", "latest.json"),
    `${JSON.stringify(
      {
        runId,
        path: `reports/${runId}`,
        timestamp: summary.timestamp,
        suite,
        exitCode,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );

  console.log(`\nReports collected in reports/${runId}/`);
  if (copied.html) {
    console.log(`  HTML:  reports/${runId}/html/index.html`);
  }
  if (copied.resultsJson) {
    console.log(`  JSON:  reports/${runId}/results.json`);
  }
  if (copied.junitXml) {
    console.log(`  JUnit: reports/${runId}/junit.xml`);
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
  console.log(`Running ${testFiles.length} test file(s):`);
  for (const file of testFiles) {
    console.log(`  - ${file}`);
  }

  const workers =
    process.env.PW_WORKERS !== undefined && process.env.PW_WORKERS !== ""
      ? process.env.PW_WORKERS
      : String(config.workers ?? 2);
  const retries =
    process.env.PW_RETRIES !== undefined && process.env.PW_RETRIES !== ""
      ? process.env.PW_RETRIES
      : config.retries !== undefined
        ? String(config.retries)
        : undefined;

  const env = {
    ...process.env,
    PW_WORKERS: workers,
    ...(retries !== undefined ? { PW_RETRIES: retries } : {}),
  };

  const runId = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);

  const result = spawnSync("npx", ["playwright", "test", ...testFiles], {
    cwd: ROOT,
    env,
    stdio: "inherit",
    shell: true,
  });

  const exitCode = result.status ?? 1;
  collectReports(runId, { suite, testFiles, exitCode, configPath: CONFIG_PATH });
  process.exit(exitCode);
}

main();
