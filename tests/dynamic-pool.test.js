import test from "node:test";
import assert from "node:assert/strict";
import { runAdvisoryV2 } from "../src/v2/advisoryEngine.js";

const hasKeys = Boolean(process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY);

test("candidate stats are present and coherent", { skip: !hasKeys && "requires OPENAI_API_KEY or ANTHROPIC_API_KEY" }, async () => {
  const out = await runAdvisoryV2({
    risk_tolerance: "neutral",
    investment_horizon_years: 5,
    preferred_sectors: [],
    num_stocks_requested: 5,
    min_volume: 500000,
  });

  assert.ok(out.diagnostics.candidate_stats.discovered_count > 0);
  assert.ok(out.diagnostics.candidate_stats.validated_count > 0);
  assert.ok(out.diagnostics.stage_statuses.candidate_discovery);
  assert.ok(out.diagnostics.stage_statuses.candidate_validation);
});

test("runAdvisoryV2 produces valid run_id", { skip: !hasKeys && "requires OPENAI_API_KEY or ANTHROPIC_API_KEY" }, async () => {
  const out = await runAdvisoryV2({
    risk_tolerance: "conservative",
    investment_horizon_years: 3,
    preferred_sectors: ["Healthcare"],
    num_stocks_requested: 2,
    min_volume: 500000,
  });

  assert.ok(/^[0-9a-f]{16}$/.test(out.run_id));
  assert.ok(out.as_of);
});
