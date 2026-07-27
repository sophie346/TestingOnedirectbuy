require("dotenv").config();
const mongoose = require("mongoose");

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const RunningOccurrence = require("../server/models/RunningOccurrence");
  const r = await RunningOccurrence.updateMany(
    { status: { $in: ["running", "queued"] } },
    { $set: { status: "cancelled", finishedAt: new Date(), currentStepId: null } },
  );
  console.log("cancelled", r.modifiedCount);
  await mongoose.disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
