import test from "node:test";
import assert from "node:assert/strict";
import { buildAnalyzePayload, isMobileLayout } from "../client/src/api.js";

test("buildAnalyzePayload coerces number fields", () => {
  const payload = buildAnalyzePayload({
    risk_tolerance: "aggressive",
    investment_horizon_years: "7",
    preferred_sectors: ["AI"],
    num_stocks_requested: "4",
    min_volume: "500000",
  });

  assert.equal(payload.investment_horizon_years, 7);
  assert.equal(payload.num_stocks_requested, 4);
  assert.equal(payload.min_volume, 500000);
});

test("isMobileLayout threshold", () => {
  assert.equal(isMobileLayout(960), true);
  assert.equal(isMobileLayout(961), false);
});
