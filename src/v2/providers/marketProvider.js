import {
  fetchFundamentals,
  fetchMarketCandidates,
  fetchTechnicalIndicators,
  fetchVIX,
  lookupTickerNames,
  searchFinancialSubreddits,
  searchXInfluentialPosts,
} from "../../dataProviders.js";

function toWarning(stage, err) {
  return `${stage}: ${err?.message || "provider failure"}`;
}

function deterministicMockForTicker(ticker) {
  const codeSum = [...ticker].reduce((sum, c) => sum + c.charCodeAt(0), 0);
  const base = (codeSum % 100) / 100;
  const price = 50 + base * 250;
  const atr = price * (0.01 + (base % 0.05));
  return {
    rsi: 40 + base * 30,
    atr,
    atr_pct: atr / price,
    sma50: price * 0.98,
    sma200: price * 0.92,
    price,
    momentum_3m: (base - 0.5) * 0.35,
  };
}

export class MarketProvider {
  constructor() {
    this.health = {
      market: true,
      fundamentals: true,
      technicals: true,
      macro: true,
      social_news: true,
    };
  }

  async getCandidates(input) {
    try {
      const tickers = await fetchMarketCandidates({
        sectors: input.preferred_sectors,
        minVolume: input.min_volume,
        limit: Math.max(30, input.num_stocks_requested * 6),
      });
      return { tickers, warnings: [] };
    } catch (err) {
      this.health.market = false;
      return { tickers: [], warnings: [toWarning("market_scan", err)] };
    }
  }

  async getTickerNames(tickers) {
    try {
      return await lookupTickerNames(tickers);
    } catch (_err) {
      return {};
    }
  }

  async getFundamentals(tickers) {
    const entries = await Promise.all(
      tickers.map(async (ticker) => {
        try {
          return [ticker, await fetchFundamentals(ticker), null];
        } catch (err) {
          this.health.fundamentals = false;
          return [ticker, null, toWarning(`fundamentals:${ticker}`, err)];
        }
      })
    );

    const data = Object.create(null);
    const warnings = [];
    entries.forEach(([ticker, row, warning]) => {
      if (row) data[ticker] = row;
      if (warning) warnings.push(warning);
    });
    return { data, warnings };
  }

  async getTechnicals(tickers) {
    const entries = await Promise.all(
      tickers.map(async (ticker) => {
        try {
          const row = await fetchTechnicalIndicators(ticker);
          return [ticker, row || deterministicMockForTicker(ticker), null];
        } catch (err) {
          this.health.technicals = false;
          return [ticker, deterministicMockForTicker(ticker), toWarning(`technicals:${ticker}`, err)];
        }
      })
    );

    const data = Object.create(null);
    const warnings = [];
    entries.forEach(([ticker, row, warning]) => {
      if (row) data[ticker] = row;
      if (warning) warnings.push(warning);
    });
    return { data, warnings };
  }

  async getMacro() {
    try {
      const vix = await fetchVIX();
      return { vix_level: vix, warnings: [] };
    } catch (err) {
      this.health.macro = false;
      return { vix_level: 25, warnings: [toWarning("macro:vix", err)] };
    }
  }

  async getSocialNews(tickers) {
    const rows = await Promise.all(
      tickers.map(async (ticker) => {
        try {
          const [x, reddit] = await Promise.all([
            searchXInfluentialPosts({ ticker, days: 7 }),
            searchFinancialSubreddits({ ticker, days: 7 }),
          ]);
          return [
            ticker,
            {
              snippets: [x?.text || "", reddit?.text || ""].filter(Boolean),
              citations: [...(x?.citations || []), ...(reddit?.citations || [])]
                .map((c) => c?.url || c?.title || String(c))
                .slice(0, 8),
            },
            null,
          ];
        } catch (err) {
          this.health.social_news = false;
          return [ticker, { snippets: [], citations: [] }, toWarning(`social_news:${ticker}`, err)];
        }
      })
    );

    const data = Object.create(null);
    const warnings = [];
    rows.forEach(([ticker, row, warning]) => {
      data[ticker] = row;
      if (warning) warnings.push(warning);
    });
    return { data, warnings };
  }

  getHealth() {
    return this.health;
  }
}
