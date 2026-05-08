import {
  fetchFundamentals,
  fetchTechnicalIndicators,
  fetchVIX,
  lookupTickerNames,
  searchFinancialSubreddits,
  searchXInfluentialPosts,
  baseUniverse,
  sectorAliases,
} from "../dataProviders.js";
import { llmFast } from "../llm.js";
import { allocateWeights, applyRisk } from "./lib/risk.js";
import { buildConfidence, scoreTicker } from "./lib/scoring.js";

const TARGET_MIN = 60;
const TARGET_MAX = 100;

function normalizeTicker(t) {
  return String(t || "").trim().toUpperCase().replace(/[^A-Z.]/g, "");
}

function expandSectorInputs(sectors = []) {
  const expanded = new Set();
  sectors.map((s) => String(s).toLowerCase()).forEach((s) => {
    (sectorAliases[s] || [s]).forEach((x) => expanded.add(x));
  });
  return expanded;
}

function inferSectorFromReasoning(reasoning = "") {
  const text = reasoning.toLowerCase();
  for (const [k, aliases] of Object.entries(sectorAliases)) {
    if ([k, ...aliases].some((term) => text.includes(term))) return k;
  }
  return "unknown";
}

export async function candidateDiscoveryAgent(ctx) {
  const sectors = ctx.user_input.preferred_sectors || [];
  const prompt = [
    "Generate a broad stock candidate list for investment screening.",
    sectors.length ? `Focus sectors: ${sectors.join(", ")}` : "No sector restriction.",
    "Return strict JSON array with 120 items max: [{\"ticker\":\"...\",\"reason\":\"...\"}]",
    "Use US-listed liquid names and keep reasons short.",
  ].join("\n");

  let discovered = [];
  const warnings = [];

  try {
    const raw = await llmFast(prompt, { max_tokens: 1800, temperature: 0.2 });
    const parsed = parseDiscoveryPayload(raw);
    discovered = parsed
      .map((r) => ({ ticker: normalizeTicker(r?.ticker), reason: String(r?.reason || "") }))
      .filter((r) => r.ticker.length >= 1 && r.ticker.length <= 5);
    if (!discovered.length) {
      warnings.push("candidate_discovery: no valid tickers extracted from discovery response");
    }
  } catch (err) {
    warnings.push(`candidate_discovery: llm parse failure (${err.message})`);
  }

  const localExpansion = baseUniverse.map((b) => ({
    ticker: b.ticker,
    reason: `Local reference universe (${b.sector})`,
  }));

  const merged = [...discovered, ...localExpansion];
  ctx.artifacts.discovered_candidates = merged;

  return {
    status: discovered.length ? "success" : "degraded",
    data: merged,
    warnings,
    metrics: { discovered_count: merged.length },
  };
}

function parseDiscoveryPayload(raw = "") {
  const trimmed = String(raw || "").trim();
  if (!trimmed) return [];

  try {
    const direct = JSON.parse(trimmed);
    if (Array.isArray(direct)) return direct;
  } catch {
    // continue
  }

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    try {
      const block = JSON.parse(fenced[1].trim());
      if (Array.isArray(block)) return block;
    } catch {
      // continue
    }
  }

  const bracketStart = trimmed.indexOf("[");
  const bracketEnd = trimmed.lastIndexOf("]");
  if (bracketStart >= 0 && bracketEnd > bracketStart) {
    const slice = trimmed.slice(bracketStart, bracketEnd + 1);
    try {
      const arr = JSON.parse(slice);
      if (Array.isArray(arr)) return arr;
    } catch {
      // continue
    }
  }

  // Last fallback: extract ticker-like lines.
  return trimmed
    .split("\n")
    .map((line) => line.trim())
    .map((line) => line.replace(/^[\-\*\d\.\)\s]+/, ""))
    .map((line) => line.split(/[\s,:-]/)[0])
    .map((ticker) => ({ ticker, reason: "extracted_from_text_line" }))
    .filter((r) => normalizeTicker(r.ticker).length > 0);
}

