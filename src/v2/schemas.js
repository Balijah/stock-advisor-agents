import { z } from "zod";

export const analyzeRequestSchema = z.object({
  risk_tolerance: z.enum(["aggressive", "neutral", "conservative"]).default("neutral"),
  investment_horizon_years: z.number().min(0.02).max(20).default(5),
  preferred_sectors: z.array(z.string()).default([]),
  num_stocks_requested: z.number().int().min(1).max(10).default(5),
  min_volume: z.number().int().min(0).default(500000),
});

export const portfolioItemSchema = z.object({
  ticker: z.string(),
  name: z.string(),
  allocation_pct: z.number(),
  confidence: z.number().min(0).max(1),
  score: z.number(),
  thesis: z.string(),
  key_signals: z.array(z.string()),
  risk_flags: z.array(z.string()),
  citations: z.array(z.string()),
});

export const analyzeResponseSchema = z.object({
  run_id: z.string(),
  as_of: z.string(),
  market_regime: z.enum(["normal", "elevated_volatility"]),
  portfolio: z.array(portfolioItemSchema),
  summary: z.string(),
  warnings: z.array(z.string()),
  transcript_ref: z.string(),
  degraded_mode: z.boolean(),
  transcript: z.array(
    z.object({
      timestamp: z.string(),
      stage: z.string(),
      message: z.string(),
    })
  ),
  diagnostics: z.object({
    stage_warnings: z.array(z.string()),
    provider_health: z.record(z.string(), z.boolean()),
  }),
});

export const apiErrorSchema = z.object({
  success: z.literal(false),
  error: z.object({
    code: z.string(),
    message: z.string(),
    correlation_id: z.string(),
    details: z.unknown().optional(),
  }),
});

export function parseAnalyzeRequest(payload) {
  return analyzeRequestSchema.parse(payload);
}
