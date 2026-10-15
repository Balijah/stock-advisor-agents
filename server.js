import crypto from "crypto";
import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import rateLimit from "express-rate-limit";
import { runAthenaAdvisory } from "./src/main.js";
import { analyzeV2, getHealth, getPersistedRunById, getRunStatus, startRunV2 } from "./src/v2/service.js";
import { subscribe } from "./src/v2/runRegistry.js";
import { parseAnalyzeRequest } from "./src/v2/schemas.js";

const PORT = Number(process.env.PORT || 3001);

export function createApp() {
  const app = express();

  const corsOrigin = process.env.CORS_ORIGIN || (process.env.NODE_ENV === "production" ? false : "*");
  if (corsOrigin === false) {
    app.use(cors({ origin: false }));
  } else {
    app.use(cors({ origin: corsOrigin }));
  }

  app.use(bodyParser.json({ limit: "1mb" }));

  app.use((req, res, next) => {
    req.correlationId = req.headers["x-correlation-id"] || crypto.randomUUID();
    res.setHeader("x-correlation-id", req.correlationId);
    next();
  });

  const apiKey = process.env.API_KEY;
  function requireAuth(req, res, next) {
    if (!apiKey) return next();
    const provided = req.headers.authorization?.startsWith("Bearer ")
      ? req.headers.authorization.slice(7)
      : req.headers["x-api-key"];
    if (provided !== apiKey) {
      return sendError(res, req.correlationId, "UNAUTHORIZED", new Error("Invalid or missing API key"), 401);
    }
    next();
  }

  const analysisLimiter = rateLimit({
    windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 60_000,
    max: Number(process.env.RATE_LIMIT_MAX) || 20,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => req.headers["x-api-key"] || req.ip,
    message: { success: false, error: { code: "RATE_LIMITED", message: "Too many requests, please try again later" } },
  });

  app.get("/api/v2/health", (_req, res) => {
    res.json({ success: true, correlation_id: _req.correlationId, ...getHealth() });
  });

  app.post("/api/v2/analyze", requireAuth, analysisLimiter, async (req, res) => {
    try {
      const payload = parseAnalyzeRequest(req.body || {});
      const result = await analyzeV2(payload);
      res.json({ success: true, correlation_id: req.correlationId, data: result });
    } catch (error) {
      sendError(res, req.correlationId, "ANALYZE_FAILED", error, 400);
    }
  });

  app.get("/api/v2/runs/:runId", requireAuth, (req, res) => {
    const run = getRunStatus(req.params.runId) || getPersistedRunById(req.params.runId);
    if (!run) {
      sendError(res, req.correlationId, "RUN_NOT_FOUND", new Error("Run not found"), 404);
      return;
    }
    res.json({ success: true, correlation_id: req.correlationId, data: run });
  });

  app.post("/api/v2/runs", requireAuth, analysisLimiter, async (req, res) => {
    try {
      const payload = parseAnalyzeRequest(req.body || {});
      const run = startRunV2(payload);
      res.status(202).json({ success: true, correlation_id: req.correlationId, data: run });
    } catch (error) {
      sendError(res, req.correlationId, "RUN_CREATE_FAILED", error, 400);
    }
  });

  app.get("/api/v2/runs/:runId/events", requireAuth, (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();

    const unsub = subscribe(req.params.runId, res);
    if (!unsub) {
      res.write(`event: workflow\n`);
      res.write(`data: ${JSON.stringify({ event_type: "run_failed", message: "Run not found" })}\n\n`);
      res.end();
      return;
    }

    const heartbeat = setInterval(() => {
      res.write(`: keepalive\n\n`);
    }, 15000);

    req.on("close", () => {
      clearInterval(heartbeat);
      unsub();
      res.end();
    });
  });

  app.post("/api/run-analysis", requireAuth, analysisLimiter, async (req, res) => {
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