export async function candidateValidationAgent(ctx) {
  const preferredSectors = ctx.user_input.preferred_sectors || [];
  const expanded = expandSectorInputs(preferredSectors);

  const catalogByTicker = new Map(baseUniverse.map((b) => [b.ticker, b]));
  const dedup = new Map();

  for (const row of ctx.artifacts.discovered_candidates) {
    const ticker = normalizeTicker(row.ticker);
    if (!ticker) continue;
    if (!dedup.has(ticker)) dedup.set(ticker, row);
  }

  const rejected = [];
  const validated = [];

  for (const [ticker, row] of dedup.entries()) {
    const local = catalogByTicker.get(ticker);
    const effectiveSector = local?.sector?.toLowerCase() || inferSectorFromReasoning(row.reason);
    const allow = expanded.size === 0 || expanded.has(effectiveSector);

    if (!allow) {
      rejected.push({ ticker, reason: "sector_mismatch", sector: effectiveSector });
      continue;
    }

    validated.push({
      ticker,
      sector: effectiveSector,
      source: local ? "local_catalog" : "llm_discovery",
      reason: row.reason,
    });
  }

  if (!validated.length) {
    const fallback = baseUniverse
      .filter((b) => expanded.size === 0 || expanded.has(b.sector.toLowerCase()))
      .map((b) => ({ ticker: b.ticker, sector: b.sector.toLowerCase(), source: "tier2_fallback", reason: "sector-scoped fallback" }));
    validated.push(...fallback);
  }

  while (validated.length < TARGET_MIN) {
    const extras = baseUniverse
      .filter((b) => !validated.some((v) => v.ticker === b.ticker))
      .filter((b) => expanded.size === 0 || expanded.has(b.sector.toLowerCase()))
      .map((b) => ({ ticker: b.ticker, sector: b.sector.toLowerCase(), source: "tier2_expand", reason: "pool expansion" }));
    if (!extras.length) break;
    validated.push(...extras);
  }

  const finalValidated = validated.slice(0, TARGET_MAX);

  ctx.artifacts.validated_candidates = finalValidated;
  ctx.artifacts.rejected_candidates = rejected;
  ctx.artifacts.tickers = finalValidated.map((v) => v.ticker);

  const warnings = [];
  if (ctx.artifacts.tickers.length === 0) {
    warnings.push("candidate_validation: zero validated candidates after sector filters");
  }
  if (ctx.artifacts.tickers.length < TARGET_MIN) {
    warnings.push(`candidate_validation: validated pool below target (${ctx.artifacts.tickers.length}/${TARGET_MIN})`);
  }

  return {
    status: warnings.length ? "degraded" : "success",
    data: finalValidated,
    warnings,
    metrics: {
      discovered_count: ctx.artifacts.discovered_candidates.length,
      validated_count: finalValidated.length,
      excluded_by_sector: rejected.filter((r) => r.reason === "sector_mismatch").length,
    },
  };
}

export async function enrichAgent(ctx) {
  const tickers = ctx.artifacts.tickers;
  const warnings = [];

  const [names, fundamentals, technicals, macro, social] = await Promise.all([
    lookupTickerNames(tickers),
    Promise.all(tickers.map(async (t) => [t, await fetchFundamentals(t)])),
    Promise.all(tickers.map(async (t) => [t, await fetchTechnicalIndicators(t)])),
    fetchVIX(),
    Promise.all(
      tickers.map(async (t) => {
        try {
          const [x, r] = await Promise.all([
            searchXInfluentialPosts({ ticker: t }),
            searchFinancialSubreddits({ ticker: t }),
          ]);
          return [t, { snippets: [x.text, r.text].filter(Boolean), citations: [...(x.citations || []), ...(r.citations || [])] }];
        } catch (err) {
          warnings.push(`social_news:${t}: ${err.message}`);
          return [t, { snippets: [], citations: [] }];
        }
      })
    ),
  ]);

  ctx.artifacts.names = names;
  ctx.artifacts.fundamentals = Object.fromEntries(fundamentals);
  ctx.artifacts.technicals = Object.fromEntries(technicals);
  ctx.artifacts.macro = { vix_level: macro };
  ctx.artifacts.social_news = Object.fromEntries(social);

  return {
    status: warnings.length ? "degraded" : "success",
    data: { tickers_enriched: tickers.length },
    warnings,
    metrics: { enriched_count: tickers.length },
  };
}

