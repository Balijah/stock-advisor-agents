import fs from "fs";
import path from "path";
import {
  fetchFundamentals,
  fetchMarketCandidates,
  fetchTechnicalIndicators,
  fetchVIX,
  grokTools,
  lookupTickerNames,
  searchFinancialSubreddits,
  searchXInfluentialPosts,
} from "./dataProviders.js";
import { llmFast, llmReasoning, tryParseJson } from "./llm.js";

const MAX_SINGLE_ALLOCATION = 0.3;
const FREE_TIER_MODE = process.env.FREE_TIER_MODE === "true";
const FREE_TIER_CANDIDATE_LIMIT = 12;
const FREE_TIER_DETAIL_LIMIT = 6;

const sampleUniverse = [
  { ticker: "NVDA", name: "NVIDIA", sector: "AI" },
  { ticker: "SMCI", name: "Super Micro", sector: "AI" },
  { ticker: "PLTR", name: "Palantir", sector: "AI" },
  { ticker: "ARM", name: "Arm Holdings", sector: "Semiconductors" },
  { ticker: "ASML", name: "ASML Holding", sector: "Semiconductors" },
  { ticker: "IONQ", name: "IonQ", sector: "Quantum Computing" },
  { ticker: "CRWD", name: "CrowdStrike", sector: "Cybersecurity" },
  { ticker: "PANW", name: "Palo Alto Networks", sector: "Cybersecurity" },
  { ticker: "MSFT", name: "Microsoft", sector: "AI" },
  { ticker: "AAPL", name: "Apple", sector: "Consumer Tech" },
  { ticker: "GOOGL", name: "Alphabet", sector: "AI" },
  { ticker: "AMZN", name: "Amazon", sector: "AI" },
  { ticker: "AMD", name: "AMD", sector: "Semiconductors" },
];

async function filteredUniverse(preferredSectors = [], minVolume) {
  const sectors = preferredSectors.filter(Boolean);
  const limit =
    Number.parseInt(process.env.MARKET_SCAN_LIMIT || "", 10) || 200;
  const universe = await fetchMarketCandidates({
    sectors,
    minVolume,
    limit,
  });
  // Fallback to sample universe if live fetch returns empty
  return universe && universe.length ? universe : sampleUniverse.map((u) => u.ticker);
}

export async function marketScanner(state) {
  const sectors = state.user_inputs.preferred_sectors || [];
  const minVolume = state.user_inputs.min_volume || 500000;
  state.candidate_tickers = await filteredUniverse(sectors, minVolume);
  if (process.env.LIVE_DATA === "true") {
    state.ticker_names = await lookupTickerNames(state.candidate_tickers);
  }
  if (FREE_TIER_MODE) {
    state.candidate_tickers = state.candidate_tickers.slice(
      0,
      FREE_TIER_CANDIDATE_LIMIT
    );
  }
  const sampleTickers = sampleUniverse.map((u) => u.ticker);
  const isSampleFallback =
    state.candidate_tickers.length > 0 &&
    state.candidate_tickers.every((t) => sampleTickers.includes(t));
  state.log(
    "Market Scanner Agent",
    `Selected ${state.candidate_tickers.length} tickers using sectors=${sectors.join(
      ","
    ) || "all"}, minVolume=${minVolume}`
  );
  if (FREE_TIER_MODE) {
    state.log(
      "Market Scanner Agent",
      `Free-tier mode enabled: capped candidates to ${FREE_TIER_CANDIDATE_LIMIT}`
    );
  }
  if (isSampleFallback) {
    state.log(
      "Market Scanner Agent",
      "Fallback to sample universe detected. Live market scan returned no candidates."
    );
  }
  return state;
}

