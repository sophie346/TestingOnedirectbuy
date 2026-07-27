const mongoose = require("mongoose");

const StepResultSchema = new mongoose.Schema(
  {
    stepId: { type: String, required: true },
    title: { type: String, default: "" },
    status: {
      type: String,
      enum: ["pending", "running", "passed", "failed", "skipped", "blocked"],
      default: "pending",
    },
    order: { type: Number, default: 0 },
    startedAt: { type: Date, default: null },
    finishedAt: { type: Date, default: null },
    durationMs: { type: Number, default: null },
    error: { type: String, default: "" },
    marker: { type: String, default: "" },
    severity: { type: String, default: "" },
  },
  { _id: false },
);

const RunningOccurrenceSchema = new mongoose.Schema(
  {
    occurrenceId: { type: String, required: true, unique: true, index: true },
    flowId: { type: String, required: true, index: true },
    flowName: { type: String, default: "" },
    status: {
      type: String,
      enum: ["queued", "running", "passed", "failed", "cancelled"],
      default: "queued",
      index: true,
    },
    startedAt: { type: Date, default: null },
    finishedAt: { type: Date, default: null },
    currentStepId: { type: String, default: null },
    stepsCompleted: { type: Number, default: 0 },
    stepsTotal: { type: Number, default: 0 },
    workerPid: { type: Number, default: null },
    exitCode: { type: Number, default: null },
    runDir: { type: String, default: "" },
    steps: [StepResultSchema],
    liveIssues: { type: Array, default: [] },
    liveIssueCount: { type: Number, default: 0 },
    envSummary: {
      type: Object,
      default: {},
    },
  },
  { timestamps: true },
);

module.exports =
  mongoose.models.RunningOccurrence ||
  mongoose.model("RunningOccurrence", RunningOccurrenceSchema);