export async function scoringAgent(ctx) {
  const requested = ctx.user_input.num_stocks_requested;
  const ranked = ctx.artifacts.tickers
    .map((ticker) => {
      const socialText = (ctx.artifacts.social_news[ticker]?.snippets || []).join("\n");
      return {
        ticker,
        ...scoreTicker({
          ticker,
          fundamentals: ctx.artifacts.fundamentals[ticker],
          technicals: ctx.artifacts.technicals[ticker],
          sentimentText: socialText,
        }),
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, requested);

  ctx.artifacts.ranked = ranked;
  return { status: "success", data: ranked, warnings: [], metrics: { ranked_count: ranked.length } };
}

export async function riskAllocateAgent(ctx) {
  const vixLevel = ctx.artifacts.macro.vix_level;
  const risked = applyRisk({
    ranked: ctx.artifacts.ranked,
    technicalsByTicker: ctx.artifacts.technicals,
    vixLevel,
  });
  const allocated = allocateWeights(risked.adjusted);

  ctx.artifacts.allocated = allocated;
  ctx.artifacts.market_regime = risked.marketRegime;
  ctx.artifacts.risked = risked;

  return { status: "success", data: allocated, warnings: [], metrics: { allocated_count: allocated.length } };
}

export async function explainAgent(ctx) {
  const stageWarnings = ctx.warnings;
  const portfolio = await Promise.all(
    ctx.artifacts.allocated.map(async (item) => {
      const ticker = item.ticker;
      const tech = ctx.artifacts.technicals[ticker] || {};
      const fund = ctx.artifacts.fundamentals[ticker] || {};
      const social = ctx.artifacts.social_news[ticker] || { snippets: [], citations: [] };

      const keySignals = [
        `score:${item.score.toFixed(2)}`,
        `rsi:${Number(tech.rsi ?? 50).toFixed(1)}`,
        `atr_pct:${(Number(tech.atr_pct ?? 0) * 100).toFixed(2)}%`,
        `revenue_growth:${Number(fund.revenueGrowth ?? 0).toFixed(2)}`,
      ];

      let thesis = `Balanced setup for ${ticker} with risk-aware position sizing.`;
      try {
        thesis =
          (await llmFast(
            [
              "Write one concise investment thesis sentence.",
              `Ticker: ${ticker}`,
              `Market regime: ${ctx.artifacts.market_regime}`,
              `Signals: ${keySignals.join(", ")}`,
            ].join("\n"),
            { max_tokens: 80, temperature: 0.2 }
          )) || thesis;
      } catch {
        // keep fallback thesis
      }

      return {
        ticker,
        name: ctx.artifacts.names[ticker] || ticker,
        allocation_pct: item.allocation_pct,
        confidence: buildConfidence({
          technicals: tech,
          fundamentals: fund,
          socialSnippets: social.snippets,
          marketRegime: ctx.artifacts.market_regime,
          warningsCount: stageWarnings.length,
        }),
        score: Number(item.score.toFixed(2)),
        thesis,
        key_signals: keySignals,
        risk_flags: item.risk_flags,
        citations: social.citations.map((c) => (typeof c === "string" ? c : c?.url || "llm_synthesized_signal")),
      };
    })
  );

  ctx.artifacts.portfolio = portfolio;
  return { status: "success", data: portfolio, warnings: [], metrics: { portfolio_count: portfolio.length } };
}