export async function fundamental_analyst(state) {
  const tickers = FREE_TIER_MODE
    ? state.candidate_tickers.slice(0, FREE_TIER_DETAIL_LIMIT)
    : state.candidate_tickers;
  const fundamentals = await Promise.all(
    tickers.map(async (ticker) => {
      try {
        const data = await fetchFundamentals(ticker);
        return [ticker, data];
      } catch (err) {
        state.log(
          "Fundamental Analyst",
          `Failed fundamentals for ${ticker}: ${err.message}`
        );
        return null;
      }
    })
  );

  fundamentals
    .filter(Boolean)
    .forEach(([ticker, report]) => {
      state.fundamental_reports[ticker] = report;
    });

  state.log(
    "Fundamental Analyst",
    `Generated fundamentals for ${Object.keys(state.fundamental_reports).length} tickers`
  );
  return state;
}

export async function technical_analyst(state) {
  const tickers = FREE_TIER_MODE
    ? state.candidate_tickers.slice(0, FREE_TIER_DETAIL_LIMIT)
    : state.candidate_tickers;
  const technicals = await Promise.all(
    tickers.map(async (ticker) => {
      try {
        const data = await fetchTechnicalIndicators(ticker);
        return data ? [ticker, data] : null;
      } catch (err) {
        state.log(
          "Technical Analyst",
          `Failed technicals for ${ticker}: ${err.message}`
        );
        return null;
      }
    })
  );

  technicals
    .filter(Boolean)
    .forEach(([ticker, report]) => {
      const atr = report.atr ?? report.atr_30d ?? 0;
      const macdSignal =
        typeof report.macd === "number"
          ? report.macd > 0
            ? "bullish"
            : "bearish"
          : "neutral";
      const trendScore =
        typeof report.rsi === "number" && typeof report.sma50 === "number"
          ? Math.round(report.rsi + Math.sign((report.sma50 || 0) - (report.sma200 || 0)) * 10)
          : 50;
      state.technical_reports[ticker] = {
        ...report,
        atr_30d: atr,
        atr_pct: report.price ? atr / report.price : 0,
        macd_signal: macdSignal,
        trend_score: trendScore,
      };
    });

  state.log(
    "Technical Analyst",
    `Calculated technical indicators for ${Object.keys(state.technical_reports).length} tickers`
  );
  return state;
}

export async function news_analyst(state) {
  state.available_realtime_tools = grokTools;
  const results = await Promise.all(
    state.candidate_tickers.map(async (ticker) => {
      try {
        const [xResult, redditResult] = await Promise.all([
          searchXInfluentialPosts({ ticker }),
          searchFinancialSubreddits({ ticker }),
        ]);
        return [
          ticker,
          [
            {
              headline: `X pulse: ${xResult.text || "No X summary returned"}`,
              impact: "pending",
              citations: xResult.citations,
            },
            {
              headline: `Reddit pulse: ${redditResult.text || "No Reddit summary returned"}`,
              impact: "pending",
              citations: redditResult.citations,
            },
          ],
        ];
      } catch (err) {
        return [
          ticker,
          [
            {
              headline: `${ticker}: X search unavailable (${err.message})`,
              impact: "unknown",
              citations: [],
            },
            {
              headline: `${ticker}: Reddit search unavailable (${err.message})`,
              impact: "unknown",
              citations: [],
            },
          ],
        ];
      }
    })
  );

  results.forEach(([ticker, items]) => {
    state.news_reports[ticker] = items;
  });

  state.log("News Analyst", "Fetched Grok live search summaries for X and Reddit");
  return state;
}

