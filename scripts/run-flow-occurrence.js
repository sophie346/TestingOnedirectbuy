/**
 * Launcher for a single flow occurrence (opened in a visible terminal).
 * Reads reports/.odb-flow-run.json (or path arg), sets env, runs Playwright.
 *
 * Usage: node scripts/run-flow-occurrence.js [metaPath]
 */
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const { META_PATH } = require("../lib/occurrenceLive");

const ROOT = path.resolve(__dirname, "..");

function main() {
  const metaPath = path.resolve(process.argv[2] || META_PATH);
  if (!fs.existsSync(metaPath)) {
    console.error(`Missing run meta: ${metaPath}`);
    process.exit(1);
  }

  const meta = JSON.parse(fs.readFileSync(metaPath, "utf8"));
  const flowId = meta.flowId;
  const occurrenceId = meta.occurrenceId;
  if (!flowId || !occurrenceId) {
    console.error("meta must include flowId and occurrenceId");
    process.exit(1);
  }

  console.log(`\n=== OneDirectBuy flow runner ===`);
  console.log(`Flow:       ${flowId}`);
  console.log(`Occurrence: ${occurrenceId}`);
  console.log(
    `Mongo:      ${(meta.mongoUri || process.env.MONGODB_URI || "").replace(
      /:\/\/.*@/,
      "://***@",
    )}`,
  );
  console.log(`API:        ${meta.statusApiUrl || process.env.STATUS_API_URL || ""}`);
  console.log(`===============================\n`);

  const env = {
    ...process.env,
    CI_TESTS_CONFIG: "flows.config.json",
    RUNNING_OCCURRENCE_ID: occurrenceId,
    STATUS_API_URL: meta.statusApiUrl || process.env.STATUS_API_URL || "",
    MONGODB_URI: meta.mongoUri || process.env.MONGODB_URI || "",
    // Always real exit for control-plane (UI must not fake PASSED)
    CI_SOFT_PASS: "0",
  };

  if (meta.headed) {
    env.PW_HEADED = "1";
    env.HEADLESS = "false";
    env.PW_HEADLESS = "0";
  } else {
    env.PW_HEADLESS = env.PW_HEADLESS || "1";
    env.HEADLESS = env.HEADLESS || "true";
  }

  const script = path.join(ROOT, "scripts", "run-ci-tests.js");
  console.log(`Starting: node scripts/run-ci-tests.js flow:${flowId}\n`);

  const result = spawnSync(process.execPath, [script, `flow:${flowId}`], {
    cwd: ROOT,
    env,
    stdio: "inherit",
    windowsHide: false,
  });

  const code = result.status ?? 1;
  const exitFile =
    meta.exitFile ||
    path.join(ROOT, "reports", `.flow-exit-${occurrenceId}.txt`);
  try {
    fs.mkdirSync(path.dirname(exitFile), { recursive: true });
    fs.writeFileSync(exitFile, `${code}\n`, "utf8");
    console.log(`Wrote exit file: ${exitFile} → ${code}`);
  } catch (err) {
    console.error("Failed to write exit file:", err.message);
  }

  console.log(`\nFlow finished with exit code ${code}`);
  // Parent .cmd usually pauses; avoid double-pause unless asked
  if (
    process.platform === "win32" &&
    process.env.ODB_PAUSE_ON_EXIT === "1"
  ) {
    console.log("Press Enter to close this window…");
    try {
      require("child_process").spawnSync("pause", {
        shell: true,
        stdio: "inherit",
      });
    } catch {
      // ignore
    }
  }
  process.exit(code);
}

main();
