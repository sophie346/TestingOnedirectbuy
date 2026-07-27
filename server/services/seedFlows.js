/**
 * Seed / upsert Flow documents from flows.config.json + server/data/flow-steps.json
 */
const fs = require("fs");
const path = require("path");
const Flow = require("../models/Flow");
const { FLOWS_CONFIG, FLOW_STEPS_DATA, ROOT } = require("../config");

function loadJson(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

/**
 * Ensure flow-steps.json exists by running the extractor if missing.
 */
function ensureFlowStepsData() {
  if (fs.existsSync(FLOW_STEPS_DATA)) return;
  const extractor = path.join(ROOT, "scripts", "extract-flow-steps.js");
  if (fs.existsSync(extractor)) {
    require("child_process").execFileSync(process.execPath, [extractor], {
      cwd: ROOT,
      stdio: "inherit",
    });
  }
}

/**
 * @returns {Promise<{ upserted: number; flows: object[] }>}
 */
async function seedFlows() {
  ensureFlowStepsData();

  const flowsConfig = loadJson(FLOWS_CONFIG);
  const catalog = loadJson(FLOW_STEPS_DATA) || {};

  if (!flowsConfig || !Array.isArray(flowsConfig.flows)) {
    throw new Error(`Invalid flows config: ${FLOWS_CONFIG}`);
  }

  const upserted = [];

  for (const flow of flowsConfig.flows) {
    const key = String(flow.id);
    const fromCatalog = catalog[key] || {};
    const steps = Array.isArray(fromCatalog.steps)
      ? fromCatalog.steps.map((s, i) => ({
          stepId: s.stepId,
          title: s.title,
          specFile: s.specFile || "",
          order: s.order ?? i + 1,
          dependsOn: s.dependsOn || null,
        }))
      : [];

    const doc = await Flow.findOneAndUpdate(
      { flowId: key },
      {
        flowId: key,
        name: flow.name || fromCatalog.name || `Flow ${key}`,
        enabled: flow.enabled !== false,
        tests: flow.tests || fromCatalog.tests || [],
        steps,
      },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true },
    );
    upserted.push(doc);
  }

  return { upserted: upserted.length, flows: upserted };
}

module.exports = { seedFlows, ensureFlowStepsData };
