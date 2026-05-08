import test from "node:test";
import assert from "node:assert/strict";
import { runAdvisoryV2 } from "../src/v2/advisoryEngine.js";

test("candidate stats are present and coherent", async () => {
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
