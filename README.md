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
