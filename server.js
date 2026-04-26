import crypto from "crypto";
import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import { runAthenaAdvisory } from "./src/main.js";
import { analyzeV2, getHealth, getRunById } from "./src/v2/service.js";
import { parseAnalyzeRequest } from "./src/v2/schemas.js";

const PORT = Number(process.env.PORT || 3001);

export function createApp() {
  const app = express();
  app.use(cors({ origin: process.env.CORS_ORIGIN || "*" }));
  app.use(bodyParser.json({ limit: "1mb" }));

  app.use((req, res, next) => {
    req.correlationId = req.headers["x-correlation-id"] || crypto.randomUUID();
    res.setHeader("x-correlation-id", req.correlationId);
    next();
  });

  app.get("/api/v2/health", (_req, res) => {
    res.json({ success: true, correlation_id: _req.correlationId, ...getHealth() });
  });

  app.post("/api/v2/analyze", async (req, res) => {
    try {
      const payload = parseAnalyzeRequest(req.body || {});
      const result = await analyzeV2(payload);
      res.json({ success: true, correlation_id: req.correlationId, data: result });
    } catch (error) {
      sendError(res, req.correlationId, "ANALYZE_FAILED", error, 400);
    }
  });

  app.get("/api/v2/runs/:runId", (req, res) => {
    const run = getRunById(req.params.runId);
    if (!run) {
      sendError(res, req.correlationId, "RUN_NOT_FOUND", new Error("Run not found"), 404);
      return;
    }
    res.json({ success: true, correlation_id: req.correlationId, data: run });
  });

  // Compatibility shim for existing clients.
  app.post("/api/run-analysis", async (req, res) => {
    try {
      const userInputs = {
        risk_tolerance: req.body.risk_tolerance || "neutral",
        investment_horizon_years: req.body.investment_horizon_years || 5,
        preferred_sectors: req.body.preferred_sectors || [],
        num_stocks_requested: req.body.num_stocks_requested || 5,
        min_volume: req.body.min_volume || 500000,
      };
      const result = await runAthenaAdvisory(userInputs);
      res.json({
        success: true,
        correlation_id: req.correlationId,
        portfolio: result.final_portfolio,
        transcript: result.transcript,
        savedPath: result.savedPath,
      });
    } catch (error) {
      sendError(res, req.correlationId, "LEGACY_ANALYZE_FAILED", error, 500);
    }
  });

  return app;
}

function sendError(res, correlationId, code, error, status) {
  const message = error?.message || "Unexpected error";
  const details = error?.issues || undefined;
  res.status(status).json({
    success: false,
    error: {
      code,
      message,
      correlation_id: correlationId,
      details,
    },
  });
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  const app = createApp();
  app.listen(PORT, () => {
    console.log(`Athena Advisory API running on http://localhost:${PORT}`);
  });
}
