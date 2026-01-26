import crypto from "crypto";

const defaultArray = () => [];
const defaultDict = () => Object.create(null);

export class TradingState {
  constructor(userInputs) {
    this.run_id = crypto.randomBytes(8).toString("hex");
    this.timestamp = new Date().toISOString();

    this.user_inputs = userInputs;

    // Phase 1
    this.candidate_tickers = defaultArray();
    this.fundamental_reports = defaultDict();
    this.technical_reports = defaultDict();
    this.news_reports = defaultDict();
    this.sentiment_reports = defaultDict();
    this.available_realtime_tools = defaultDict();
    this.ticker_names = defaultDict();

    // Phase 2
    this.bull_case = "";
    this.bear_case = "";
    this.debate_summary = "";

    // Phase 3
    this.trader_proposal = defaultArray();

    // Phase 4
    this.risk_votes = defaultDict();
    this.risk_adjusted_proposal = defaultArray();
    this.vix_level = 0;
    this.high_volatility_tickers = defaultArray();

    // Phase 5
    this.final_portfolio = defaultArray();
    this.full_transcript = defaultArray();
  }

  log(agent, message) {
    this.full_transcript.push({
      run_id: this.run_id,
      timestamp: new Date().toISOString(),
      agent,
      message,
    });
  }

  clone() {
    return structuredClone(this);
  }
}
