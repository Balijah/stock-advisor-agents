export function scoreTicker({ ticker, fundamentals, technicals, sentimentText }) {
  const growth = Number(fundamentals?.revenueGrowth ?? fundamentals?.revenue_growth ?? 0);
  const earningsGrowth = Number(fundamentals?.earningsGrowth ?? 0);
  const roe = Number(fundamentals?.returnOnEquity ?? 0);
  const marketCap = Number(fundamentals?.marketCap ?? 0);

  const rsi = Number(technicals?.rsi ?? 50);
  const trend = (Number(technicals?.sma50 ?? 0) - Number(technicals?.sma200 ?? 0)) > 0 ? 1 : -1;
  const momentum3m = Number(technicals?.momentum_3m ?? 0);
  const atrPct = Number(technicals?.atr_pct ?? 0);

  const sentiment = sentimentWeight(sentimentText);

  const components = {
    growth: growth * 30,
    quality: earningsGrowth * 20 + roe * 15,
    momentum: momentum3m * 40 + (rsi >= 45 && rsi <= 70 ? 8 : -4) + trend * 6,
    size: marketCap > 0 ? Math.min(Math.log10(marketCap), 13) : 0,
    sentiment: sentiment * 10,
    volatility_penalty: atrPct * 120,
  };

  const rawScore =
    55 +
    components.growth +
    components.quality +
    components.momentum +
    components.size +
    components.sentiment -
    components.volatility_penalty;

  return {
    ticker,
    score: Math.max(0, Number(rawScore.toFixed(2))),
    components,
  };
}

function sentimentWeight(text = "") {
  const lower = text.toLowerCase();
  if (!lower) return 0;
  const positive = ["beat", "upside", "bullish", "strong", "upgrade", "growth"];
  const negative = ["miss", "downside", "bearish", "downgrade", "fraud", "lawsuit"];
  let acc = 0;
  positive.forEach((w) => {
    if (lower.includes(w)) acc += 0.15;
  });
  negative.forEach((w) => {
    if (lower.includes(w)) acc -= 0.15;
  });
  return Math.max(-1, Math.min(1, acc));
}

export function buildConfidence({ technicals, fundamentals, socialSnippets, marketRegime, warningsCount }) {
  const completeness = [technicals, fundamentals, socialSnippets?.length ? socialSnippets : null].filter(Boolean)
    .length / 3;
  const agreement = signalAgreement(technicals, fundamentals);
  const regimePenalty = marketRegime === "elevated_volatility" ? 0.15 : 0;
  const warningPenalty = Math.min(0.25, warningsCount * 0.03);

  const value = 0.35 + completeness * 0.35 + agreement * 0.25 - regimePenalty - warningPenalty;
  return Number(Math.max(0.05, Math.min(0.95, value)).toFixed(2));
}

function signalAgreement(technicals, fundamentals) {
  const growth = Number(fundamentals?.revenueGrowth ?? fundamentals?.revenue_growth ?? 0);
  const trendUp = (Number(technicals?.sma50 ?? 0) - Number(technicals?.sma200 ?? 0)) > 0;
  if (growth > 0.05 && trendUp) return 1;
  if (growth < -0.05 && !trendUp) return 0.8;
  return 0.45;
}
