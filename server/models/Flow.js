const mongoose = require("mongoose");

const FlowStepSchema = new mongoose.Schema(
  {
    stepId: { type: String, required: true },
    title: { type: String, required: true },
    specFile: { type: String, default: "" },
    order: { type: Number, required: true },
    dependsOn: { type: String, default: null },
  },
  { _id: false },
);

const FlowSchema = new mongoose.Schema(
  {
    flowId: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    enabled: { type: Boolean, default: true },
    tests: [{ type: String }],
    steps: [FlowStepSchema],
  },
  { timestamps: true },
);

module.exports = mongoose.models.Flow || mongoose.model("Flow", FlowSchema);
