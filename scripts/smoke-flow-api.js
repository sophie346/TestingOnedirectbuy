/**
 * Smoke the Express + Mongo flow control plane (in-memory Mongo).
 *
 * Usage: node scripts/smoke-flow-api.js
 */
const path = require("path");
const { MongoMemoryServer } = require("mongodb-memory-server");
const mongoose = require("mongoose");

const ROOT = path.resolve(__dirname, "..");

async function waitFor(fn, { timeoutMs = 30_000, intervalMs = 200 } = {}) {
  const start = Date.now();
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const value = await fn();
    if (value) return value;
    if (Date.now() - start > timeoutMs) {
      throw new Error("waitFor timed out");
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}

async function main() {
  process.env.FLOW_SMOKE_RUNNER = "1";
  process.env.PORT = process.env.PORT || "3850";
  process.env.STATUS_API_URL =
    process.env.STATUS_API_URL || `http://127.0.0.1:${process.env.PORT}`;

  console.log("[smoke] Starting MongoMemoryServer…");
  const mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri("onedirectbuy-tests-smoke");

  // Clear cached config module values by requiring after env is set
  delete require.cache[require.resolve("../server/config")];
  const { createApp } = require("../server/app");
  const { seedFlows } = require("../server/services/seedFlows");
  const { MONGODB_URI, PORT, STATUS_API_URL } = require("../server/config");

  console.log(`[smoke] Connecting ${MONGODB_URI}`);
  await mongoose.connect(MONGODB_URI);
  const { upserted } = await seedFlows();
  console.log(`[smoke] Seeded ${upserted} flows`);

  const app = createApp();
  const server = await new Promise((resolve) => {
    const s = app.listen(Number(PORT), () => resolve(s));
  });
  console.log(`[smoke] API on ${STATUS_API_URL}`);

  const base = STATUS_API_URL.replace(/\/$/, "");

  const health = await fetch(`${base}/health`).then((r) => r.json());
  if (!health.ok) throw new Error("health check failed");
  console.log("[smoke] health ok");

  const ui = await fetch(`${base}/`);
  if (!ui.ok || !(await ui.text()).includes("Flow Control")) {
    throw new Error("UI index.html not served at /");
  }
  console.log("[smoke] UI / ok");

  const flowsRes = await fetch(`${base}/api/flows`).then((r) => r.json());
  if (!flowsRes.count || !flowsRes.flows?.length) {
    throw new Error("GET /api/flows returned no flows");
  }
  console.log(`[smoke] GET /api/flows → ${flowsRes.count} flows`);

  const cart = flowsRes.flows.find((f) => f.flowId === "5");
  if (!cart || !cart.stepsTotal) {
    throw new Error("Flow 5 (Cart) missing or has no steps");
  }
  console.log(
    `[smoke] Flow 5 "${cart.name}" has ${cart.stepsTotal} catalog steps`,
  );

  const runRes = await fetch(`${base}/api/flows/5/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  if (runRes.status !== 202) {
    throw new Error(
      `POST /run expected 202, got ${runRes.status}: ${await runRes.text()}`,
    );
  }
  const { occurrenceId } = await runRes.json();
  console.log(`[smoke] started occurrence ${occurrenceId}`);

  const finished = await waitFor(async () => {
    const occ = await fetch(
      `${base}/api/occurrences/${occurrenceId}`,
    ).then((r) => r.json());
    if (occ.status === "running" || occ.status === "queued") return null;
    return occ;
  });

  console.log(
    `[smoke] occurrence status=${finished.status} completed=${finished.stepsCompleted}/${finished.stepsTotal} progress=${JSON.stringify(finished.progress)}`,
  );

  if (finished.stepsCompleted < 3) {
    throw new Error(
      `Expected fake runner to complete ≥3 steps, got ${finished.stepsCompleted}`,
    );
  }

  const report = await waitFor(async () => {
    const res = await fetch(`${base}/api/occurrences/${occurrenceId}/report`);
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`report ${res.status}`);
    return res.json();
  });

  console.log(
    `[smoke] report issueCount=${report.issueCount} flowId=${report.flowId}`,
  );

  server.close();
  await mongoose.disconnect();
  await mongod.stop();
  console.log("[smoke] PASS");
}

main().catch(async (err) => {
  console.error("[smoke] FAIL", err);
  try {
    await mongoose.disconnect();
  } catch {
    // ignore
  }
  process.exit(1);
});
