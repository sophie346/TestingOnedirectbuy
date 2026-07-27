/**
 * Live step/issue reporter for Playwright soft().
 * Pure ESM exports only — no createRequire / import.meta (Playwright transforms helpers).
 *
 * Reads occurrence id from (in order):
 *   RUNNING_OCCURRENCE_ID env, reports/odb-flow-run.json, reports/odb-active-occurrence.txt
 *
 * Updates:
 * 1. Append NDJSON under reports/live-steps/ (server watches)
 * 2. HTTP POST to STATUS_API_URL (best-effort)
 */
import fs from "fs";
import path from "path";

function projectRoot() {
  const cwd = process.cwd();
  if (fs.existsSync(path.join(cwd, "package.json"))) return cwd;
  if (fs.existsSync(path.join(cwd, "..", "package.json"))) {
    return path.resolve(cwd, "..");
  }
  return cwd;
}

function metaPath() {
  return path.join(projectRoot(), "reports", "odb-flow-run.json");
}

function activePath() {
  return path.join(projectRoot(), "reports", "odb-active-occurrence.txt");
}

function liveDir() {
  return path.join(projectRoot(), "reports", "live-steps");
}

function readMeta() {
  try {
    const p = metaPath();
    if (!fs.existsSync(p)) return null;
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    return null;
  }
}

function readActiveOccurrence() {
  try {
    const p = activePath();
    if (!fs.existsSync(p)) return "";
    return fs.readFileSync(p, "utf8").trim();
  } catch {
    return "";
  }
}

function resolveContext() {
  const meta = readMeta() || {};
  const occurrenceId = String(
    process.env.RUNNING_OCCURRENCE_ID ||
      meta.occurrenceId ||
      readActiveOccurrence() ||
      "",
  ).trim();
  return { occurrenceId, meta };
}

function apiBase(ctx) {
  return String(
    process.env.STATUS_API_URL || ctx.meta?.statusApiUrl || "",
  ).replace(/\/$/, "");
}

function authHeaders() {
  const token = String(
    process.env.STATUS_API_TOKEN || process.env.API_TOKEN || "",
  ).trim();
  const h = { "Content-Type": "application/json" };
  if (token) {
    h.Authorization = `Bearer ${token}`;
    h["x-api-token"] = token;
  }
  return h;
}

function appendLiveEvent(occurrenceId, kind, payload) {
  try {
    const dir = liveDir();
    fs.mkdirSync(dir, { recursive: true });
    fs.appendFileSync(
      path.join(dir, `${occurrenceId}.ndjson`),
      `${JSON.stringify({
        kind,
        at: new Date().toISOString(),
        ...payload,
      })}\n`,
      "utf8",
    );
  } catch (err) {
    console.warn(
      "[status-api] live file write failed:",
      err instanceof Error ? err.message : String(err),
    );
  }
}

async function postJson(url, body) {
  const res = await fetch(url, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json().catch(() => ({}));
}

/**
 * @param {{ stepId: string; title?: string; status: string; error?: string; marker?: string; severity?: string }} payload
 */
export async function reportStepStatus(payload) {
  const ctx = resolveContext();
  if (!ctx.occurrenceId) {
    console.warn(
      `[status-api] no occurrence context for step ${payload.stepId} (cwd=${process.cwd()})`,
    );
    return;
  }

  appendLiveEvent(ctx.occurrenceId, "step", {
    stepId: payload.stepId,
    title: payload.title,
    status: payload.status,
    error: payload.error,
    marker: payload.marker,
    severity: payload.severity,
  });

  const base = apiBase(ctx);
  if (!base) return;

  try {
    await postJson(
      `${base}/api/occurrences/${encodeURIComponent(ctx.occurrenceId)}/steps`,
      {
        stepId: payload.stepId,
        title: payload.title,
        status: payload.status,
        error: payload.error,
        marker: payload.marker,
        severity: payload.severity,
      },
    );
    console.log(`[status-api] ${payload.status} ${payload.stepId}`);
  } catch (err) {
    console.warn(
      `[status-api] HTTP step failed ${payload.stepId} (file feed ok):`,
      err instanceof Error ? err.message : String(err),
    );
  }
}

/**
 * @param {object} issue
 */
export async function reportIssue(issue) {
  const ctx = resolveContext();
  if (!ctx.occurrenceId) return;

  appendLiveEvent(ctx.occurrenceId, "issue", { issue });

  const base = apiBase(ctx);
  if (!base) return;

  try {
    await postJson(
      `${base}/api/occurrences/${encodeURIComponent(ctx.occurrenceId)}/report`,
      { appendIssue: issue },
    );
  } catch (err) {
    console.warn(
      `[status-api] HTTP issue failed (file feed ok):`,
      err instanceof Error ? err.message : String(err),
    );
  }
}
