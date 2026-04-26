import crypto from "crypto";
import { llmFast } from "../llm.js";
import { MarketProvider } from "./providers/marketProvider.js";
import { allocateWeights, applyRisk } from "./lib/risk.js";
import { buildConfidence, scoreTicker } from "./lib/scoring.js";
import { analyzeResponseSchema } from "./schemas.js";
import { persistRun } from "./persistence.js";

const fallbackNames = {
  NVDA: "NVIDIA",
  MSFT: "Microsoft",
  GOOGL: "Alphabet",
  AMZN: "Amazon",
  AAPL: "Apple",
};

export async function runAdvisoryV2(userInput) {
  const provider = new MarketProvider();
  const run_id = crypto.randomBytes(8).toString("hex");
  const transcript = [];
  const stageWarnings = [];

  const log = (stage, message) => {
    transcript.push({ timestamp: new Date().toISOString(), stage, message });
  };

  log("scan", "Starting market scan");
  const scan = await provider.getCandidates(userInput);
  stageWarnings.push(...scan.warnings);
  let tickers = scan.tickers.slice(0, Math.max(userInput.num_stocks_requested * 3, 10));
  if (!tickers.length) {
    tickers = ["NVDA", "MSFT", "GOOGL", "AMZN", "AAPL", "AMD", "ASML", "TSM"];
    stageWarnings.push("market_scan: no candidates from provider, used fallback universe");
  }

  log("enrich", `Enriching ${tickers.length} candidates`);
  const [names, f, t, m, s] = await Promise.all([
    provider.getTickerNames(tickers),
    provider.getFundamentals(tickers),
    provider.getTechnicals(tickers),
    provider.getMacro(),
    provider.getSocialNews(tickers),
  ]);

  [f, t, m, s].forEach((r) => stageWarnings.push(...(r.warnings || [])));

  const vixLevel = m.vix_level;
  const ranked = tickers
    .map((ticker) => {
      const socialText = (s.data[ticker]?.snippets || []).join("\n");
      return {
        ...scoreTicker({
          ticker,
          fundamentals: f.data[ticker],
          technicals: t.data[ticker],
          sentimentText: socialText,
        }),
        ticker,
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, userInput.num_stocks_requested);

  log("score", `Scored and selected ${ranked.length} tickers`);

  const risked = applyRisk({ ranked, technicalsByTicker: t.data, vixLevel });
  const allocated = allocateWeights(risked.adjusted);

  log("risk", risked.veto ? "Conservative veto conditions detected" : "Risk checks passed");

  const portfolio = await Promise.all(
    allocated.map(async (item) => {
      const social = s.data[item.ticker] || { snippets: [], citations: [] };
      const confidence = buildConfidence({
        technicals: t.data[item.ticker],
        fundamentals: f.data[item.ticker],
        socialSnippets: social.snippets,
        marketRegime: risked.marketRegime,
        warningsCount: stageWarnings.length,
      });

      const keySignals = [
        `score:${item.score.toFixed(2)}`,
        `rsi:${Number(t.data[item.ticker]?.rsi ?? 50).toFixed(1)}`,
        `atr_pct:${(Number(t.data[item.ticker]?.atr_pct ?? 0) * 100).toFixed(2)}%`,
        `revenue_growth:${Number(f.data[item.ticker]?.revenueGrowth ?? 0).toFixed(2)}`,
      ];

      const thesis = await buildThesis({ ticker: item.ticker, marketRegime: risked.marketRegime, keySignals });

      return {
        ticker: item.ticker,
        name: names[item.ticker] || fallbackNames[item.ticker] || item.ticker,
        allocation_pct: item.allocation_pct,
        confidence,
        score: Number(item.score.toFixed(2)),
        thesis,
        key_signals: keySignals,
        risk_flags: item.risk_flags,
        citations: social.citations,
      };
    })
  );

  const result = {
    run_id,
    as_of: new Date().toISOString(),
    market_regime: risked.marketRegime,
    portfolio,
    summary: `Generated ${portfolio.length} recommendations under ${risked.marketRegime} regime (VIX ${vixLevel.toFixed(2)}).`,
    warnings: risked.veto
      ? [...stageWarnings, `Conservative veto triggered by VIX/ATR checks. High ATR tickers: ${risked.highVolTickers.join(",") || "none"}`]
      : stageWarnings,
    transcript_ref: `${run_id}_state.v2.json`,
    degraded_mode: stageWarnings.length > 0,
    diagnostics: {
      stage_warnings: stageWarnings,
      provider_health: provider.getHealth(),
    },
    transcript,
  };

  const parsed = analyzeResponseSchema.parse(result);
  persistRun(parsed);
  log("persist", `Saved run ${parsed.transcript_ref}`);
  return parsed;
}

async function buildThesis({ ticker, marketRegime, keySignals }) {
  const prompt = [
    "Write a concise investment thesis sentence for this ticker.",
    `Ticker: ${ticker}`,
    `Regime: ${marketRegime}`,
    `Signals: ${keySignals.join(", ")}`,
    "Return one sentence, neutral and risk-aware.",
  ].join("\n");

  try {
    const text = await llmFast(prompt, { max_tokens: 80, temperature: 0.2 });
    return text || `Balanced setup for ${ticker} with risk-aware position sizing.`;
  } catch (_err) {
    return `Balanced setup for ${ticker} with risk-aware position sizing and measurable catalysts.`;
  }
}
