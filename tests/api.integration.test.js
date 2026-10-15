import test from "node:test";
import assert from "node:assert/strict";
import { analyzeV2 } from "../src/v2/service.js";
import { parseAnalyzeRequest } from "../src/v2/schemas.js";

const hasKeys = Boolean(process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY);

test("v2 analyze request/response contract", { skip: !hasKeys && "requires OPENAI_API_KEY or ANTHROPIC_API_KEY" }, async () => {
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

test("v2 analyze request schema rejects invalid input", () => {
  assert.throws(() => parseAnalyzeRequest({ risk_tolerance: "yolo" }));
  assert.throws(() => parseAnalyzeRequest({ investment_horizon_years: -1 }));
  assert.throws(() => parseAnalyzeRequest({ num_stocks_requested: 999 }));
});

test("v2 analyze request schema applies defaults", () => {
  const payload = parseAnalyzeRequest({});
  assert.equal(payload.risk_tolerance, "neutral");
  assert.equal(payload.investment_horizon_years, 5);
  assert.deepEqual(payload.preferred_sectors, []);
  assert.equal(payload.num_stocks_requested, 5);
  assert.equal(payload.min_volume, 500000);
});
