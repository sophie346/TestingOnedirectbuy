/**
 * Fake runner for API smoke tests — writes steps straight to MongoDB.
 */
const fs = require("fs");
const path = require("path");
const {
  reportStepToDb,
  writeMeta,
  clearMeta,
  META_PATH,
} = require("../lib/occurrenceLive");

const ROOT = path.resolve(__dirname, "..");
const occurrenceId = process.env.RUNNING_OCCURRENCE_ID;

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  if (!occurrenceId) {
    console.error("RUNNING_OCCURRENCE_ID required");
    process.exit(1);
  }

  writeMeta({
    occurrenceId,
    flowId: "5",
    statusApiUrl: process.env.STATUS_API_URL,
    mongoUri: process.env.MONGODB_URI,
    startedAt: new Date().toISOString(),
  });

  console.log(`[smoke-fake-runner] occurrence=${occurrenceId} meta=${META_PATH}`);

  const steps = [
    { stepId: "SMOKE-1", title: "Smoke step one" },
    { stepId: "SMOKE-2", title: "Smoke step two" },
    { stepId: "SMOKE-3", title: "Smoke step three" },
  ];

  for (const s of steps) {
    await reportStepToDb({ ...s, status: "running" });
    await sleep(80);
    await reportStepToDb({ ...s, status: "passed" });
  }

  const runId = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const runDir = path.join(ROOT, "reports", runId);
  fs.mkdirSync(runDir, { recursive: true });
  const issues = { generatedAt: new Date().toISOString(), issues: [], count: 0 };
  fs.writeFileSync(
    path.join(runDir, "ISSUES.json"),
    `${JSON.stringify(issues, null, 2)}\n`,
  );
  const summary = {
    runId,
    suite: "smoke-fake",
    timestamp: new Date().toISOString(),
    exitCode: 0,
    softPass: true,
    issueCount: 0,
  };
  fs.writeFileSync(
    path.join(runDir, "summary.json"),
    `${JSON.stringify(summary, null, 2)}\n`,
  );
  fs.writeFileSync(
    path.join(ROOT, "reports", "latest.json"),
    `${JSON.stringify(
      {
        runId,
        path: `reports/${runId}`,
        timestamp: summary.timestamp,
        suite: "smoke-fake",
        exitCode: 0,
        softPass: true,
        issueCount: 0,
      },
      null,
      2,
    )}\n`,
  );

  clearMeta(occurrenceId);
  console.log("[smoke-fake-runner] done");
  process.exit(0);
}

main().catch((err) => {
  console.error("[smoke-fake-runner]", err);
  process.exit(1);
});
