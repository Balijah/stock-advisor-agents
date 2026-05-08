import dotenv from "dotenv";

dotenv.config({ path: new URL("../.env", import.meta.url) });

const FAST_MODEL = process.env.FAST_MODEL || "gpt-4o-mini";
const DEEP_MODEL = process.env.DEEP_MODEL || "gpt-4o";
const REASONING_MODEL = process.env.REASONING_MODEL || "claude-3-7-sonnet-latest";

async function callOpenAIResponses(prompt, { model, temperature, max_tokens, tools }) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY missing in env");
  }

  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      input: prompt,
      temperature,
      max_output_tokens: max_tokens,
      ...(Array.isArray(tools) && tools.length ? { tools } : {}),
    }),
  });

  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  const text = (data.output_text || "").trim();
  const citations = extractOpenAICitations(data);
  return { text, citations };
}

async function callAnthropicMessages(prompt, { model, max_tokens }) {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY missing in env");
  }

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  const text = Array.isArray(data?.content)
    ? data.content.map((c) => (c?.type === "text" ? c.text : "")).join(" ")
    : "";
  return text.trim();
}

async function runLLM({ prompt, model, temperature = 0.2, max_tokens = 400 }) {
  const modelId = String(model || "");
  if (modelId.startsWith("anthropic/") || modelId.startsWith("claude-")) {
    const normalized = modelId.includes("/") ? modelId.split("/").pop() : modelId;
    const text = await callAnthropicMessages(prompt, { model: normalized, max_tokens });
    return { text, citations: [] };
  }

  const normalized = modelId.includes("/") ? modelId.split("/").pop() : modelId;
  return callOpenAIResponses(prompt, { model: normalized, temperature, max_tokens });
}

export async function llmFast(prompt, options = {}) {
  const out = await runLLM({ prompt, model: FAST_MODEL, ...options });
  return out.text;
}

export async function llmDeep(prompt, options = {}) {
  const out = await runLLM({ prompt, model: DEEP_MODEL, ...options });
  return out.text;
}

export async function llmReasoning(prompt, options = {}) {
  const out = await runLLM({ prompt, model: REASONING_MODEL, ...options });
  return out.text;
}

export async function llmWebResearch(prompt, options = {}) {
  const model = options.model || FAST_MODEL;
  const modelId = String(model || "");
  if (modelId.startsWith("anthropic/") || modelId.startsWith("claude-")) {
    const text = await llmFast(prompt, options);
    return { text, citations: [] };
  }
  const normalized = modelId.includes("/") ? modelId.split("/").pop() : modelId;
  return callOpenAIResponses(prompt, {
    model: normalized,
    temperature: options.temperature ?? 0.2,
    max_tokens: options.max_tokens ?? 400,
    tools: [{ type: "web_search_preview" }],
  });
}

export function tryParseJson(text, fallback = null) {
  try {
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}

function extractOpenAICitations(data) {
  const urls = new Set();
  const output = Array.isArray(data?.output) ? data.output : [];
  output.forEach((item) => {
    const content = Array.isArray(item?.content) ? item.content : [];
    content.forEach((c) => {
      const annotations = Array.isArray(c?.annotations) ? c.annotations : [];
      annotations.forEach((a) => {
        const u = a?.url || a?.source?.url || a?.citation?.url;
        if (typeof u === "string" && u.startsWith("http")) urls.add(u);
      });
    });
  });
  return Array.from(urls);
}
