import crypto from "crypto";
import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import rateLimit from "express-rate-limit";
import { screenCompany, getMethodology, listMethodologies } from "./src/screening/index.js";
import { DemoFixtureProvider } from "./src/providers/demoFixtures.js";

const PORT = Number(process.env.PORT || 3001);

function createProvider() {
  return new DemoFixtureProvider();
}

export function createApp() {
  const app = express();
  const provider = createProvider();

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

  const screenLimiter = rateLimit({
    windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 60_000,
    max: Number(process.env.RATE_LIMIT_MAX) || 60,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => req.headers["x-api-key"] || req.ip,
    message: { success: false, error: { code: "RATE_LIMITED", message: "Too many requests, please try again later" } },
  });

  // --- Health ---
  app.get("/api/v1/health", (_req, res) => {
    res.json({
      success: true,
      correlation_id: _req.correlationId,
      status: "ok",
      time: new Date().toISOString(),
      provider: provider.name,
      demo: provider.isDemo,
    });
  });

  // --- Methodologies ---
  app.get("/api/v1/methodologies", (_req, res) => {
    res.json({
      success: true,
      correlation_id: _req.correlationId,
      data: listMethodologies(),
    });
  });

  app.get("/api/v1/methodologies/:id", (req, res) => {
    const m = getMethodology(req.params.id);
    if (!m) {
      return sendError(res, req.correlationId, "NOT_FOUND", new Error(`Methodology "${req.params.id}" not found`), 404);
    }
    res.json({ success: true, correlation_id: req.correlationId, data: m });
  });

  // --- Security directory ---
  app.get("/api/v1/tickers", requireAuth, (_req, res) => {
    res.json({
      success: true,
      correlation_id: _req.correlationId,
      demo: provider.isDemo,
      data: provider.listTickers(),
    });
  });

  // --- Single-ticker screening ---
  app.get("/api/v1/screen/:ticker", requireAuth, screenLimiter, (req, res) => {
    const ticker = String(req.params.ticker || "").trim().toUpperCase();
    if (!ticker) {
      return sendError(res, req.correlationId, "INVALID_TICKER", new Error("Ticker is required"), 400);
    }

    const lookup = provider.lookupTicker(ticker);
    if (!lookup) {
      return sendError(
        res,
        req.correlationId,
        "UNKNOWN_TICKER",
        new Error(`Ticker "${ticker}" not found in provider directory. Use GET /api/v1/tickers for available tickers.`),
        404,
      );
    }

    const evidence = provider.getEvidence(ticker);
    if (!evidence) {
      return sendError(res, req.correlationId, "NO_EVIDENCE", new Error(`No evidence available for "${ticker}"`), 404);
    }

    const methodologyId = req.query.methodology || "aaoifi-placeholder";
    const result = screenCompany(evidence, { methodologyId });

    res.json({
      success: true,
      correlation_id: req.correlationId,
      demo: provider.isDemo,
      data: result,
    });
  });

  return app;
}

function sendError(res, correlationId, code, error, status) {
  const message = error?.message || "Unexpected error";
  res.status(status).json({
    success: false,
    error: {
      code,
      message,
      correlation_id: correlationId,
    },
  });
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  const app = createApp();
  app.listen(PORT, () => {
    console.log(`Sharia Screening API running on http://localhost:${PORT}`);
  });
}
