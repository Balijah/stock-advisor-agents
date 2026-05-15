import crypto from "crypto";
import { analyzeResponseSchema } from "./schemas.js";
import { persistRun } from "./persistence.js";
import { buildAgentRegistry } from "./agentRegistry.js";
import { Coordinator, runStage } from "./coordinator.js";

export async function runAdvisoryV2(userInput, options = {}) {
  const runId = options.runId || crypto.randomBytes(8).toString("hex");
  const coordinator = new Coordinator({ runId, userInput, emitEvent: options.emitEvent });
  const agents = buildAgentRegistry();
  coordinator.emitEvent({
    event_type: "run_started",
    stage: "run",
    status: "running",
    message: "Run started",
  });

  const stageOrder = [
    ["candidate_discovery", false],
    ["candidate_validation", true],
    ["enrich", false],
    ["score", true],
    ["risk_allocate", true],
    ["explain", true],
  ];

  for (const [stage, critical] of stageOrder) {
    if (coordinator.context.hard_failed) break;
    await runStage(coordinator, stage, agents[stage], { critical });
  }

  const warnings = coordinator.context.warnings;
  const risked = coordinator.context.artifacts.risked || { marketRegime: "normal", highVolTickers: [] };

  const result = {
    run_id: runId,
    as_of: new Date().toISOString(),
    market_regime: coordinator.context.artifacts.market_regime || "normal",
    portfolio: coordinator.context.artifacts.portfolio,
    summary: `Generated ${coordinator.context.artifacts.portfolio.length} recommendations under ${
      coordinator.context.artifacts.market_regime || "normal"
    } regime (VIX ${Number(coordinator.context.artifacts.macro?.vix_level || 18).toFixed(2)}).`,
    warnings:
      risked?.veto
        ? [...warnings, `Conservative veto triggered by VIX/ATR checks. High ATR tickers: ${risked.highVolTickers?.join(",") || "none"}`]
        : warnings,
    transcript_ref: `${runId}_state.v2.json`,
    degraded_mode: Boolean(warnings.length || coordinator.context.hard_failed),
    diagnostics: {
      stage_warnings: warnings,
      provider_health: coordinator.context.provider_health,
      stage_statuses: coordinator.context.stage_statuses,
      candidate_stats: coordinator.candidateStats(),
    },
    transcript: coordinator.context.transcript,
  };

  const parsed = analyzeResponseSchema.parse(result);
  persistRun(parsed);
  coordinator.emitEvent({
    event_type: coordinator.context.hard_failed ? "run_failed" : "run_completed",
    stage: "run",
    status: coordinator.context.hard_failed ? "failed" : "completed",
    message: coordinator.context.hard_failed ? "Run failed" : "Run completed",
    metrics: parsed.diagnostics?.candidate_stats || {},
  });
  return parsed;
}
