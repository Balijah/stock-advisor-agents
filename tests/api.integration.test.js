import test from "node:test";
import assert from "node:assert/strict";
import { analyzeV2 } from "../src/v2/service.js";
import { parseAnalyzeRequest } from "../src/v2/schemas.js";

test("v2 analyze request/response contract", async () => {
  const payload = parseAnalyzeRequest({
    risk_tolerance: "neutral",
    investment_horizon_years: 5,
    preferred_sectors: ["Healthcare"],
    num_stocks_requested: 3,
    min_volume: 500000,
  });
  const result = await analyzeV2(payload);

  assert.ok(result.run_id);
  assert.ok(Array.isArray(result.portfolio));
  assert.equal(typeof result.degraded_mode, "boolean");
  assert.ok(result.portfolio.length <= 3);
  assert.ok(result.diagnostics.stage_statuses);
  assert.ok(result.diagnostics.candidate_stats);
});
