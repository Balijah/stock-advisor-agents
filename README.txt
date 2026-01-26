### FINAL SYSTEM DESIGN: "Autonomous Trading Advisory Crew"  
**Name:** Athena Advisory (you can rename)

#### Core Constraints (Hard-Coded for Safety & Compliance)
- Zero auto-execution – final output is purely advisory  
- Max 30% allocation to any single stock  
- Conservative Risk Agent gets automatic veto if VIX > 30 OR any stock 30-day ATR > 8%  
- Full audit trail with run_id + timestamp on every message  
- Shared state persisted as JSON (Redis optional later)

#### User Inputs (UI Sliders + Multi-Select)
```json
{
  "risk_tolerance": "aggressive|neutral|conservative",   // required
  "investment_horizon_years": 0.02 to 20,                // 1 week ≈ 0.02, 20 years = 20
  "preferred_sectors": ["Quantum Computing", "AI", ...], // optional, empty = all
  "num_stocks_requested": 1 to 10                        // optional, default 5
}
```

#### Agent Hierarchy & Exact Roles (15 agents total)

**Phase 1 – Analyst Team (Data Gatherers)**
1. Market Scanner Agent → scans entire US market (~8,200 tickers), applies sector filter, returns top 80 candidates by liquidity + volume
2. Fundamental Analyst → pulls latest financials, earnings surprises, insider transactions (SEDI + EDGAR)
3. Technical Analyst → calculates 15 indicators (RSI, MACD, Bollinger, ATR, etc.) + trend scoring
4. News Analyst → uses Grok real-time web/X search for last 7 days news + headlines
5. Sentiment Analyst → Grok real-time search on X + Reddit (r/wallstreetbets, r/stocks, etc.)

**Phase 2 – Researcher Team (Debaters)**
6. Bull Researcher (o1-preview) → builds strongest possible positive case
7. Bear Researcher (o1-preview) → builds strongest possible negative case
8. Debate Moderator → forces 3 rounds of rebuttal, outputs structured summary

**Phase 3 – Strategy**
9. Trader Agent (Grok-4) → synthesizes everything into ranked stock list + initial allocations

**Phase 4 – Risk Management Team**
10. Aggressive Risk Agent → reviews proposal from aggressive lens
11. Neutral Risk Agent → balanced view
12. Conservative Risk Agent → **VETO POWER** if VIX > 30 or ATR > 8%
13. Risk Supervisor → final risk vote + adjustments

**Phase 5 – Approval**
14. Fund Manager (Grok-4) → final sign-off, applies 30% cap, normalizes to 100%
15. Report Writer → generates beautiful final recommendation

#### Shared Global State (Pydantic Model – saved as `state_{run_id}.json`)

```python
from pydantic import BaseModel, Field
from datetime import datetime
from typing import List, Dict, Any, Optional

class TradingState(BaseModel):
    run_id: str = Field(default_factory=lambda: uuid.uuid4().hex)
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    
    # User inputs
    user_inputs: Dict[str, Any]
    
    # Phase 1
    candidate_tickers: List[str] = []           # top 80 after screening
    fundamental_reports: Dict[str, Any] = {}
    technical_reports: Dict[str, Any] = {}
    news_reports: Dict[str, List[dict]] = {}
    sentiment_reports: Dict[str, float] = {}    # -1.0 to +1.0
    
    # Phase 2
    bull_case: str = ""
    bear_case: str = ""
    debate_summary: str = ""
    
    # Phase 3
    trader_proposal: List[Dict[str, Any]] = []  # ticker, score, raw_allocation
    
    # Phase 4
    risk_votes: Dict[str, str] = {}
    risk_adjusted_proposal: List[Dict] = []
    vix_level: float = 0.0
    high_volatility_tickers: List[str] = []
    
    # Phase 5
    final_portfolio: List[Dict[str, Any]] = []  # ticker, name, allocation%, reasoning
    full_transcript: List[Dict] = []            # every agent message with timestamp
```

