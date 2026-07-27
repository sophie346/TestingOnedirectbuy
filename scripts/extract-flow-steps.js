/**
 * Extract soft()/requireSoft() step IDs from specs and emit server/data/flow-steps.json
 * keyed by flow id from flows.config.json.
 *
 * Usage: node scripts/extract-flow-steps.js
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const FLOWS_CONFIG = path.join(ROOT, "flows.config.json");
const OUT = path.join(ROOT, "server", "data", "flow-steps.json");

/**
 * @param {string} absPath
 * @param {string} relPath
 */
function extractStepsFromFile(absPath, relPath) {
  const text = fs.readFileSync(absPath, "utf8");
  const steps = [];
  const seen = new Set();
  const rel = relPath.replace(/\\/g, "/");

  // soft("id", "title"  — may span whitespace
  const softRe =
    /(?:await\s+)?soft\(\s*["']([^"']+)["']\s*,\s*["']([^"']+)["']/gs;
  // requireSoft(soft, "id", "title"
  const reqRe =
    /requireSoft\(\s*soft\s*,\s*["']([^"']+)["']\s*,\s*["']([^"']+)["']/gs;

  /** @type {Array<{ index: number; stepId: string; title: string }>} */
  const found = [];

  let m;
  while ((m = softRe.exec(text))) {
    found.push({ index: m.index, stepId: m[1], title: m[2] });
  }
  while ((m = reqRe.exec(text))) {
    found.push({ index: m.index, stepId: m[1], title: m[2] });
  }

  found.sort((a, b) => a.index - b.index);

  for (const item of found) {
    if (seen.has(item.stepId)) continue;
    seen.add(item.stepId);
    steps.push({
      stepId: item.stepId,
      title: item.title,
      specFile: rel,
    });
  }

  return steps;
}

/**
 * For gated journeys, chain dependsOn only across "happy path" steps
 * (skip *-blocked / *-skipped advisory ids as dependency parents).
 * @param {object[]} steps
 */
function applyJourneyDependsOn(steps) {
  let lastHappy = null;
  for (const entry of steps) {
    const isAdvisory =
      /-(blocked|skipped)$/i.test(entry.stepId) ||
      /-\d+[a-z]$/i.test(entry.stepId);
    if (!isAdvisory && lastHappy) {
      entry.dependsOn = lastHappy;
    }
    if (!isAdvisory) lastHappy = entry.stepId;
  }
}

function main() {
  const config = JSON.parse(fs.readFileSync(FLOWS_CONFIG, "utf8"));
  const catalog = {};

  for (const flow of config.flows || []) {
    const key = String(flow.id);
    const steps = [];
    let order = 1;

    const isJourney =
      String(flow.id) === "6.2" || /journey|purchase/i.test(flow.name || "");

    for (const testFile of flow.tests || []) {
      const abs = path.join(ROOT, testFile);
      if (!fs.existsSync(abs)) {
        console.warn(`Missing spec: ${testFile}`);
        continue;
      }
      const extracted = extractStepsFromFile(abs, testFile);
      for (const s of extracted) {
        steps.push({
          stepId: s.stepId,
          title: s.title,
          specFile: s.specFile,
          order: order++,
        });
      }
    }

    if (isJourney) applyJourneyDependsOn(steps);

    catalog[key] = {
      flowId: flow.id,
      name: flow.name,
      enabled: flow.enabled !== false,
      tests: flow.tests || [],
      steps,
    };
  }

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, `${JSON.stringify(catalog, null, 2)}\n`, "utf8");
  console.log(`Wrote ${OUT} (${Object.keys(catalog).length} flows)`);
}

main();
