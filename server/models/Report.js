const mongoose = require("mongoose");

const ReportSchema = new mongoose.Schema(
  {
    occurrenceId: { type: String, required: true, unique: true, index: true },
    flowId: { type: String, default: "" },
    summary: { type: Object, default: null },
    issues: { type: Object, default: null },
    results: { type: Object, default: null },
    issueCount: { type: Number, default: 0 },
    artifactPaths: {
      type: Object,
      default: {},
    },
  },
  { timestamps: true },
);

module.exports =
  mongoose.models.Report || mongoose.model("Report", ReportSchema);
