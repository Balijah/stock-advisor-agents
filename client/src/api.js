const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:3001";

export async function screenTicker(ticker) {
  const res = await fetch(`${API_BASE}/api/v1/screen/${encodeURIComponent(ticker)}`);
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json?.error?.message || `Screening failed (${res.status})`);
  }
  return json;
}

export async function listTickers() {
  const res = await fetch(`${API_BASE}/api/v1/tickers`);
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json?.error?.message || "Failed to load tickers");
  }
  return json;
}

export async function fetchHealth() {
  const res = await fetch(`${API_BASE}/api/v1/health`);
  return res.json();
}
