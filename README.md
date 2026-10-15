## Athena Advisory – Autonomous Trading Advisory Crew

Implements the 15-agent orchestration defined in `README.txt`. This build is advisory-only (no auto-execution) and caps single positions at 30% with conservative veto logic tied to VIX/ATR.

### Run a demo
```bash
npm start
```
Outputs a sample portfolio and writes the full state + audit trail to `runs/<run_id>_state.json`.

### Integrate programmatically
```js
import { runAthenaAdvisory } from "./src/main.js";

const { final_portfolio, savedPath } = runAthenaAdvisory({
  risk_tolerance: "aggressive",
  investment_horizon_years: 7,
  preferred_sectors: ["AI", "Quantum Computing"],
  num_stocks_requested: 6,
});
```

### Notes
- Every agent logs a timestamped message with the shared `run_id` into `full_transcript`.
- Conservative Risk Agent issues a veto if `vix_level > 30` or any ticker has `atr_30d > 0.08`; Risk Supervisor then penalizes weights.
- Final allocations are normalized with a hard 30% cap per ticker.

### Environment variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `OPENAI_API_KEY` | Yes (for LLM calls) | — | OpenAI API key |
| `ANTHROPIC_API_KEY` | No | — | Anthropic API key (used when model starts with `claude-`) |
| `CORS_ORIGIN` | No | `*` (dev) / blocked (prod) | Allowed CORS origin. Set to your frontend domain in production. When `NODE_ENV=production` and this is unset, CORS is blocked. |
| `API_KEY` | No | — | When set, all analysis/run endpoints require `Authorization: Bearer <key>` or `x-api-key: <key>`. Unset = no auth (local dev). |
| `RATE_LIMIT_WINDOW_MS` | No | `60000` | Rate-limit sliding window in milliseconds |
| `RATE_LIMIT_MAX` | No | `20` | Max requests per window per client on analysis routes |
| `PORT` | No | `3001` | Server listen port |
| `FAST_MODEL` | No | `gpt-4o-mini` | Model for fast LLM calls |
| `DEEP_MODEL` | No | `gpt-4o` | Model for deep LLM calls |
| `REASONING_MODEL` | No | `claude-3-7-sonnet-latest` | Model for reasoning LLM calls |
