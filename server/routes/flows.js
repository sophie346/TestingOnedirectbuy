const express = require("express");
const Flow = require("../models/Flow");
const { startFlowRun } = require("../services/runFlow");
const { seedFlows } = require("../services/seedFlows");

const router = express.Router();

/** GET /api/flows — list flows with step outlines */
router.get("/", async (_req, res, next) => {
  try {
    let flows = await Flow.find().sort({ flowId: 1 }).lean();
    if (flows.length === 0) {
      await seedFlows();
      flows = await Flow.find().sort({ flowId: 1 }).lean();
    }
    res.json({
      count: flows.length,
      flows: flows.map((f) => ({
        flowId: f.flowId,
        name: f.name,
        enabled: f.enabled,
        tests: f.tests,
        stepsTotal: (f.steps || []).length,
        steps: (f.steps || []).map((s) => ({
          stepId: s.stepId,
          title: s.title,
          order: s.order,
          specFile: s.specFile,
          dependsOn: s.dependsOn || null,
        })),
      })),
    });
  } catch (err) {
    next(err);
  }
});

/** GET /api/flows/:flowId */
router.get("/:flowId", async (req, res, next) => {
  try {
    const flow = await Flow.findOne({ flowId: String(req.params.flowId) }).lean();
    if (!flow) {
      return res.status(404).json({ error: `Flow not found: ${req.params.flowId}` });
    }
    res.json(flow);
  } catch (err) {
    next(err);
  }
});

/** POST /api/flows/:flowId/run — trigger Playwright for this flow */
router.post("/:flowId/run", async (req, res, next) => {
  try {
    const headed = Boolean(req.body?.headed);
    const occurrence = await startFlowRun(String(req.params.flowId), { headed });
    res.status(202).json({
      occurrenceId: occurrence.occurrenceId,
      flowId: occurrence.flowId,
      flowName: occurrence.flowName,
      status: occurrence.status,
      stepsTotal: occurrence.stepsTotal,
      stepsCompleted: occurrence.stepsCompleted,
      workerPid: occurrence.workerPid,
    });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ error: err.message });
    }
    next(err);
  }
});

module.exports = router;