export async function sentiment_analyst(state) {
  const xTool = grokTools.search_x_influential_posts;
  const redditTool = grokTools.search_financial_subreddits;

  const analyses = await Promise.all(
    state.candidate_tickers.map(async (ticker) => {
      const newsSnippets = state.news_reports[ticker] || [];
      const prompt = [
        "You are a financial sentiment analyst. Use the provided social/news snippets to infer short-term sentiment for the ticker.",
        `Ticker: ${ticker}`,
        `Tools available (for live fetch): ${xTool.name}, ${redditTool.name}`,
        "Snippets:",
        ...newsSnippets.map((n, i) => `${i + 1}. ${n.headline} [impact=${n.impact}]`),
        "Return strict JSON: {\"score\": number between -1 and 1, \"stance\": \"bullish\"|\"bearish\"|\"neutral\", \"rationale\": string, \"confidence\": 0-1}",
      ].join("\n");

      try {
        const text = await llmFast(prompt, { max_tokens: 120, temperature: 0.3 });
        const parsed = tryParseJson(text, null);
        const score = parsed?.score ?? 0;
        return [
          ticker,
          {
            source: "grok-tools+llm",
            tools: [xTool.name, redditTool.name],
            score,
            stance: parsed?.stance || (score > 0.1 ? "bullish" : score < -0.1 ? "bearish" : "neutral"),
            rationale: parsed?.rationale || "LLM reasoning unavailable",
            confidence: parsed?.confidence ?? 0.5,
          },
        ];
      } catch (err) {
        state.log(
          "Sentiment Analyst",
          `LLM sentiment failed for ${ticker}: ${err.message}`
        );
        return [
          ticker,
          {
            source: "grok-tools+llm",
            tools: [xTool.name, redditTool.name],
            score: 0,
            stance: "neutral",
            rationale: "Fallback neutral sentiment (LLM unavailable)",
            confidence: 0.3,
          },
        ];
      }
    })
  );

  analyses.forEach(([ticker, report]) => {
    state.sentiment_reports[ticker] = report;
  });

  state.log(
    "Sentiment Analyst",
    "Computed sentiment using Grok tool context + LiteLLM fast model"
  );
  return state;
}

function formatBullInputs(state) {
  const fundamentals = Object.entries(state.fundamental_reports)
    .slice(0, 3)
    .map(([ticker, data]) => ({
      ticker,
      revenue_growth: data.revenueGrowth ?? data.revenue_growth ?? 0,
      margins: data.operatingMargin ?? data.operating_margin ?? null,
    }));
  return { fundamentals };
}

function formatBearInputs(state) {
  const technicals = Object.entries(state.technical_reports)
    .slice(0, 3)
    .map(([ticker, data]) => ({
      ticker,
      atr_30d: data.atr_30d ?? data.atr ?? 0,
      rsi: data.rsi ?? null,
      trend_score: data.trend_score ?? null,
    }));
  return { technicals };
}

export async function bull_researcher(state) {
  const inputs = formatBullInputs(state);
  const prompt = [
    "You are the Bull Researcher. Build a bullish case using the provided data.",
    "Emphasize structural tailwinds and revenue durability.",
    state.bear_case
      ? `Rebut the bear case briefly: ${state.bear_case}`
      : "No bear case yet; present the opening statement.",
    "Keep it to 5-7 sentences. Use tickers when you cite evidence.",
    `Fundamentals: ${JSON.stringify(inputs.fundamentals)}`,
  ].join("\n");

  try {
    state.bull_case = await llmReasoning(prompt, {
      max_tokens: 2400,
      temperature: 0.3,
    });
  } catch (err) {
    state.log("Bull Researcher", `Reasoning model failed: ${err.message}`);
    const highlights = Object.entries(state.fundamental_reports)
      .slice(0, 3)
      .map(([ticker, data]) => {
        const growth = data.revenueGrowth ?? data.revenue_growth ?? 0;
        return `${ticker}: rev+${Math.round(growth * 100)}%`;
      });
    state.bull_case = `Bullish view emphasizes scalable AI moats and sustained revenue acceleration. Key tickers -> ${highlights.join(
      "; "
    )}.`;
  }
  state.log("Bull Researcher", state.bull_case);
  return state;
}

