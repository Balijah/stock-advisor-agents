import test from "node:test";
import assert from "node:assert/strict";
import { allocateWeights, applyRisk, MAX_SINGLE_ALLOCATION } from "../src/v2/lib/risk.js";

test("applyRisk triggers conservative veto with high vix", () => {
  const out = applyRisk({
    ranked: [{ ticker: "A", score: 90 }, { ticker: "B", score: 80 }],
    technicalsByTicker: { A: { atr_pct: 0.03 }, B: { atr_pct: 0.02 } },
    vixLevel: 35,
  });
  assert.equal(out.veto, true);
  assert.equal(out.marketRegime, "elevated_volatility");
});

test("allocateWeights normalizes and applies max cap", () => {
  const allocated = allocateWeights([
    { ticker: "A", raw_weight: 0.9 },
    { ticker: "B", raw_weight: 0.05 },
    { ticker: "C", raw_weight: 0.03 },
    { ticker: "D", raw_weight: 0.02 },
  ]);
  const total = allocated.reduce((sum, i) => sum + i.allocation_pct, 0);
  assert.ok(total >= 99.5 && total <= 100);
  allocated.forEach((row) => assert.ok(row.allocation_pct <= MAX_SINGLE_ALLOCATION));
});
