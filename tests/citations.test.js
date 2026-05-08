import test from "node:test";
import assert from "node:assert/strict";
import { searchXInfluentialPosts } from "../src/dataProviders.js";

test("web research returns URL citations when available", async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => ({
    ok: true,
    json: async () => ({
      output_text: "Signal summary",
      output: [{ content: [{ annotations: [{ url: "https://example.com/source1" }] }] }],
    }),
  });

  process.env.OPENAI_API_KEY = "test-key";
  const out = await searchXInfluentialPosts({ ticker: "LLY" });
  global.fetch = originalFetch;

  assert.ok(out.citations.includes("https://example.com/source1"));
});
