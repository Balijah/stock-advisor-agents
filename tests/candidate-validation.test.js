import test from "node:test";
import assert from "node:assert/strict";
import { candidateValidationAgent } from "../src/v2/agents.js";

test("candidate validation dedupes and enforces sector", async () => {
  const ctx = {
    user_input: { preferred_sectors: ["Healthcare"] },
    artifacts: {
      discovered_candidates: [
        { ticker: " lLy ", reason: "healthcare growth" },
        { ticker: "LLY", reason: "duplicate" },
        { ticker: "MSFT", reason: "tech giant" },
      ],
      validated_candidates: [],
      rejected_candidates: [],
      tickers: [],
    },
  };

  const out = await candidateValidationAgent(ctx);
  assert.ok(out.metrics.validated_count >= 1);
  assert.ok(ctx.artifacts.tickers.includes("LLY"));
  assert.ok(!ctx.artifacts.tickers.includes("MSFT"));
  assert.ok(ctx.artifacts.rejected_candidates.some((r) => r.ticker === "MSFT"));
});
