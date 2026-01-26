export async function callGrokChat(prompt, { model, temperature = 0.2, max_tokens = 400 } = {}) {
  const key = process.env.XAI_API_KEY;
  if (!key) throw new Error("XAI_API_KEY missing in env");

  const base = process.env.XAI_API_BASE || "https://api.x.ai/v1";
  const url = `${base}/chat/completions`;
  const modelId = model || process.env.GROK_MODEL || "grok-2";

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: modelId,
      messages: [{ role: "user", content: prompt }],
      temperature,
      max_tokens,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Grok API error ${res.status}: ${text}`);
  }

  const json = await res.json();
  const content = json?.choices?.[0]?.message?.content;
  if (typeof content === "string") return content.trim();
  return json.output ?? json.result ?? json.choices?.[0]?.text ?? JSON.stringify(json);
}

export async function callGrokSearch(
  prompt,
  {
    model,
    temperature = 0.2,
    max_tokens = 400,
    search_parameters = {},
  } = {}
) {
  const key = process.env.XAI_API_KEY;
  if (!key) throw new Error("XAI_API_KEY missing in env");

  const base = process.env.XAI_API_BASE || "https://api.x.ai";
  const url = `${base}/v1/chat/completions`;
  const modelId = model || process.env.GROK_MODEL || "grok-4-1-fast";

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: modelId,
      messages: [{ role: "user", content: prompt }],
      temperature,
      max_tokens,
      search_parameters,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Grok search error ${res.status}: ${text}`);
  }

  const json = await res.json();
  const content = json?.choices?.[0]?.message?.content;
  const text =
    typeof content === "string"
      ? content.trim()
      : json.output ?? json.result ?? json.choices?.[0]?.text ?? "";
  return {
    text: typeof text === "string" ? text.trim() : "",
    citations: Array.isArray(json?.citations) ? json.citations : [],
    usage: json?.usage || null,
  };
}