#### Tools (All Wrapped with Retry + Cost Tracking)

```python
tools = [
    {
        "type": "function",
        "function": {
            "name": "get_vix_level",
            "description": "Return current VIX",
            "parameters": {"type": "object", "properties": {}, "required": []}
        }
    },
    {
        "name": "grok_realtime_search",
        "description": "Real-time web + X search powered by Grok",
        "parameters": {"type": "object", "properties": {"query": {"type": "string"}}, "required": ["query"]}
    },
    {
        "name": "get_stock_fundamentals",
        "parameters": {"type": "object", "properties": {"ticker": {"type": "string"}}, "required": ["ticker"]}
    },
    {
        "name": "get_historical_prices",
        "parameters": {...}
    },
    {
        "name": "calculate_technical_indicators",
        "parameters": {...}
    }
]
```

#### Exact Swarm Implementation Skeleton (Ready to Run)

```python
# main.py
import uuid
from swarm import Swarm
from litellm import completion
import json, os
from state import TradingState
from agents import *

client = Swarm()

# Model routing
def get_model(agent_name: str):
    if "Bull" in agent_name or "Bear" in agent_name or "Debate" in agent_name:
        return "openai/o1-preview"
    return "grok/grok-4"

# Master orchestration
def run_athena_advisory(user_inputs: dict):
    run_id = uuid.uuid4().hex
    state = TradingState(run_id=run_id, user_inputs=user_inputs)
    
    # === PHASE 1: Screening & Analysis ===
    state = client.run(agent=market_scanner, state=state, model=get_model("scanner"))
    state = client.run_parallel([
        (fundamental_analyst, state),
        (technical_analyst, state),
        (news_analyst, state),
        (sentiment_analyst, state)
    ])
    
    # === PHASE 2: Debate ===
    state = client.run(agent=bull_researcher, state=state, model="openai/o1-preview")
    state = client.run(agent=bear_researcher, state=state, model="openai/o1-preview")
    state = client.run(agent=debate_moderator, state=state, model="openai/o1-preview")
    
    # === PHASE 3: Trader Proposal ===
    state = client.run(agent=trader_agent, state=state)
    
    # === PHASE 4: Risk Management ===
    state = client.run(agent=get_vix_agent, state=state)  # updates state.vix_level
    state = client.run_parallel([
        (aggressive_risk_agent, state),
        (neutral_risk_agent, state),
        (conservative_risk_agent, state),  # has veto
    ])
    state = client.run(agent=risk_supervisor, state=state)
    
    # === PHASE 5: Final Approval ===
    state = client.run(agent=fund_manager, state=state)
    state = client.run(agent=report_writer, state=state)
    
    # Save full state + transcript
    os.makedirs("runs", exist_ok=True)
    with open(f"runs/{run_id}_state.json", "w") as f:
        json.dump(state.model_dump(), f, indent=2, default=str)
    
    return state.final_portfolio, state.full_transcript
```

#### Final Output Example (What User Sees)

```markdown
ATHENA ADVISORY – March 15, 2025 | Run ID: a1b2c3d4
Risk Profile: Aggressive | Horizon: 7 years | Requested: 7 stocks

VIX = 18.2 (normal market regime)

FINAL RECOMMENDED PORTFOLIO

1. NVDA  – 24%  – Strong AI moat, earnings beat, bullish sentiment
2. IONQ – 18%  – Quantum leadership, partnerships accelerating
3. SMCI  – 16%  – AI server demand explosion
4. PLTR  – 14%  – Government contracts expanding
5. ARM   – 12%  – Mobile + edge AI dominance
6. CRWD  – 10%  – Cybersecurity tailwinds
7. ASML  – 6%   – EUV monopoly, long-term winner

Total: 100% | Max single position capped at 30%
Full 87-page reasoning transcript available (JSON)
```

