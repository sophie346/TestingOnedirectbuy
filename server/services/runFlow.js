/**
 * Spawn Playwright for a flow, track occurrence in MongoDB.
 * On Windows, opens a NEW visible terminal window for the run.
 */
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const { randomUUID } = require("crypto");
const Flow = require("../models/Flow");
const RunningOccurrence = require("../models/RunningOccurrence");
const Report = require("../models/Report");
const { ROOT, STATUS_API_URL, MONGODB_URI } = require("../config");
const {
  writeMeta,
  clearMeta,
  META_PATH,
} = require("../../lib/occurrenceLive");

/** @type {Map<string, { timer?: NodeJS.Timeout }>} */
const activeWatchers = new Map();

/**
 * @param {string} flowId
 * @param {{ headed?: boolean }} [opts]
 */
async function startFlowRun(flowId, opts = {}) {
  const key = String(flowId);
  const flow = await Flow.findOne({ flowId: key });
  if (!flow) {
    const err = new Error(`Flow not found: ${key}`);
    err.status = 404;
    throw err;
  }

  const occurrenceId = randomUUID();
  const steps = (flow.steps || []).map((s) => ({
    stepId: s.stepId,
    title: s.title,
    status: "pending",
    order: s.order,
    startedAt: null,
    finishedAt: null,
    durationMs: null,
    error: "",
    marker: "",
    severity: "",
  }));

  const exitFile = path.join(ROOT, "reports", `.flow-exit-${occurrenceId}.txt`);
  try {
    if (fs.existsSync(exitFile)) fs.unlinkSync(exitFile);
  } catch {
    // ignore
  }

  const occurrence = await RunningOccurrence.create({
    occurrenceId,
    flowId: key,
    flowName: flow.name,
    status: "queued",
    stepsCompleted: 0,
    stepsTotal: steps.length,
    steps,
    liveIssues: [],
    liveIssueCount: 0,
    currentStepId: null,
    envSummary: {
      STATUS_API_URL,
      CI_TESTS_CONFIG: "flows.config.json",
      suite: `flow:${key}`,
      visibleTerminal: process.platform === "win32",
    },
  });

  // Ensure empty live-step feed for this occurrence
  try {
    const liveDir = path.join(ROOT, "reports", "live-steps");
    fs.mkdirSync(liveDir, { recursive: true });
    fs.writeFileSync(path.join(liveDir, `${occurrenceId}.ndjson`), "", "utf8");
  } catch {
    // ignore
  }

  // Meta lives under reports/ (NOT test-results/) so Playwright cleanup cannot wipe it.
  writeMeta({
    occurrenceId,
    flowId: key,
    statusApiUrl: STATUS_API_URL,
    mongoUri: MONGODB_URI,
    headed: Boolean(opts.headed),
    // Control-plane runs must report real Playwright exit (not CI soft-pass)
    softPass: "0",
    exitFile: exitFile.replace(/\\/g, "/"),
    startedAt: new Date().toISOString(),
  });

  const launcher = path.join(ROOT, "scripts", "run-flow-occurrence.js");
  const useSmokeRunner = process.env.FLOW_SMOKE_RUNNER === "1";

  console.log(
    `[runFlow] starting flow=${key} occurrence=${occurrenceId} visible=${process.platform === "win32"}`,
  );

  occurrence.status = "running";
  occurrence.startedAt = new Date();

  if (useSmokeRunner) {
    const smoke = path.join(ROOT, "scripts", "smoke-fake-runner.js");
    const child = spawn(process.execPath, [smoke], {
      cwd: ROOT,
      env: {
        ...process.env,
        RUNNING_OCCURRENCE_ID: occurrenceId,
        STATUS_API_URL,
        MONGODB_URI,
        CI_SOFT_PASS: "1",
      },
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: false,
    });
    occurrence.workerPid = child.pid;
    await occurrence.save();
    child.stdout?.on("data", (b) => process.stdout.write(b));
    child.stderr?.on("data", (b) => process.stderr.write(b));
    child.on("close", async (code) => {
      try {
        await finalizeOccurrence(occurrenceId, code ?? 1);
      } catch (err) {
        console.error("[runFlow] finalize failed:", err.message);
      }
    });
    return occurrence.toObject();
  }

  if (process.platform === "win32") {
    // Reliable visible CMD: write a .cmd wrapper so `start` quoting cannot break,
    // env vars are explicit, and Playwright logs stream in that window.
    const batPath = path.join(ROOT, "reports", `flow-run-${occurrenceId}.cmd`);
    const logPath = path.join(ROOT, "reports", `flow-run-${occurrenceId}.log`);
    const rootCmd = ROOT.replace(/\//g, "\\");
    const batPathCmd = batPath.replace(/\//g, "\\");
    const logPathCmd = logPath.replace(/\//g, "\\");
    const exitFileCmd = exitFile.replace(/\//g, "\\");
    const metaCmd = META_PATH.replace(/\//g, "\\");
    const launcherCmd = launcher.replace(/\//g, "\\");
    const nodeExe = process.execPath;
    const headedLines = opts.headed
      ? ["set PW_HEADED=1", "set HEADLESS=false", "set PW_HEADLESS=0"]
      : ["set PW_HEADLESS=1", "set HEADLESS=true"];
    const bat = [
      "@echo off",
      "setlocal EnableExtensions EnableDelayedExpansion",
      `title ODB Flow ${key} — ${occurrenceId.slice(0, 8)}`,
      `cd /d "${rootCmd}"`,
      `echo [%DATE% %TIME%] launcher start> "${logPathCmd}"`,
      `set "RUNNING_OCCURRENCE_ID=${occurrenceId}"`,
      `set "STATUS_API_URL=${STATUS_API_URL}"`,
      `set "MONGODB_URI=${MONGODB_URI}"`,
      'set "CI_SOFT_PASS=0"',
      'set "CI_TESTS_CONFIG=flows.config.json"',
      'set "ODB_PAUSE_ON_EXIT=0"',
      ...headedLines,
      "echo.",
      "echo ============================================",
      "echo  OneDirectBuy Flow Control Plane — runner",
      `echo  Flow:       ${key}`,
      `echo  Occurrence: ${occurrenceId}`,
      "echo  Dir:        %CD%",
      `echo  API:        ${STATUS_API_URL}`,
      "echo ============================================",
      "echo.",
      `echo [%DATE% %TIME%] running node>> "${logPathCmd}"`,
      `"${nodeExe}" "${launcherCmd}" "${metaCmd}" >> "${logPathCmd}" 2>&1`,
      "set EXITCODE=%ERRORLEVEL%",
      `>>"${logPathCmd}" echo [%DATE% %TIME%] node exit=!EXITCODE!`,
      `>"${exitFileCmd}" echo !EXITCODE!`,
      "echo.",
      "echo Flow finished with exit code !EXITCODE!",
      "echo Full log also saved to reports\\flow-run-*.log",
      "echo Window stays open so you can read the log.",
      "pause",
      "exit /b !EXITCODE!",
      "",
    ].join("\r\n");
    fs.writeFileSync(batPath, bat, "utf8");

    // shell:true + start "title" /D cwd — most reliable new-console spawn on Windows
    const startCmd = `start "ODB Flow ${key}" /D "${rootCmd}" cmd.exe /c "${batPathCmd}"`;
    console.log(`[runFlow] spawning visible terminal: ${startCmd}`);
    const child = spawn(startCmd, {
      cwd: ROOT,
      env: {
        ...process.env,
        RUNNING_OCCURRENCE_ID: occurrenceId,
        STATUS_API_URL,
        MONGODB_URI,
      },
      detached: true,
      stdio: "ignore",
      windowsHide: false,
      shell: true,
    });
    child.unref();
    occurrence.workerPid = child.pid;
    occurrence.envSummary = {
      ...occurrence.envSummary,
      batPath: path.relative(ROOT, batPath).replace(/\\/g, "/"),
      logPath: path.relative(ROOT, logPath).replace(/\\/g, "/"),
      headed: Boolean(opts.headed),
    };
    await occurrence.save();
    watchExitFile(occurrenceId, exitFile);
  } else {
    const child = spawn(process.execPath, [launcher, META_PATH], {
      cwd: ROOT,
      env: {
        ...process.env,
        RUNNING_OCCURRENCE_ID: occurrenceId,
        STATUS_API_URL,
        MONGODB_URI,
        ODB_PAUSE_ON_EXIT: "0",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    occurrence.workerPid = child.pid;
    await occurrence.save();
    child.stdout?.on("data", (b) => process.stdout.write(b));
    child.stderr?.on("data", (b) => process.stderr.write(b));
    child.on("close", async (code) => {
      try {
        await finalizeOccurrence(occurrenceId, code ?? 1);
      } catch (err) {
        console.error("[runFlow] finalize failed:", err.message);
      }
    });
  }

  return occurrence.toObject();
}

function watchExitFile(occurrenceId, exitFile) {
  if (activeWatchers.has(occurrenceId)) return;
  const started = Date.now();
  const maxMs = 3 * 60 * 60 * 1000;
  const liveFile = path.join(ROOT, "reports", "live-steps", `${occurrenceId}.ndjson`);
  let liveOffset = 0;

  const timer = setInterval(async () => {
    try {
      // Ingest live step/issue events written by soft() (file feed)
      await ingestLiveStepFile(occurrenceId, liveFile, () => liveOffset, (n) => {
        liveOffset = n;
      });

      if (fs.existsSync(exitFile)) {
        const raw = fs.readFileSync(exitFile, "utf8").trim();
        const code = Number(raw);
        clearInterval(timer);
        activeWatchers.delete(occurrenceId);
        // Final ingest in case last events arrived with exit
        await ingestLiveStepFile(occurrenceId, liveFile, () => liveOffset, (n) => {
          liveOffset = n;
        });
        try {
          fs.unlinkSync(exitFile);
        } catch {
          // ignore
        }
        await finalizeOccurrence(
          occurrenceId,
          Number.isFinite(code) ? code : 1,
        );
        return;
      }
      if (Date.now() - started > maxMs) {
        clearInterval(timer);
        activeWatchers.delete(occurrenceId);
        await finalizeOccurrence(occurrenceId, 1);
      }
    } catch (err) {
      console.error("[runFlow] exit watcher error:", err.message);
    }
  }, 750);
  activeWatchers.set(occurrenceId, { timer });
}

/**
 * Read new NDJSON lines from soft() live feed and apply to Mongo via updateStep.
 * @param {string} occurrenceId
 * @param {string} liveFile
 * @param {() => number} getOffset
 * @param {(n: number) => void} setOffset
 */
async function ingestLiveStepFile(occurrenceId, liveFile, getOffset, setOffset) {
  if (!fs.existsSync(liveFile)) return;
  const stat = fs.statSync(liveFile);
  let offset = getOffset();
  if (stat.size < offset) offset = 0; // file rotated/replaced
  if (stat.size === offset) return;

  const fd = fs.openSync(liveFile, "r");
  try {
    const len = stat.size - offset;
    const buf = Buffer.alloc(len);
    fs.readSync(fd, buf, 0, len, offset);
    setOffset(stat.size);
    const chunk = buf.toString("utf8");
    const lines = chunk.split(/\r?\n/).filter(Boolean);
    for (const line of lines) {
      let ev;
      try {
        ev = JSON.parse(line);
      } catch {
        continue;
      }
      if (ev.kind === "step" && ev.stepId && ev.status) {
        try {
          await updateStep(occurrenceId, {
            stepId: ev.stepId,
            title: ev.title,
            status: ev.status,
            error: ev.error,
            marker: ev.marker,
            severity: ev.severity,
          });
        } catch (err) {
          console.warn("[runFlow] live step ingest:", err.message);
        }
      } else if (ev.kind === "issue" && ev.issue) {
        try {
          await upsertReport(occurrenceId, { appendIssue: ev.issue });
        } catch (err) {
          console.warn("[runFlow] live issue ingest:", err.message);
        }
      }
    }
  } finally {
    fs.closeSync(fd);
  }
}

/**
 * @param {string} occurrenceId
 * @param {number} exitCode
 */
async function finalizeOccurrence(occurrenceId, exitCode) {
  const occurrence = await RunningOccurrence.findOne({ occurrenceId });
  if (!occurrence) return;
  if (["passed", "failed", "cancelled"].includes(occurrence.status) && occurrence.finishedAt) {
    // already finalized
    clearMeta(occurrenceId);
    return;
  }

  const latestPath = path.join(ROOT, "reports", "latest.json");
  let runDir = "";
  let summary = null;
  let issues = null;
  let results = null;
  let issueCount = 0;

  if (fs.existsSync(latestPath)) {
    try {
      const latest = JSON.parse(fs.readFileSync(latestPath, "utf8"));
      if (latest.path) runDir = path.join(ROOT, latest.path);
    } catch {
      // ignore
    }
  }

  if (runDir && fs.existsSync(runDir)) {
    for (const [name, assign] of [
      ["summary.json", (v) => (summary = v)],
      ["ISSUES.json", (v) => (issues = v)],
      ["results.json", (v) => (results = v)],
    ]) {
      const p = path.join(runDir, name);
      if (!fs.existsSync(p)) continue;
      try {
        const parsed = JSON.parse(fs.readFileSync(p, "utf8"));
        assign(parsed);
      } catch {
        // ignore
      }
    }
    issueCount = Array.isArray(issues?.issues) ? issues.issues.length : 0;
  }

  // Prefer live issues already in DB; merge file issues if live empty
  if (
    (!occurrence.liveIssues || occurrence.liveIssues.length === 0) &&
    Array.isArray(issues?.issues)
  ) {
    occurrence.liveIssues = issues.issues;
    occurrence.liveIssueCount = issues.issues.length;
    for (const issue of issues.issues) {
      const sid = issue.step || issue.id;
      const step = occurrence.steps.find((s) => s.stepId === sid);
      if (step && (step.status === "pending" || step.status === "running")) {
        step.status = issue.marker === "[BLOCKED]" ? "blocked" : "failed";
        step.error = String(issue.evidence || "").slice(0, 2000);
        step.marker = issue.marker || "";
        step.severity = issue.severity || "";
        step.finishedAt = new Date();
      }
    }
    occurrence.markModified("steps");
    occurrence.markModified("liveIssues");
  }

  // Reload steps from DB in case soft()/HTTP updated meanwhile
  const fresh = await RunningOccurrence.findOne({ occurrenceId }).lean();
  if (fresh?.steps?.length) {
    // Merge: keep whichever side progressed further per step
    const byId = new Map(occurrence.steps.map((s) => [s.stepId, s]));
    for (const fsStep of fresh.steps) {
      const cur = byId.get(fsStep.stepId);
      if (!cur) {
        occurrence.steps.push(fsStep);
        continue;
      }
      const rank = (st) =>
        ({ pending: 0, running: 1, skipped: 2, passed: 3, failed: 3, blocked: 3 })[
          st
        ] ?? 0;
      if (rank(fsStep.status) >= rank(cur.status)) {
        Object.assign(cur, fsStep);
      }
    }
    occurrence.liveIssues = fresh.liveIssues?.length
      ? fresh.liveIssues
      : occurrence.liveIssues;
    occurrence.liveIssueCount =
      fresh.liveIssueCount || occurrence.liveIssueCount || 0;
    occurrence.markModified("steps");
    occurrence.markModified("liveIssues");
  }

  // Mark remaining pending/running as skipped after run ends
  for (const step of occurrence.steps) {
    if (step.status === "pending" || step.status === "running") {
      step.status = "skipped";
      step.finishedAt = new Date();
    }
  }
  occurrence.markModified("steps");

  const realExit =
    typeof summary?.exitCode === "number" ? summary.exitCode : exitCode;
  const failedSteps = occurrence.steps.filter((s) =>
    ["failed", "blocked"].includes(s.status),
  ).length;
  const completedSteps = occurrence.steps.filter((s) =>
    ["passed", "failed", "skipped", "blocked"].includes(s.status),
  ).length;
  const passedSteps = occurrence.steps.filter((s) => s.status === "passed").length;
  const liveIssues = occurrence.liveIssueCount || issueCount || 0;

  // Prefer real Playwright / step outcome over CI soft-pass
  let finalStatus = "failed";
  if (realExit === 0 && failedSteps === 0 && liveIssues === 0) {
    finalStatus = "passed";
  } else if (passedSteps > 0 && failedSteps === 0 && realExit === 0) {
    finalStatus = "passed";
  } else if (completedSteps === 0 && realExit === 0) {
    // Nothing executed but soft-pass exited 0 — treat as failed so UI is honest
    finalStatus = "failed";
  } else {
    finalStatus = failedSteps > 0 || liveIssues > 0 || realExit !== 0 ? "failed" : "passed";
  }

  occurrence.status = finalStatus;
  occurrence.finishedAt = new Date();
  occurrence.exitCode = realExit;
  occurrence.runDir = runDir
    ? path.relative(ROOT, runDir).replace(/\\/g, "/")
    : "";
  occurrence.stepsCompleted = occurrence.steps.filter((s) =>
    ["passed", "failed", "skipped", "blocked"].includes(s.status),
  ).length;
  occurrence.currentStepId = null;
  await occurrence.save();

  clearMeta(occurrenceId);

  // Cleanup bat launcher + log keep for debugging (only remove bat)
  try {
    const batPath = path.join(ROOT, "reports", `flow-run-${occurrenceId}.cmd`);
    if (fs.existsSync(batPath)) fs.unlinkSync(batPath);
  } catch {
    // ignore
  }
  try {
    const oldBat = path.join(ROOT, "reports", `.run-${occurrenceId}.cmd`);
    if (fs.existsSync(oldBat)) fs.unlinkSync(oldBat);
  } catch {
    // ignore
  }

  const finalIssues =
    occurrence.liveIssues?.length > 0
      ? { issues: occurrence.liveIssues, count: occurrence.liveIssueCount }
      : issues;

  await Report.findOneAndUpdate(
    { occurrenceId },
    {
      occurrenceId,
      flowId: occurrence.flowId,
      summary,
      issues: finalIssues,
      results,
      issueCount:
        occurrence.liveIssueCount ||
        issueCount ||
        (Array.isArray(finalIssues?.issues) ? finalIssues.issues.length : 0),
      artifactPaths: {
        runDir: occurrence.runDir,
        issuesJson: occurrence.runDir
          ? `${occurrence.runDir}/ISSUES.json`
          : null,
        summaryJson: occurrence.runDir
          ? `${occurrence.runDir}/summary.json`
          : null,
      },
    },
    { upsert: true, returnDocument: "after" },
  );

  console.log(
    `[runFlow] finalized ${occurrenceId} status=${occurrence.status} steps=${occurrence.stepsCompleted}/${occurrence.stepsTotal} passed=${passedSteps} failed=${failedSteps} issues=${occurrence.liveIssueCount || issueCount} exit=${realExit}`,
  );
}

async function updateStep(occurrenceId, payload) {
  if (!payload?.stepId || !payload?.status) {
    const err = new Error("stepId and status are required");
    err.status = 400;
    throw err;
  }

  const now = new Date();
  const occurrence = await RunningOccurrence.findOne({ occurrenceId });
  if (!occurrence) {
    const err = new Error(`Occurrence not found: ${occurrenceId}`);
    err.status = 404;
    throw err;
  }

  let step = occurrence.steps.find((s) => s.stepId === payload.stepId);
  if (!step) {
    occurrence.steps.push({
      stepId: payload.stepId,
      title: payload.title || payload.stepId,
      status: "pending",
      order: occurrence.steps.length + 1,
    });
    step = occurrence.steps[occurrence.steps.length - 1];
  }

  if (payload.title) step.title = payload.title;
  step.status = payload.status;

  if (payload.status === "running") {
    step.startedAt = now;
    step.finishedAt = null;
    step.durationMs = null;
    occurrence.currentStepId = payload.stepId;
  } else if (["passed", "failed", "skipped", "blocked"].includes(payload.status)) {
    if (!step.startedAt) step.startedAt = now;
    step.finishedAt = now;
    step.durationMs = Math.max(
      0,
      now.getTime() - new Date(step.startedAt).getTime(),
    );
    if (payload.error) step.error = String(payload.error).slice(0, 2000);
    if (payload.marker) step.marker = payload.marker;
    if (payload.severity) step.severity = payload.severity;
    if (occurrence.currentStepId === payload.stepId) {
      occurrence.currentStepId = null;
    }
  }

  occurrence.stepsCompleted = occurrence.steps.filter((s) =>
    ["passed", "failed", "skipped", "blocked"].includes(s.status),
  ).length;
  occurrence.stepsTotal = Math.max(
    occurrence.stepsTotal || 0,
    occurrence.steps.length,
  );
  occurrence.markModified("steps");
  await occurrence.save();

  console.log(
    `[runFlow] step ${payload.status} ${payload.stepId} (${occurrence.stepsCompleted}/${occurrence.stepsTotal}) occ=${occurrenceId.slice(0, 8)}`,
  );

  return occurrence.toObject();
}

async function upsertReport(occurrenceId, body) {
  const occurrence = await RunningOccurrence.findOne({ occurrenceId });
  if (!occurrence) {
    const err = new Error(`Occurrence not found: ${occurrenceId}`);
    err.status = 404;
    throw err;
  }

  // Mid-run: soft() can append a single issue onto the occurrence (DB source of truth)
  if (body?.appendIssue && typeof body.appendIssue === "object") {
    occurrence.liveIssues = occurrence.liveIssues || [];
    occurrence.liveIssues.push(body.appendIssue);
    occurrence.liveIssueCount = (occurrence.liveIssueCount || 0) + 1;
    occurrence.markModified("liveIssues");
    await occurrence.save();

    if (
      body.summary === undefined &&
      body.issues === undefined &&
      body.results === undefined
    ) {
      return {
        occurrenceId,
        flowId: occurrence.flowId,
        issueCount: occurrence.liveIssueCount,
        appended: true,
      };
    }
  }

  const issueCount = Array.isArray(body?.issues?.issues)
    ? body.issues.issues.length
    : Array.isArray(body?.issues)
      ? body.issues.length
      : body?.issueCount ?? occurrence.liveIssueCount ?? 0;

  const report = await Report.findOneAndUpdate(
    { occurrenceId },
    {
      occurrenceId,
      flowId: occurrence.flowId,
      summary: body.summary ?? undefined,
      issues: body.issues ?? undefined,
      results: body.results ?? undefined,
      issueCount,
      artifactPaths: body.artifactPaths ?? undefined,
    },
    { upsert: true, returnDocument: "after", setDefaultsOnInsert: true },
  );

  return report.toObject();
}

module.exports = {
  startFlowRun,
  finalizeOccurrence,
  updateStep,
  upsertReport,
  activeWatchers,
};
