import test from "node:test";
import assert from "node:assert/strict";
import { candidateDiscoveryAgent } from "../src/v2/agents.js";

test("candidate discovery tolerates non-strict JSON output", async () => {
  const ctx = {
    user_input: { preferred_sectors: ["Healthcare"] },
    artifacts: {},
  };

  const originalFetch = global.fetch;
  const originalKey = process.env.OPENAI_API_KEY;
  global.fetch = async () => ({
    ok: true,
    json: async () => ({ output_text: "```json\n[{\"ticker\":\"LLY\",\"reason\":\"growth\"}]\n```", output: [] }),
  });
  process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || "test-key";

  try {
    const out = await candidateDiscoveryAgent(ctx);
    assert.equal(out.status, "success");
    assert.ok(ctx.artifacts.discovered_candidates.some((x) => x.ticker === "LLY"));
  } finally {
    global.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = originalKey;
  }
});
