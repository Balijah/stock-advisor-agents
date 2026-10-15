import test from "node:test";
import assert from "node:assert/strict";
import { extractOpenAIText } from "../src/llm.js";

const realisticResponseFixture = {
  id: "resp_abc123",
  object: "response",
  created_at: 1720000000,
  status: "completed",
  output: [
    {
      type: "message",
      id: "msg_001",
      status: "completed",
      role: "assistant",
      content: [
        {
          type: "output_text",
          text: "NVIDIA (NVDA) shows strong momentum driven by AI demand.",
          annotations: [
            { type: "url_citation", url: "https://example.com/nvda-analysis" },
          ],
        },
      ],
    },
  ],
};

const outputTextShortcutFixture = {
  id: "resp_def456",
  object: "response",
  created_at: 1720000001,
  status: "completed",
  output_text: "Short summary via output_text field.",
  output: [
    {
      type: "message",
      id: "msg_002",
      status: "completed",
      role: "assistant",
      content: [
        {
          type: "output_text",
          text: "Short summary via output_text field.",
          annotations: [],
        },
      ],
    },
  ],
};

const multiBlockFixture = {
  id: "resp_ghi789",
  object: "response",
  created_at: 1720000002,
  status: "completed",
  output: [
    {
      type: "web_search_call",
      id: "ws_001",
      status: "completed",
    },
    {
      type: "message",
      id: "msg_003",
      status: "completed",
      role: "assistant",
      content: [
        {
          type: "output_text",
          text: "First paragraph about AAPL. ",
          annotations: [
            { type: "url_citation", url: "https://example.com/aapl" },
          ],
        },
        {
          type: "output_text",
          text: "Second paragraph with more detail.",
          annotations: [],
        },
      ],
    },
  ],
};

test("extractOpenAIText extracts text from nested output[].content[] when output_text is absent", () => {
  const text = extractOpenAIText(realisticResponseFixture);
  assert.equal(text, "NVIDIA (NVDA) shows strong momentum driven by AI demand.");
});

test("extractOpenAIText prefers top-level output_text when present", () => {
  const text = extractOpenAIText(outputTextShortcutFixture);
  assert.equal(text, "Short summary via output_text field.");
});

test("extractOpenAIText concatenates multiple content blocks", () => {
  const text = extractOpenAIText(multiBlockFixture);
  assert.ok(text.includes("First paragraph about AAPL."));
  assert.ok(text.includes("Second paragraph with more detail."));
});

test("extractOpenAIText returns empty string for empty/missing data", () => {
  assert.equal(extractOpenAIText({}), "");
  assert.equal(extractOpenAIText(null), "");
  assert.equal(extractOpenAIText({ output: [] }), "");
  assert.equal(extractOpenAIText({ output: [{ type: "web_search_call" }] }), "");
});