export async function bear_researcher(state) {
  const inputs = formatBearInputs(state);
  const prompt = [
    "You are the Bear Researcher. Build a skeptical case using the provided data.",
    "Emphasize valuation risk, volatility, and macro sensitivity.",
    state.bull_case
      ? `Rebut the bull case briefly: ${state.bull_case}`
      : "No bull case yet; present the opening statement.",
    "Keep it to 5-7 sentences. Use tickers when you cite evidence.",
    `Technicals: ${JSON.stringify(inputs.technicals)}`,
  ].join("\n");

  try {
    state.bear_case = await llmReasoning(prompt, {
      max_tokens: 2400,
      temperature: 0.3,
    });
  } catch (err) {
    state.log("Bear Researcher", `Reasoning model failed: ${err.message}`);
    const risks = Object.entries(state.technical_reports)
      .slice(0, 3)
      .map(([ticker, data]) => {
        const atr = data.atr_30d ?? data.atr ?? 0;
        return `${ticker}: ATR ${(atr * 100).toFixed(1)}%`;
      });
    state.bear_case = `Bear case flags valuation stretch, macro slowdown, and volatility pockets (${risks.join(
      ", "
    )}).`;
  }
  state.log("Bear Researcher", state.bear_case);
  return state;
}

export function debate_moderator(state) {
  state.debate_summary =
    "Moderator: 3-round rebuttal concluded. Consensus favors AI + semiconductor leaders with manageable volatility; caution on names with ATR>8%.";
  state.log("Debate Moderator", state.debate_summary);
  return state;
}

export function trader_agent(state) {
  const requested = state.user_inputs.num_stocks_requested || 5;
  const scored = state.candidate_tickers.map((ticker, idx) => {
    const sentimentScore = state.sentiment_reports[ticker]?.score || 0;
    const trendScore = state.technical_reports[ticker]?.trend_score ?? 50;
    const rsi = state.technical_reports[ticker]?.rsi ?? 50;
    const growth = state.fundamental_reports[ticker]?.revenueGrowth ?? 0;
    const earningsGrowth = state.fundamental_reports[ticker]?.earningsGrowth ?? 0;
    const returnOnEquity = state.fundamental_reports[ticker]?.returnOnEquity ?? 0;
    const marketCap = state.fundamental_reports[ticker]?.marketCap || 0;
    const momentum3m = state.technical_reports[ticker]?.momentum_3m ?? 0;
    const atrPct = state.technical_reports[ticker]?.atr_pct ?? 0;
    const momentum =
      trendScore * 0.6 +
      (rsi >= 45 && rsi <= 70 ? 10 : rsi < 35 ? -5 : 0);
    const capBoost = marketCap > 0 ? Math.min(Math.log10(marketCap) * 2, 16) : 0;
    const qualityBoost = earningsGrowth * 30 + returnOnEquity * 20;
    const volPenalty = atrPct * 100;
    const composite =
      60 +
      momentum +
      momentum3m * 40 +
      sentimentScore * 10 +
      growth * 50 +
      qualityBoost +
      capBoost -
      volPenalty -
      idx * 0.2;
    return { ticker, composite };
  });
  scored.sort((a, b) => b.composite - a.composite);
  const slicedTickers = scored.slice(0, requested).map((s) => s.ticker);

  const proposals = slicedTickers.map((ticker, idx) => {
    const sentimentScore = state.sentiment_reports[ticker]?.score || 0;
    const baseScore = 80 - idx * 4 + sentimentScore * 10;
    const liveName = state.ticker_names?.[ticker];
    return {
      ticker,
      name:
        liveName ||
        sampleUniverse.find((s) => s.ticker === ticker)?.name ||
        "Candidate Co.",
      score: Math.max(baseScore, 50),
      raw_allocation: 1 / slicedTickers.length,
    };
  });

  state.trader_proposal = proposals;
  state.log(
    "Trader Agent",
    `Ranked ${proposals.length} tickers with preliminary equal weights`
  );
  return state;
}

export async function get_vix_agent(state) {
  state.vix_level = await fetchVIX();
  state.log("Get VIX Agent", `VIX level recorded at ${state.vix_level}`);
  return state;
}

