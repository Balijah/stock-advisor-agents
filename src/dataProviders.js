// src/dataProviders.js
// Unified, 2025-optimized data layer for Athena Advisory
// Only two real dependencies: Polygon.io + Grok-4 real-time search

import { _inMemoryCache } from "./cache.js"; // ← CORRECT (keep same, but ensure cache.js exports correctly)
import { callGrokSearch } from "./grok.js";
const POLYGON_KEY = process.env.POLYGON_API_KEY;
if (process.env.LIVE_DATA === "true" && !POLYGON_KEY) {
  console.warn("LIVE_DATA=true but POLYGON_API_KEY missing → falling back to mock data");
}

const IS_LIVE = process.env.LIVE_DATA === "true" && POLYGON_KEY;
const FREE_TIER_MODE = process.env.FREE_TIER_MODE === "true";
const DETAIL_LOOKUP_LIMIT = FREE_TIER_MODE ? 25 : 60;
const NAME_LOOKUP_LIMIT = FREE_TIER_MODE ? 15 : 40;
const RANK_LOOKUP_LIMIT = FREE_TIER_MODE ? 30 : 600;
const DEFAULT_SCAN_LIMIT = Number.parseInt(process.env.MARKET_SCAN_LIMIT || "1000", 10);
const MIN_MARKET_CAP = Number.parseFloat(process.env.MIN_MARKET_CAP || "500000000");

const sectorAliases = {
  energy: [
    "energy",
    "oil",
    "gas",
    "midstream",
    "refining",
    "drilling",
    "pipelines",
    "power",
    "renewables",
    "renewable",
    "solar",
    "wind",
    "coal",
    "lng",
  ],
  healthcare: ["health", "healthcare", "biotech", "pharma", "medical", "devices", "hospitals"],
  utilities: ["utilities", "power", "electric", "water", "gas"],
};

function expandSectors(sectors) {
  const expanded = new Set();
  sectors.forEach((raw) => {
    const key = String(raw).toLowerCase();
    const aliases = sectorAliases[key] || [key];
    aliases.forEach((alias) => expanded.add(alias));
  });
  return Array.from(expanded);
}

function isEligibleExchange(exchange) {
  if (!exchange) return false;
  return exchange === "XNAS" || exchange === "XNYS";
}

function isCommonStock(type) {
  if (!type) return true;
  const lowered = String(type).toLowerCase();
  return lowered === "cs" || lowered.includes("common");
}

