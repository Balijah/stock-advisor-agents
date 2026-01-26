// src/llm.js
// LiteLLM-based helpers for unified LLM access.

import { callGrokChat } from "./grok.js";

const FAST_MODEL = process.env.FAST_MODEL || "gpt-4o-mini";
const DEEP_MODEL = process.env.DEEP_MODEL || "gpt-4o-mini";
const REASONING_MODEL = process.env.REASONING_MODEL || "gpt-4o";

async function getLiteLLM() {
  // Lazy import to avoid startup penalty if LLMs are not used.
  try {
    return await import("litellm");
  } catch (err) {
    throw new Error(
      "litellm package not found. Install with `npm install litellm` to enable LLM calls."
    );
  }
}

async function callOpenAIResponses(prompt, { model, temperature, max_tokens }) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error(
      "OPENAI_API_KEY missing. Set OPENAI_API_KEY in your environment or .env (no quotes)."
    );
  }
  const isO1Model = /^o1(\b|-)/.test(model);
  const supportsTemperature = !isO1Model;
  const body = {
    model,
    input: prompt,
    ...(isO1Model ? { text: { format: { type: "text" }, verbosity: "low" } } : {}),
    ...(isO1Model ? { reasoning: { effort: "low" } } : {}),
    ...(supportsTemperature ? { temperature } : {}),
    max_output_tokens: max_tokens,
  };

  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `OpenAI error: ${res.status}`);
  }
  const data = await res.json();
  const outputBlocks = Array.isArray(data?.output) ? data.output : [];
  const outputText =
    data?.output_text ||
    outputBlocks
      .flatMap((block) => (Array.isArray(block?.content) ? block.content : []))
      .map((item) => item?.text || item?.output_text || "")
      .join(" ")
      .trim() ||
    "";
  return outputText.trim();
}

export async function llmFast(prompt, options = {}) {
  return runLLM({ prompt, model: FAST_MODEL, ...options });
}

export async function llmDeep(prompt, options = {}) {
  return runLLM({ prompt, model: DEEP_MODEL, ...options });
}

export async function llmReasoning(prompt, options = {}) {
  return runLLM({ prompt, model: REASONING_MODEL, ...options });
}

async function runLLM({ prompt, model, temperature = 0.2, max_tokens = 400 }) {
  // Basic validation and helpful errors
  const modelId = typeof model === "string" ? model : "";
  const isProviderPrefixed = modelId.includes("/");
  const isGrokModel =
    modelId.startsWith("grok/") ||
    modelId.startsWith("xai/") ||
    modelId.startsWith("grok-");
  const isOpenAIModel = !isProviderPrefixed || modelId.startsWith("openai/");

  if (isGrokModel) {
    const normalized = modelId.includes("/") ? modelId.split("/").pop() : modelId;
    return callGrokChat(prompt, { model: normalized, temperature, max_tokens });
  }

  if (isOpenAIModel) {
    const normalized = modelId.includes("/") ? modelId.split("/").pop() : modelId;
    return callOpenAIResponses(prompt, {
      model: normalized,
      temperature,
      max_tokens,
    });
  }
  const { completion } = await getLiteLLM();
  try {
    const res = await completion({
      model,
      messages: [{ role: "user", content: prompt }],
      temperature,
      max_tokens,
    });
    return extractContent(res);
  } catch (err) {
    // Surface common causes more clearly
    if (
      err?.message?.includes("401") ||
      err?.message?.toLowerCase().includes("incorrect api key")
    ) {
      throw new Error("Authentication failed: OPENAI_API_KEY invalid or revoked.");
    }
    throw err;
  }
}

function extractContent(res) {
  const maybeChoice = res?.choices?.[0]?.message?.content;
  if (typeof maybeChoice === "string") return maybeChoice.trim();
  if (Array.isArray(maybeChoice)) {
    return maybeChoice.map((c) => c?.text ?? c).join(" ").trim();
  }
  return "";
}

export function tryParseJson(text, fallback = null) {
  try {
    return JSON.parse(text);
  } catch (_err) {
    return fallback;
  }
}
