import test from "node:test";
import assert from "node:assert/strict";
import { buildConfidence, scoreTicker } from "../src/v2/lib/scoring.js";

test("scoreTicker returns deterministic weighted score", () => {
  const one = scoreTicker({
    ticker: "NVDA",
    fundamentals: { revenueGrowth: 0.22, earningsGrowth: 0.18, returnOnEquity: 0.31, marketCap: 2e12 },
    technicals: { rsi: 58, sma50: 120, sma200: 110, momentum_3m: 0.17, atr_pct: 0.03 },
    sentimentText: "bullish upside beat",
  });
  const two = scoreTicker({
    ticker: "NVDA",
    fundamentals: { revenueGrowth: 0.22, earningsGrowth: 0.18, returnOnEquity: 0.31, marketCap: 2e12 },
    technicals: { rsi: 58, sma50: 120, sma200: 110, momentum_3m: 0.17, atr_pct: 0.03 },
    sentimentText: "bullish upside beat",
  });

  assert.equal(one.score, two.score);
  assert.ok(one.score > 60);
});

test("confidence accounts for volatility regime and warnings", () => {
  const high = buildConfidence({
    technicals: { sma50: 100, sma200: 95 },
    fundamentals: { revenueGrowth: 0.2 },
    socialSnippets: ["beat"],
    marketRegime: "normal",
    warningsCount: 0,
  });
  const low = buildConfidence({
    technicals: { sma50: 90, sma200: 100 },
    fundamentals: { revenueGrowth: -0.1 },
    socialSnippets: [],
    marketRegime: "elevated_volatility",
    warningsCount: 5,
  });

  assert.ok(high > low);
  assert.ok(low >= 0.05);
});
