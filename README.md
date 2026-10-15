# Sharia Compliance Screener

Screens public equities against Sharia compliance criteria using a pluggable evidence-provider architecture and a versioned, configurable methodology.

> **Disclaimer:** The screening thresholds shipped here are **placeholders** loosely modeled on publicly available AAOIFI guidelines. They have **not** been reviewed or approved by a qualified Sharia adviser. Do not rely on screening results for investment decisions without independent Sharia certification.

## Architecture

```
src/
  screening/          Screening engine (pure functions, no I/O)
    methodology.js    Named, versioned methodology config (AAOIFI placeholder)
    screen.js         screenCompany(evidence, opts) → structured result
    index.js          Re-exports

  providers/          Evidence provider interface + implementations
    interface.js      EvidenceProvider base class
    demoFixtures.js   Demo fixture provider (~25 fictional companies)
    index.js          Re-exports

server.js             Express API (health, tickers, screening, methodologies)
client/               React frontend (Vite) – search box + result view
tests/                Unit & integration tests (node:test, no credentials needed)
```

## Quick start

```bash
npm install
npm run start:api        # API on http://localhost:3001
npm run dev:client       # Vite dev server on http://localhost:5173
```

## API endpoints

All endpoints under `/api/v1/`. When `API_KEY` env var is set, auth-protected endpoints require `Authorization: Bearer <key>` or `x-api-key: <key>`.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/v1/health` | No | Health check, provider info |
| GET | `/api/v1/methodologies` | No | List available screening methodologies |
| GET | `/api/v1/methodologies/:id` | No | Get full methodology definition |
| GET | `/api/v1/tickers` | Yes | List tickers in the provider's directory |
| GET | `/api/v1/screen/:ticker` | Yes | Screen a single ticker; returns outcome, per-check evidence, methodology label, and as-of dates |

### Example: screen a ticker

```bash
curl http://localhost:3001/api/v1/screen/AAPL | jq .
```

Response shape:
```json
{
  "success": true,
  "demo": true,
  "data": {
    "outcome": "pass",
    "ticker": "AAPL",
    "companyName": "Apple Inc",
    "methodology": { "id": "aaoifi-placeholder", "version": "0.1.0", "name": "..." },
    "asOfDate": "2026-06-30",
    "screenedAt": "2026-10-15T...",
    "checks": [ ... ],
    "missingFields": [],
    "disclaimer": "..."
  }
}
```

Unknown tickers are rejected with a 404, not invented.

## Screening methodology

The default (and currently only) methodology is `aaoifi-placeholder` v0.1.0. It applies:

1. **Business activity screen** – companies in prohibited sectors (conventional banking, alcohol, tobacco, pork, gambling, adult entertainment, controversial weapons) fail outright. Mixed/ambiguous activities (entertainment, hospitality, conglomerates) return `needs_review`.

2. **Financial ratio screens** (applied only if business activity passes):
   - Interest-bearing debt / market cap ≤ 33%
   - Cash + interest-bearing securities / market cap ≤ 33%
   - Impure income / total revenue ≤ 5%
   - Accounts receivable / market cap ≤ 49%

3. **Data staleness check** – financial data older than 365 days triggers `needs_review`.

Possible outcomes: `pass`, `fail`, `needs_review`, `insufficient_or_stale_evidence`.

## Evidence providers

The app uses a provider interface (`EvidenceProvider` base class) to decouple the screening engine from data sources. Currently ships with a **demo fixture provider** containing ~25 fictional companies covering:
- Clear passes (MSFT, AAPL, JNJ, NVDA, GOOGL, etc.)
- Clear fails (JPM, BAC, DEO, PM, MGM, HIGHDEBT, HIGHCASH)
- Needs-review (DIS, MAR, BRK.B, BORDERLINE)
- Missing/incomplete evidence (NODATA, PARTIAL, NOCLASS, STALE)

To plug in a real data source (Zoya, Musaffa, SEC EDGAR XBRL), implement the `EvidenceProvider` interface and wire it into `server.js`.

## LLM usage

The LLM is **not used** in the current build. The screening engine is pure computation against the methodology config and evidence. An optional LLM explainer could be wired in to narrate an already-computed result, but it would never decide pass/fail.

## Tests

```bash
npm test
```

67 tests covering:
- Screening logic (pass, fail, needs_review, boundary conditions, missing data, stale data)
- Provider interface and demo fixtures
- Methodology config
- API endpoints (health, tickers, screening, auth, unknown ticker rejection)
- Integration tests (all fixture companies through the full screening pipeline)

No API keys or network access required.

## Environment variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `PORT` | No | `3001` | Server listen port |
| `API_KEY` | No | — | When set, protected endpoints require this key |
| `CORS_ORIGIN` | No | `*` (dev) / blocked (prod) | Allowed CORS origin |
| `RATE_LIMIT_WINDOW_MS` | No | `60000` | Rate-limit window (ms) |
| `RATE_LIMIT_MAX` | No | `60` | Max requests per window |

## Build

```bash
npm run build:client     # Production Vite build
```