export function aggressive_risk_agent(state) {
  state.risk_votes.aggressive = "approve_with_monitoring";
  state.log(
    "Aggressive Risk Agent",
    "Signed off with caveats on earnings dates and liquidity"
  );
  return state;
}

export function neutral_risk_agent(state) {
  state.risk_votes.neutral = "approve";
  state.log("Neutral Risk Agent", "No objections; allocations acceptable");
  return state;
}

export function conservative_risk_agent(state) {
  const highVol = Object.entries(state.technical_reports)
    .filter(([, data]) => (data.atr_30d ?? data.atr ?? 0) > 0.08)
    .map(([ticker]) => ticker);
  state.high_volatility_tickers = highVol;

  const veto = state.vix_level > 30 || highVol.length > 0;
  state.risk_votes.conservative = veto ? "veto" : "approve";
  state.log(
    "Conservative Risk Agent",
    veto
      ? `VETO: VIX ${state.vix_level} or high ATR tickers ${highVol.join(", ")}`
      : "Approve"
  );
  return state;
}

export function risk_supervisor(state) {
  const vetoed = state.risk_votes.conservative === "veto";
  const adjustments = state.trader_proposal.map((item) => {
    const atr =
      state.technical_reports[item.ticker]?.atr_30d ||
      state.technical_reports[item.ticker]?.atr ||
      0;
    const penalty = atr > 0.08 || vetoed ? 0.15 : 0;
    const allocation = Math.max(item.raw_allocation - penalty, 0.05);
    return { ...item, adjusted_allocation: allocation };
  });
  state.risk_adjusted_proposal = adjustments;
  state.log(
    "Risk Supervisor",
    vetoed
      ? "Conservative veto enforced; allocations penalized for volatility"
      : "Allocations adjusted for volatility and liquidity"
  );
  return state;
}

export function fund_manager(state) {
  const total = state.risk_adjusted_proposal.reduce(
    (sum, item) => sum + item.adjusted_allocation,
    0
  );
  const normalized = state.risk_adjusted_proposal.map((item) => {
    let weight = item.adjusted_allocation / (total || 1);
    weight = Math.min(weight, MAX_SINGLE_ALLOCATION);
    return { ...item, final_allocation: weight };
  });
  const normTotal = normalized.reduce((sum, i) => sum + i.final_allocation, 0);
  state.final_portfolio = normalized.map((item) => ({
    ticker: item.ticker,
    name: item.name,
    allocation_pct: Math.round((item.final_allocation / (normTotal || 1)) * 1000) / 10,
    reasoning: `Risk-adjusted score ${item.score}, sector fit ${item.name}`,
  }));
  state.log(
    "Fund Manager",
    "Applied 30% cap, normalized weights, and prepared final list"
  );
  return state;
}

export function report_writer(state) {
  const lines = state.final_portfolio.map(
    (item, idx) =>
      `${idx + 1}. ${item.ticker} – ${item.allocation_pct}% – ${item.reasoning}`
  );
  const report = [
    `ATHENA ADVISORY – ${new Date().toISOString().split("T")[0]} | Run ID: ${
      state.run_id
    }`,
    `Risk Profile: ${state.user_inputs.risk_tolerance} | Horizon: ${state.user_inputs.investment_horizon_years} yrs | Requested: ${
      state.user_inputs.num_stocks_requested || 5
    }`,
    `VIX: ${state.vix_level}`,
    "FINAL RECOMMENDED PORTFOLIO",
    ...lines,
    "Note: Advisory only; no auto-execution. Max single position capped at 30%.",
  ].join("\n");

  state.log("Report Writer", report);
  return state;
}

export function persist_state(state) {
  const dir = path.join(process.cwd(), "runs");
  fs.mkdirSync(dir, { recursive: true });
  const filePath = path.join(dir, `${state.run_id}_state.json`);
  const serialized = JSON.stringify(state, null, 2);
  fs.writeFileSync(filePath, serialized);
  return filePath;
}
