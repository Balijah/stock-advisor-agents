import { llmFast, llmWebResearch } from "./llm.js";

export const baseUniverse = [
  { ticker: "NVDA", name: "NVIDIA", sector: "AI" },
  { ticker: "MSFT", name: "Microsoft", sector: "Technology" },
  { ticker: "GOOGL", name: "Alphabet", sector: "AI" },
  { ticker: "AMZN", name: "Amazon", sector: "Consumer Discretionary" },
  { ticker: "AAPL", name: "Apple", sector: "Technology" },
  { ticker: "AMD", name: "AMD", sector: "Semiconductors" },
  { ticker: "ASML", name: "ASML", sector: "Semiconductors" },
  { ticker: "TSM", name: "TSMC", sector: "Semiconductors" },
  { ticker: "PLTR", name: "Palantir", sector: "AI" },
  { ticker: "CRWD", name: "CrowdStrike", sector: "Cybersecurity" },
  { ticker: "IONQ", name: "IonQ", sector: "Quantum Computing" },
  { ticker: "SMCI", name: "Super Micro", sector: "AI" },
  { ticker: "JNJ", name: "Johnson & Johnson", sector: "Healthcare" },
  { ticker: "LLY", name: "Eli Lilly", sector: "Healthcare" },
  { ticker: "UNH", name: "UnitedHealth Group", sector: "Healthcare" },
  { ticker: "PFE", name: "Pfizer", sector: "Healthcare" },
  { ticker: "PG", name: "Procter & Gamble", sector: "Consumer Staples" },
  { ticker: "KO", name: "Coca-Cola", sector: "Consumer Staples" },
  { ticker: "PEP", name: "PepsiCo", sector: "Consumer Staples" },
  { ticker: "WMT", name: "Walmart", sector: "Consumer Staples" },
  { ticker: "XOM", name: "Exxon Mobil", sector: "Energy" },
  { ticker: "CVX", name: "Chevron", sector: "Energy" },
  { ticker: "NEE", name: "NextEra Energy", sector: "Utilities" },
  { ticker: "DUK", name: "Duke Energy", sector: "Utilities" },
  { ticker: "JPM", name: "JPMorgan Chase", sector: "Financials" },
  { ticker: "BAC", name: "Bank of America", sector: "Financials" },
  { ticker: "CAT", name: "Caterpillar", sector: "Industrials" },
  { ticker: "UNP", name: "Union Pacific", sector: "Industrials" },
  { ticker: "AMT", name: "American Tower", sector: "Real Estate" },
  { ticker: "PLD", name: "Prologis", sector: "Real Estate" },
  { ticker: "LIN", name: "Linde", sector: "Materials" },
  { ticker: "APD", name: "Air Products and Chemicals", sector: "Materials" },
  { ticker: "MCD", name: "McDonald's", sector: "Consumer Discretionary" },
  { ticker: "HD", name: "Home Depot", sector: "Consumer Discretionary" },
];

export const sectorAliases = {
  ai: ["ai", "technology"],
  semiconductors: ["semiconductors", "technology"],
  healthcare: ["healthcare"],
  energy: ["energy"],
  utilities: ["utilities"],
  financials: ["financials"],
  industrials: ["industrials"],
  "consumer staples": ["consumer staples"],
  "consumer discretionary": ["consumer discretionary"],
  "real estate": ["real estate"],
  materials: ["materials"],
  technology: ["technology", "ai", "semiconductors"],
};

function seedFromTicker(ticker) {
  return [...ticker].reduce((sum, c) => sum + c.charCodeAt(0), 0);
}

function deterministicRange(seed, min, max) {
  const ratio = (seed % 1000) / 1000;
  return min + (max - min) * ratio;
}

export async function fetchMarketCandidates({ sectors = [], limit = 80 } = {}) {
  const lower = sectors.map((s) => s.toLowerCase());
  const expanded = new Set();
  lower.forEach((s) => {
    (sectorAliases[s] || [s]).forEach((alias) => expanded.add(alias));
  });
  const filtered = lower.length
    ? baseUniverse.filter((s) => expanded.has(s.sector.toLowerCase()))
    : baseUniverse;
  return filtered.slice(0, Math.min(limit, filtered.length)).map((s) => s.ticker);
}

export async function lookupTickerNames(tickers = []) {
  const names = Object.create(null);
  tickers.forEach((t) => {
    const hit = baseUniverse.find((b) => b.ticker === t);
    if (hit) names[t] = hit.name;
  });
  return names;
}

export async function fetchFundamentals(ticker) {
  const seed = seedFromTicker(ticker);
  return {
    ticker,
    marketCap: Math.round(deterministicRange(seed, 5e9, 2.5e12)),
    peRatio: Number(deterministicRange(seed + 11, 12, 55).toFixed(2)),
    revenueGrowth: Number(deterministicRange(seed + 17, -0.08, 0.45).toFixed(3)),
    earningsGrowth: Number(deterministicRange(seed + 23, -0.1, 0.5).toFixed(3)),
    returnOnEquity: Number(deterministicRange(seed + 31, 0.05, 0.45).toFixed(3)),
    debtToEquity: Number(deterministicRange(seed + 41, 0.05, 1.7).toFixed(3)),
  };
}

export async function fetchTechnicalIndicators(ticker) {
  const seed = seedFromTicker(ticker);
  const price = deterministicRange(seed + 3, 30, 420);
  const atr = price * deterministicRange(seed + 5, 0.01, 0.08);
  const sma200 = price * deterministicRange(seed + 7, 0.85, 1.05);
  const sma50 = price * deterministicRange(seed + 13, 0.9, 1.1);
  return {
    ticker,
    price: Number(price.toFixed(2)),
    rsi: Number(deterministicRange(seed + 19, 30, 75).toFixed(2)),
    atr: Number(atr.toFixed(2)),
    atr_pct: Number((atr / price).toFixed(4)),
    sma50: Number(sma50.toFixed(2)),
    sma200: Number(sma200.toFixed(2)),
    momentum_3m: Number(deterministicRange(seed + 29, -0.25, 0.45).toFixed(3)),
    volume: Math.round(deterministicRange(seed + 37, 750000, 50000000)),
  };
}

export async function fetchVIX() {
  return 18;
}

export async function searchXInfluentialPosts({ ticker }) {
  if (!process.env.OPENAI_API_KEY && !process.env.ANTHROPIC_API_KEY) {
    throw new Error("OPENAI_API_KEY or ANTHROPIC_API_KEY required for social/news synthesis");
  }
  const prompt = `Find recent reputable sources about ${ticker} stock sentiment and catalysts. Summarize in 2 short bullets.`;
  const { text, citations } = await llmWebResearch(prompt, { max_tokens: 220, temperature: 0.2 });
  return { text, citations: citations.length ? citations : extractUrls(text) };
}

export async function searchFinancialSubreddits({ ticker }) {
  if (!process.env.OPENAI_API_KEY && !process.env.ANTHROPIC_API_KEY) {
    throw new Error("OPENAI_API_KEY or ANTHROPIC_API_KEY required for social/news synthesis");
  }
  const prompt = `Find recent discussions and news context relevant to ${ticker} sentiment. Return 2 concise bullets.`;
  const { text, citations } = await llmWebResearch(prompt, { max_tokens: 220, temperature: 0.2 });
  return { text, citations: citations.length ? citations : extractUrls(text) };
}

export const grokTools = {};

function extractUrls(text = "") {
  const matches = text.match(/https?:\/\/[^\s)]+/g) || [];
  return Array.from(new Set(matches));
}
