/**
 * Live occurrence updates written straight to MongoDB (used by Playwright soft()).
 * Also used by the Express updateStep path.
 */
const fs = require("fs");
const path = require("path");
const { MongoClient } = require("mongodb");

const ROOT = path.resolve(__dirname, "..");
const META_PATH = path.join(ROOT, "reports", "odb-flow-run.json");
const ACTIVE_OCCURRENCE_PATH = path.join(
  ROOT,
  "reports",
  "odb-active-occurrence.txt",
);

let clientPromise = null;

function readMeta() {
  try {
    if (!fs.existsSync(META_PATH)) return null;
    return JSON.parse(fs.readFileSync(META_PATH, "utf8"));
  } catch {
    return null;
  }
}

function writeMeta(meta) {
  fs.mkdirSync(path.dirname(META_PATH), { recursive: true });
  fs.writeFileSync(META_PATH, `${JSON.stringify(meta, null, 2)}\n`, "utf8");
  if (meta?.occurrenceId) {
    fs.writeFileSync(
      ACTIVE_OCCURRENCE_PATH,
      `${String(meta.occurrenceId).trim()}\n`,
      "utf8",
    );
  }
}

function clearMeta(occurrenceId) {
  try {
    if (fs.existsSync(META_PATH)) {
      const meta = JSON.parse(fs.readFileSync(META_PATH, "utf8"));
      if (!occurrenceId || meta.occurrenceId === occurrenceId) {
        fs.unlinkSync(META_PATH);
      }
    }
  } catch {
    // ignore
  }
  try {
    if (fs.existsSync(ACTIVE_OCCURRENCE_PATH)) {
      const active = fs.readFileSync(ACTIVE_OCCURRENCE_PATH, "utf8").trim();
      if (!occurrenceId || active === occurrenceId) {
        fs.unlinkSync(ACTIVE_OCCURRENCE_PATH);
      }
    }
  } catch {
    // ignore
  }
}

function resolveContext() {
  const meta = readMeta() || {};
  let active = "";
  try {
    if (fs.existsSync(ACTIVE_OCCURRENCE_PATH)) {
      active = fs.readFileSync(ACTIVE_OCCURRENCE_PATH, "utf8").trim();
    }
  } catch {
    active = "";
  }
  const occurrenceId = String(
    process.env.RUNNING_OCCURRENCE_ID ||
      meta.occurrenceId ||
      active ||
      "",
  ).trim();
  const mongoUri = String(
    process.env.MONGODB_URI || meta.mongoUri || "",
  ).trim();
  return { occurrenceId, mongoUri, meta };
}

/**
 * Prefer explicit DB name so native driver matches mongoose.
 * URI without path defaults to "test" (same as mongoose).
 */
function databaseName(mongoUri) {
  try {
    const u = new URL(mongoUri.replace("mongodb+srv://", "https://").replace("mongodb://", "http://"));
    const name = (u.pathname || "").replace(/^\//, "").split("?")[0];
    if (name) return name;
  } catch {
    // ignore
  }
  return process.env.MONGODB_DB || "test";
}

async function getDb() {
  const { mongoUri } = resolveContext();
  if (!mongoUri) throw new Error("MONGODB_URI missing for live occurrence updates");
  if (!clientPromise) {
    const {
      configureMongoDns,
      mongoConnectOptions,
      withDatabaseName,
    } = require("./mongoConnect");
    configureMongoDns();
    const uri = withDatabaseName(mongoUri);
    const client = new MongoClient(uri, mongoConnectOptions());
    clientPromise = client.connect().then((c) => ({ client: c, uri }));
  }
  const { client, uri } = await clientPromise;
  return client.db(databaseName(uri));
}

function collectionName() {
  return "runningoccurrences";
}

/**
 * @param {{ stepId: string; title?: string; status: string; error?: string; marker?: string; severity?: string }} payload
 */
async function reportStepToDb(payload) {
  const { occurrenceId, mongoUri } = resolveContext();
  if (!occurrenceId || !mongoUri) return { ok: false, reason: "no-context" };
  if (!payload?.stepId || !payload?.status) return { ok: false, reason: "bad-payload" };

  const db = await getDb();
  const col = db.collection(collectionName());
  const occ = await col.findOne({ occurrenceId });
  if (!occ) return { ok: false, reason: "occurrence-not-found" };

  const steps = Array.isArray(occ.steps) ? occ.steps.map((s) => ({ ...s })) : [];
  let step = steps.find((s) => s.stepId === payload.stepId);
  if (!step) {
    step = {
      stepId: payload.stepId,
      title: payload.title || payload.stepId,
      status: "pending",
      order: steps.length + 1,
      startedAt: null,
      finishedAt: null,
      durationMs: null,
      error: "",
      marker: "",
      severity: "",
    };
    steps.push(step);
  }

  if (payload.title) step.title = payload.title;
  step.status = payload.status;
  const now = new Date();
  if (payload.status === "running") {
    step.startedAt = now;
    step.finishedAt = null;
    step.durationMs = null;
  } else if (["passed", "failed", "skipped", "blocked"].includes(payload.status)) {
    if (!step.startedAt) step.startedAt = now;
    step.finishedAt = now;
    const startedMs = new Date(step.startedAt).getTime();
    step.durationMs = Number.isFinite(startedMs)
      ? Math.max(0, now.getTime() - startedMs)
      : 0;
    if (payload.error) step.error = String(payload.error).slice(0, 2000);
    if (payload.marker) step.marker = payload.marker;
    if (payload.severity) step.severity = payload.severity;
  }

  const stepsCompleted = steps.filter((s) =>
    ["passed", "failed", "skipped", "blocked"].includes(s.status),
  ).length;

  const currentStepId =
    payload.status === "running"
      ? payload.stepId
      : occ.currentStepId === payload.stepId
        ? null
        : occ.currentStepId;

  await col.updateOne(
    { occurrenceId },
    {
      $set: {
        steps,
        stepsCompleted,
        stepsTotal: Math.max(occ.stepsTotal || 0, steps.length),
        currentStepId,
        updatedAt: now,
      },
    },
  );

  return { ok: true, stepsCompleted, currentStepId };
}

/**
 * Append a soft issue onto the occurrence document (DB is source of truth).
 * @param {object} issue
 */
async function reportIssueToDb(issue) {
  const { occurrenceId, mongoUri } = resolveContext();
  if (!occurrenceId || !mongoUri || !issue) return { ok: false };

  const db = await getDb();
  const col = db.collection(collectionName());
  await col.updateOne(
    { occurrenceId },
    {
      $push: { liveIssues: issue },
      $inc: { liveIssueCount: 1 },
      $set: { updatedAt: new Date() },
    },
  );
  return { ok: true };
}

module.exports = {
  META_PATH,
  ACTIVE_OCCURRENCE_PATH,
  readMeta,
  writeMeta,
  clearMeta,
  resolveContext,
  reportStepToDb,
  reportIssueToDb,
  databaseName,
};
