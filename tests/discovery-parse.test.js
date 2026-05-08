import test from "node:test";
import assert from "node:assert/strict";
import { candidateDiscoveryAgent } from "../src/v2/agents.js";

test("candidate discovery tolerates non-strict JSON output", async () => {
  const ctx = {
    user_input: { preferred_sectors: ["Healthcare"] },
    artifacts: {},
  };

  const originalFetch = global.fetch;
  global.fetch = async () => ({
    ok: true,
    json: async () => ({ output_text: "```json\n[{\"ticker\":\"LLY\",\"reason\":\"growth\"}]\n```", output: [] }),
  });

  const out = await candidateDiscoveryAgent(ctx);

  global.fetch = originalFetch;

  assert.equal(out.status, "success");
  assert.ok(ctx.artifacts.discovered_candidates.some((x) => x.ticker === "LLY"));
});