// Helper: robust fetch with retry + cache
async function _fetch(url, options = {}, retries = 3) {
  const cacheKey = `fetch:${url}`;
  if (_inMemoryCache.has(cacheKey)) return _inMemoryCache.get(cacheKey);

  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(url, { ...options, signal: AbortSignal.timeout(10000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      _inMemoryCache.set(cacheKey, data);
      return data;
    } catch (err) {
      if (i === retries) throw err;
      await new Promise(r => setTimeout(r, 300 * (i + 1)));
    }
  }
}

// 1. Market Candidates (entire US universe → filtered)
export async function fetchMarketCandidates({ sectors = [], minVolume = 500000, limit = 80 } = {}) {
  if (!IS_LIVE) {
    const mock = ["NVDA", "IONQ", "SMCI", "PLTR", "ARM", "CRWD", "ASML", "TSM", "AMD", "QCOM"];
    return sectors.length > 0 ? mock.filter(t => Math.random() > 0.5) : mock.slice(0, limit);
  }

  // Polygon Ticker List + Details (v3 reference)
  const url = `https://api.polygon.io/v3/reference/tickers?active=true&market=stocks&limit=1000&apiKey=${POLYGON_KEY}`;
  let data;
  try {
    data = await _fetch(url);
  } catch (err) {
    console.warn(`Polygon ticker list failed: ${err.message}`);
    return [];
  }

  let candidates = data.results || [];
  const unfiltered = candidates;
  if (!candidates.length) {
    console.warn("Polygon ticker list returned 0 results.");
  }

  // Apply sector filter if provided
  if (sectors.length > 0) {
    const sectorLower = expandSectors(sectors);
    candidates = candidates.filter((t) => {
      const fields = [
        t.sector,
        t.industry,
        t.sic_description,
        t.name,
      ]
        .filter(Boolean)
        .map((v) => String(v).toLowerCase());
      return sectorLower.some((s) => fields.some((f) => f.includes(s)));
    });
    if (candidates.length === 0) {
      const needsEnrichment = unfiltered.every(
        (t) => !t.sector && !t.industry && !t.sic_description
      );
      if (needsEnrichment) {
        const enriched = [];
        const sampleTickers = unfiltered
          .map((t) => t.ticker)
          .filter(Boolean)
          .slice(0, DETAIL_LOOKUP_LIMIT);
        for (const ticker of sampleTickers) {
          try {
            const detailUrl = `https://api.polygon.io/v3/reference/tickers/${ticker}?apiKey=${POLYGON_KEY}`;
            const detail = await _fetch(detailUrl);
            const info = detail?.results || {};
            enriched.push({
              ...info,
              ticker,
            });
          } catch (err) {
            continue;
          }
        }
        const filtered = enriched.filter((t) => {
          const fields = [
            t.sector,
            t.industry,
            t.sic_description,
            t.name,
          ]
            .filter(Boolean)
            .map((v) => String(v).toLowerCase());
          return sectorLower.some((s) => fields.some((f) => f.includes(s)));
        });
        candidates = filtered.length ? filtered : unfiltered;
      } else {
        candidates = unfiltered;
      }
    }
  }

  // Rank by liquidity/size where possible
  const needsRanking = candidates.every((t) => t.market_cap == null);
  if (needsRanking) {
    const sampleTickers = candidates
      .map((t) => t.ticker)
      .filter(Boolean)
      .slice(0, RANK_LOOKUP_LIMIT);
    const enriched = [];
    for (const ticker of sampleTickers) {
      try {
        const detailUrl = `https://api.polygon.io/v3/reference/tickers/${ticker}?apiKey=${POLYGON_KEY}`;
        const detail = await _fetch(detailUrl);
        const info = detail?.results || {};
        enriched.push({
          ...info,
          ticker,
        });
      } catch (err) {
        continue;
      }
    }
    if (enriched.length) {
      candidates = enriched;
    }
  }

  candidates = candidates.filter((t) => isCommonStock(t.type));
  candidates = candidates.filter((t) => isEligibleExchange(t.primary_exchange));

  // Filter by liquidity
  const hasAvgVolume = candidates.some((t) => typeof t.avg_volume === "number");
  if (hasAvgVolume) {
    candidates = candidates
      .filter((t) => (t.avg_volume || 0) > minVolume)
      .sort((a, b) => (b.avg_volume || 0) - (a.avg_volume || 0));
  } else {
    candidates = candidates.sort((a, b) => (b.market_cap || 0) - (a.market_cap || 0));
  }

  candidates = candidates.filter((t) => (t.market_cap || 0) >= MIN_MARKET_CAP);

  if (hasAvgVolume) {
    candidates = candidates.sort((a, b) => {
      const capScore = (b.market_cap || 0) - (a.market_cap || 0);
      if (capScore !== 0) return capScore;
      return (b.avg_volume || 0) - (a.avg_volume || 0);
    });
  }

  const scanLimit = Number.isFinite(limit) ? limit : DEFAULT_SCAN_LIMIT;
  return candidates.slice(0, scanLimit).map((t) => t.ticker);
}

export async function lookupTickerNames(tickers = []) {
  if (!IS_LIVE || !tickers.length) return {};
  const limited = tickers.slice(0, NAME_LOOKUP_LIMIT);
  const names = Object.create(null);
  for (const ticker of limited) {
    try {
      const detailUrl = `https://api.polygon.io/v3/reference/tickers/${ticker}?apiKey=${POLYGON_KEY}`;
      const detail = await _fetch(detailUrl);
      const info = detail?.results || {};
      if (info.name) names[ticker] = info.name;
    } catch (err) {
      continue;
    }
  }
  return names;
}

// 2. Fundamentals (key metrics only)
export async function fetchFundamentals(ticker) {
  if (!IS_LIVE) {
    return {
      ticker,
      marketCap: 1e11 + Math.random() * 1e12,
      peRatio: 15 + Math.random() * 50,
      forwardPE: 20 + Math.random() * 40,
      eps: 2 + Math.random() * 10,
      revenueGrowth: -0.2 + Math.random() * 0.6,
      debtToEquity: Math.random() * 2,
      insiderOwnership: 0.01 + Math.random() * 0.2,
    };
  }

  const endpoints = [
    `https://api.polygon.io/v3/reference/financials?ticker=${ticker}&limit=1&apiKey=${POLYGON_KEY}`,
    `https://api.polygon.io/vX/reference/financials?ticker=${ticker}&limit=1&apiKey=${POLYGON_KEY}`,
    `https://api.polygon.io/v2/reference/financials?ticker=${ticker}&limit=1&apiKey=${POLYGON_KEY}`,
  ];

  let data = null;
  for (const url of endpoints) {
    try {
      data = await _fetch(url);
      if (data?.results?.length) break;
    } catch (err) {
      if (!err?.message?.includes("HTTP 404")) throw err;
    }
  }

  let fallbackInfo = null;
  try {
    const fallback = await _fetch(
      `https://api.polygon.io/v3/reference/tickers/${ticker}?apiKey=${POLYGON_KEY}`
    );
    fallbackInfo = fallback?.results || null;
  } catch (_err) {
    fallbackInfo = null;
  }

  if (!data?.results?.length) {
    return {
      ticker,
      marketCap: fallbackInfo?.market_cap ?? null,
      peRatio: fallbackInfo?.weighted_shares_outstanding
        ? fallbackInfo.market_cap / fallbackInfo.weighted_shares_outstanding
        : null,
      revenueGrowth: null,
      earningsGrowth: null,
      returnOnEquity: null,
      debtToEquity: null,
    };
  }

  const result = data.results?.[0] || {};
  const financials = result.financials || {};
  const income = financials.income_statement || {};
  const balance = financials.balance_sheet || {};
  const ratios = financials.ratios || {};
  const revenue = income.revenue?.value ?? income.revenue;
  const eps = income.basic_earnings_per_share?.value ?? income.basic_earnings_per_share;
  const marketCap =
    balance.market_capitalization?.value ??
    result.market_cap ??
    null;

  return {
    ticker,
    marketCap: marketCap ?? fallbackInfo?.market_cap ?? null,
    peRatio:
      revenue && eps
        ? revenue / (eps * 1e6)
        : ratios.price_earnings_ratio?.value ??
          (fallbackInfo?.weighted_shares_outstanding
            ? fallbackInfo.market_cap / fallbackInfo.weighted_shares_outstanding
            : null),
    revenueGrowth:
      income.revenue_growth?.value ?? income.revenue_growth ?? ratios.revenue_growth?.value ?? null,
    earningsGrowth:
      income.net_income_growth?.value ?? income.net_income_growth ?? ratios.earnings_growth?.value ?? null,
    returnOnEquity:
      ratios.return_on_equity?.value ??
      balance.return_on_equity?.value ??
      null,
    debtToEquity:
      balance.debt_to_equity_ratio?.value ??
      balance.debt_to_equity_ratio ??
      ratios.debt_to_equity_ratio?.value ??
      null,
  };
}

// 3. Technical Indicators (via Polygon aggregates + calculation)
export async function fetchTechnicalIndicators(ticker, days = 365) {
  if (!IS_LIVE) {
    const hash = [...ticker].reduce((sum, c) => sum + c.charCodeAt(0), 0);
    const base = (hash % 100) / 100;
    const price = 120 + base * 180;
    const atr = price * (0.01 + (base % 0.04));
    return {
      ticker,
      rsi: 35 + base * 35,
      macd: base > 0.5 ? 1.2 : -0.8,
      atr,
      atr_pct: atr / price,
      momentum_3m: (base - 0.5) * 0.3,
      sma50: price * 0.98,
      sma200: price * 0.94,
      price,
      volume: Math.round(1e6 + base * 8e7),
    };
  }

  const to = Math.floor(Date.now() / 1000);
  const from = to - days * 24 * 60 * 60;

  const url = `https://api.polygon.io/v2/aggs/ticker/${ticker}/range/1/day/${from}/${to}?adjusted=true&apiKey=${POLYGON_KEY}`;
  const data = await _fetch(url);

  const closes = data.results?.map(d => d.c) || [];
  if (closes.length < 50) return null;

  // Simple RSI (you can plug in ta-lib later)
  const rsi = calculateRSI(closes.slice(-14));
  const atr = calculateATR(data.results.slice(-14));
  const price = closes[closes.length - 1];
  const atr_pct = price ? atr / price : 0;
  const lookback = 63;
  const momentum_3m =
    closes.length > lookback
      ? price / closes[closes.length - 1 - lookback] - 1
      : 0;

  return {
    ticker,
    price,
    rsi,
    atr,
    atr_pct,
    momentum_3m,
    sma50: sma(closes, 50),
    sma200: sma(closes, 200),
    volume: data.results[data.results.length - 1]?.v || 0,
  };
}

// 4. Current VIX (critical for risk regime)
export async function fetchVIX() {
  if (!IS_LIVE) return 12 + Math.random() * 20;
  const url = `https://api.polygon.io/v2/aggs/ticker/^VIX/prev?apiKey=${POLYGON_KEY}`;
  try {
    const data = await _fetch(url);
    return data.results?.[0]?.c || 18;
  } catch (err) {
    if (err?.message?.includes("HTTP 429")) {
      return 12 + Math.random() * 20;
    }
    throw err;
  }
}

function toIsoDate(date) {
  return date.toISOString().split("T")[0];
}

function calcDateRange(days) {
  const now = new Date();
  const from = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  return { from: toIsoDate(from), to: toIsoDate(now) };
}

export async function searchXInfluentialPosts({
  ticker,
  topic,
  days = 7,
  min_engagement = 50,
}) {
  const { from, to } = calcDateRange(days);
  const queryParts = [
    `${ticker} stock`,
    topic ? `"${topic}"` : null,
    `min_faves:${min_engagement}`,
    `since:${from}`,
    `until:${to}`,
  ].filter(Boolean);
  const query = queryParts.join(" ");
  const prompt = [
    "Search X for influential posts about the ticker and summarize the sentiment.",
    `Query: ${query}`,
    "Return 3-5 bullets with a short summary per bullet.",
  ].join("\n");

  return callGrokSearch(prompt, {
    max_tokens: 320,
    search_parameters: {
      mode: "on",
      sources: [{ type: "x" }],
      max_search_results: 10,
      from_date: from,
      to_date: to,
      return_citations: true,
    },
  });
}

export async function searchFinancialSubreddits({
  ticker,
  topic,
  days = 7,
  min_upvotes = 30,
  limit = 15,
}) {
  const { from, to } = calcDateRange(days);
  const queryParts = [
    `${ticker} stock`,
    topic ? `"${topic}"` : null,
    "site:reddit.com/r/",
  ].filter(Boolean);
  const query = queryParts.join(" ");
  const prompt = [
    "Search Reddit for recent posts about the ticker and summarize the sentiment.",
    `Query: ${query}`,
    `Consider recency (${from} to ${to}) and engagement (min upvotes ~${min_upvotes}).`,
    `Return up to ${Math.min(limit, 5)} bullets with a short summary per bullet.`,
  ].join("\n");

  return callGrokSearch(prompt, {
    max_tokens: 320,
    search_parameters: {
      mode: "on",
      sources: [{ type: "web" }, { type: "news" }],
      max_search_results: Math.max(5, Math.min(limit, 15)),
      from_date: from,
      to_date: to,
      return_citations: true,
      allowed_websites: ["reddit.com"],
    },
  });
}

// 5. Real-time News & Sentiment via Grok-4 (FREE + BEST)
export const grokTools = {
  search_x_influential_posts: {
    name: "search_x_influential_posts",
    description: "Real-time search of influential X (Twitter) posts about stocks, earnings, insider moves, etc.",
    parameters: {
      type: "object",
      properties: {
        ticker: { type: "string" },
        topic: { type: "string" },
        days: { type: "integer", enum: [1, 3, 7], default: 7 },
        min_engagement: { type: "integer", default: 50 }
      },
      required: ["ticker"]
    }
  },

  search_financial_subreddits: {
    name: "search_financial_subreddits",
    description: "Real-time search of r/wallstreetbets, r/stocks, r/investing, r/SecurityAnalysis, etc.",
    parameters: {
      type: "object",
      properties: {
        ticker: { type: "string" },
        topic: { type: "string" },
        days: { type: "integer", enum: [1, 3, 7, 14], default: 7 },
        min_upvotes: { type: "integer", default: 30 },
        limit: { type: "integer", default: 15 }
      },
      required: ["ticker"]
    }
  }
};

// Simple TA helpers
function sma(arr, period) {
  if (arr.length < period) return null;
  return arr.slice(-period).reduce((a, b) => a + b, 0) / period;
}

function calculateRSI(prices, period = 14) {
  let gains = 0, losses = 0;
  for (let i = 1; i < prices.length; i++) {
    const diff = prices[i] - prices[i - 1];
    if (diff > 0) gains += diff;
    else losses -= diff;
  }
  const avgGain = gains / period;
  const avgLoss = losses / period;
  const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

function calculateATR(days) {
  if (!Array.isArray(days) || days.length < 2) return 0;
  const ranges = [];
  for (let i = 1; i < days.length; i += 1) {
    const curr = days[i];
    const prev = days[i - 1];
    const high = Number(curr?.h ?? 0);
    const low = Number(curr?.l ?? 0);
    const prevClose = Number(prev?.c ?? 0);
    const tr = Math.max(
      high - low,
      Math.abs(high - prevClose),
      Math.abs(low - prevClose)
    );
    ranges.push(tr);
  }
  if (!ranges.length) return 0;
  return ranges.reduce((sum, v) => sum + v, 0) / ranges.length;
}
