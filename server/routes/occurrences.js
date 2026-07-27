const express = require("express");
const RunningOccurrence = require("../models/RunningOccurrence");
const Report = require("../models/Report");
const { updateStep, upsertReport } = require("../services/runFlow");

const router = express.Router();

/** GET /api/occurrences — recent runs */
router.get("/", async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.flowId) filter.flowId = String(req.query.flowId);
    if (req.query.status) filter.status = String(req.query.status);

    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const occurrences = await RunningOccurrence.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit)
      .select(
        "occurrenceId flowId flowName status startedAt finishedAt stepsCompleted stepsTotal currentStepId exitCode createdAt",
      )
      .lean();

    res.json({ count: occurrences.length, occurrences });
  } catch (err) {
    next(err);
  }
});

/** GET /api/occurrences/:occurrenceId — live status */
router.get("/:occurrenceId", async (req, res, next) => {
  try {
    const occurrence = await RunningOccurrence.findOne({
      occurrenceId: req.params.occurrenceId,
    }).lean();
    if (!occurrence) {
      return res
        .status(404)
        .json({ error: `Occurrence not found: ${req.params.occurrenceId}` });
    }

    const pending = (occurrence.steps || []).filter(
      (s) => s.status === "pending",
    ).length;
    const running = (occurrence.steps || []).filter(
      (s) => s.status === "running",
    ).length;
    const passed = (occurrence.steps || []).filter(
      (s) => s.status === "passed",
    ).length;
    const failed = (occurrence.steps || []).filter(
      (s) => s.status === "failed" || s.status === "blocked",
    ).length;

    res.json({
      occurrenceId: occurrence.occurrenceId,
      flowId: occurrence.flowId,
      flowName: occurrence.flowName,
      status: occurrence.status,
      startedAt: occurrence.startedAt,
      finishedAt: occurrence.finishedAt,
      currentStepId: occurrence.currentStepId,
      stepsCompleted: occurrence.stepsCompleted,
      stepsTotal: occurrence.stepsTotal,
      workerPid: occurrence.workerPid,
      exitCode: occurrence.exitCode,
      runDir: occurrence.runDir,
      liveIssueCount: occurrence.liveIssueCount || 0,
      liveIssues: occurrence.liveIssues || [],
      progress: {
        pending,
        running,
        passed,
        failed,
        percent:
          occurrence.stepsTotal > 0
            ? Math.round(
                (occurrence.stepsCompleted / occurrence.stepsTotal) * 100,
              )
            : 0,
      },
      steps: occurrence.steps,
    });
  } catch (err) {
    next(err);
  }
});

/** POST /api/occurrences/:occurrenceId/steps — internal step update from soft() */
router.post("/:occurrenceId/steps", async (req, res, next) => {
  try {
    const occurrence = await updateStep(req.params.occurrenceId, req.body || {});
    res.json({
      occurrenceId: occurrence.occurrenceId,
      status: occurrence.status,
      currentStepId: occurrence.currentStepId,
      stepsCompleted: occurrence.stepsCompleted,
      stepsTotal: occurrence.stepsTotal,
    });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ error: err.message });
    }
    next(err);
  }
});

/** GET /api/occurrences/:occurrenceId/report */
router.get("/:occurrenceId/report", async (req, res, next) => {
  try {
    const report = await Report.findOne({
      occurrenceId: req.params.occurrenceId,
    }).lean();
    if (!report) {
      const occurrence = await RunningOccurrence.findOne({
        occurrenceId: req.params.occurrenceId,
      }).lean();
      if (!occurrence) {
        return res
          .status(404)
          .json({ error: `Occurrence not found: ${req.params.occurrenceId}` });
      }
      return res.status(404).json({
        error: "Report not ready yet",
        occurrenceStatus: occurrence.status,
      });
    }
    res.json(report);
  } catch (err) {
    next(err);
  }
});

/** POST /api/occurrences/:occurrenceId/report — upload final report/issues */
router.post("/:occurrenceId/report", async (req, res, next) => {
  try {
    const report = await upsertReport(req.params.occurrenceId, req.body || {});
    res.status(201).json(report);
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ error: err.message });
    }
    next(err);
  }
});

module.exports = router;
