import "./env.js";
import {
  marketScanner,
  fundamental_analyst,
  technical_analyst,
  news_analyst,
  sentiment_analyst,
  bull_researcher,
  bear_researcher,
  debate_moderator,
  trader_agent,
  get_vix_agent,
  aggressive_risk_agent,
  neutral_risk_agent,
  conservative_risk_agent,
  risk_supervisor,
  fund_manager,
  report_writer,
  persist_state,
} from "./agents.js";
import { TradingState } from "./state.js";
import readline from "readline/promises";
import { stdin as input, stdout as output } from "process";

async function runAthenaAdvisory(userInputs) {
  const state = new TradingState(userInputs);

  // Phase 1 – Analyst Team
  await marketScanner(state);
  await fundamental_analyst(state);
  await technical_analyst(state);
  await news_analyst(state);
  await sentiment_analyst(state);

  // Phase 2 – Researcher Team
  await bull_researcher(state);
  await bear_researcher(state);
  debate_moderator(state);

  // Phase 3 – Strategy
  trader_agent(state);

  // Phase 4 – Risk Management
  await get_vix_agent(state);
  aggressive_risk_agent(state);
  neutral_risk_agent(state);
  conservative_risk_agent(state);
  risk_supervisor(state);

  // Phase 5 – Approval
  fund_manager(state);
  report_writer(state);

  const savedPath = persist_state(state);
  return {
    final_portfolio: state.final_portfolio,
    transcript: state.full_transcript,
    savedPath,
  };
}

// Allow running from CLI for quick demo
if (process.argv[1] === new URL(import.meta.url).pathname) {
  (async () => {
    const userInputs = await promptUserInputs();
    const { final_portfolio, savedPath } = await runAthenaAdvisory(userInputs);
    // eslint-disable-next-line no-console
    console.log("\nFinal portfolio:", final_portfolio);
    // eslint-disable-next-line no-console
    console.log(`State saved to ${savedPath}`);
  })();
}

export { runAthenaAdvisory };

async function promptUserInputs() {
  const rl = readline.createInterface({ input, output });
  const ask = (q, fallback) =>
    rl.question(q).then((answer) => {
      const trimmed = answer.trim();
      return trimmed.length ? trimmed : fallback;
    });

  const risk_tolerance = await ask(
    "Risk tolerance (aggressive/neutral/conservative) [neutral]: ",
    "neutral"
  );
  const investment_horizon_years = parseInt(
    await ask("Investment horizon in years [5]: ", "5"),
    10
  );
  const preferredSectorsRaw = await ask(
    [
      "Preferred sectors (comma-separated or by number). Options:",
      "1) AI",
      "2) Semiconductors",
      "3) Energy",
      "4) Healthcare",
      "5) Utilities",
      "6) Financials",
      "7) Industrials",
      "8) Consumer Staples",
      "9) Consumer Discretionary",
      "10) Real Estate",
      "11) Materials",
      "12) Technology",
      "Enter names or numbers (e.g., \"3,4\" or \"Energy,Healthcare\") [AI,Semiconductors]: ",
    ].join("\n"),
    "AI,Semiconductors"
  );
  const sectorOptions = [
    "AI",
    "Semiconductors",
    "Energy",
    "Healthcare",
    "Utilities",
    "Financials",
    "Industrials",
    "Consumer Staples",
    "Consumer Discretionary",
    "Real Estate",
    "Materials",
    "Technology",
  ];
  const preferred_sectors = preferredSectorsRaw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .flatMap((entry) => {
      const asNumber = Number.parseInt(entry, 10);
      if (Number.isFinite(asNumber)) {
        return sectorOptions[asNumber - 1] ? [sectorOptions[asNumber - 1]] : [];
      }
      return [entry];
    });
  const num_stocks_requested = parseInt(
    await ask("Number of stocks requested [5]: ", "5"),
    10
  );
  const min_volume = parseInt(
    await ask("Minimum avg volume (for filtering) [500000]: ", "500000"),
    10
  );

  rl.close();
  return {
    risk_tolerance: risk_tolerance.toLowerCase(),
    investment_horizon_years: Number.isFinite(investment_horizon_years)
      ? investment_horizon_years
      : 5,
    preferred_sectors,
    num_stocks_requested: Number.isFinite(num_stocks_requested)
      ? num_stocks_requested
      : 5,
    min_volume: Number.isFinite(min_volume) ? min_volume : 500000,
  };
}
