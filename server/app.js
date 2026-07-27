const path = require("path");
const express = require("express");
const cors = require("cors");
const { optionalAuth } = require("./middleware/auth");
const flowsRouter = require("./routes/flows");
const occurrencesRouter = require("./routes/occurrences");
const { seedFlows } = require("./services/seedFlows");

const PUBLIC_DIR = path.join(__dirname, "public");

function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: "10mb" }));

  app.get("/health", (_req, res) => {
    res.json({ ok: true, service: "onedirectbuy-flow-control" });
  });

  // UI static assets (no auth)
  app.use("/ui", express.static(PUBLIC_DIR));
  app.get("/", (_req, res) => {
    res.sendFile(path.join(PUBLIC_DIR, "index.html"));
  });

  // API routes (optional bearer token when API_TOKEN is set)
  const api = express.Router();
  api.use(optionalAuth);

  api.post("/seed", async (_req, res, next) => {
    try {
      const result = await seedFlows();
      res.json({
        upserted: result.upserted,
        flows: result.flows.map((f) => ({
          flowId: f.flowId,
          name: f.name,
          steps: (f.steps || []).length,
        })),
      });
    } catch (err) {
      next(err);
    }
  });

  api.use("/flows", flowsRouter);
  api.use("/occurrences", occurrencesRouter);

  app.use("/api", api);

  app.use((err, _req, res, _next) => {
    console.error("[api]", err);
    res.status(500).json({
      error: err instanceof Error ? err.message : String(err),
    });
  });

  return app;
}

module.exports = { createApp };
