import { useState } from "react";
import { AlertTriangle, CheckCircle2, HelpCircle, Search, ShieldAlert, ShieldCheck, XCircle } from "lucide-react";
import { screenTicker } from "./api";

const outcomeConfig = {
  pass: { icon: CheckCircle2, label: "Passes", className: "outcome-pass" },
  fail: { icon: XCircle, label: "Fails", className: "outcome-fail" },
  needs_review: { icon: HelpCircle, label: "Needs Review", className: "outcome-review" },
  insufficient_or_stale_evidence: { icon: AlertTriangle, label: "Insufficient / Stale Evidence", className: "outcome-insufficient" },
};

const checkResultConfig = {
  pass: { icon: CheckCircle2, className: "check-pass" },
  fail: { icon: XCircle, className: "check-fail" },
  needs_review: { icon: HelpCircle, className: "check-review" },
  insufficient_data: { icon: AlertTriangle, className: "check-insufficient" },
};

export default function App() {
  const [ticker, setTicker] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [isDemo, setIsDemo] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    const t = ticker.trim().toUpperCase();
    if (!t) return;
    setLoading(true);
    setError("");
    setResult(null);

    try {
      const json = await screenTicker(t);
      setResult(json.data);
      setIsDemo(json.demo);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const OutcomeIcon = result ? outcomeConfig[result.outcome]?.icon || AlertTriangle : null;

  return (
    <main className="page">
      <section className="panel sidebar">
        <h1><ShieldCheck size={24} /> Sharia Screener</h1>
        <p className="sub">Check a ticker against Sharia compliance screening criteria.</p>

        <form onSubmit={handleSubmit} className="search-form">
          <div className="search-box">
            <Search size={18} />
            <input
              type="text"
              placeholder="Enter ticker (e.g. AAPL)"
              value={ticker}
              onChange={(e) => setTicker(e.target.value.toUpperCase())}
              disabled={loading}
              autoFocus
            />
          </div>
          <button disabled={loading || !ticker.trim()} className="cta" type="submit">
            {loading ? "Screening..." : "Screen"}
          </button>
        </form>

        {error && <p className="error"><AlertTriangle size={16} /> {error}</p>}

        <div className="info-box">
          <ShieldAlert size={16} />
          <span>
            Placeholder thresholds only. Not reviewed by a qualified Sharia adviser.
            Do not use for investment decisions without independent certification.
          </span>
        </div>
      </section>

      <section className="panel results">
        {!result && !error && !loading && (
          <p className="empty">Enter a ticker to see its Sharia compliance screening result.</p>
        )}

        {result && (
          <>
            {isDemo && <p className="demo-banner"><AlertTriangle size={14} /> Demo data &mdash; these figures are fictional test fixtures, not real financial data.</p>}

            <div className="result-header">
              <h2>{result.ticker} &mdash; {result.companyName}</h2>
            </div>

            <div className={`outcome-badge ${outcomeConfig[result.outcome]?.className || ""}`}>
              {OutcomeIcon && <OutcomeIcon size={20} />}
              <span>{outcomeConfig[result.outcome]?.label || result.outcome}</span>
            </div>

            <div className="methodology-info">
              <span>Methodology: {result.methodology.name} v{result.methodology.version}</span>
              {result.asOfDate && <span>Data as of: {result.asOfDate}</span>}
              <span>Screened at: {new Date(result.screenedAt).toLocaleString()}</span>
            </div>

            <h3>Per-Check Results</h3>
            <div className="checks-list">
              {result.checks.map((check) => {
                const cfg = checkResultConfig[check.result] || checkResultConfig.insufficient_data;
                const Icon = cfg.icon;
                return (
                  <div key={check.checkId} className={`check-item ${cfg.className}`}>
                    <div className="check-header">
                      <Icon size={16} />
                      <strong>{check.label}</strong>
                      <span className="check-result-label">{check.result.replace(/_/g, " ")}</span>
                    </div>
                    <p className="check-reason">{check.reason}</p>
                    {check.value != null && (
                      <div className="check-detail">
                        Value: <code>{typeof check.value === "number" ? (check.value * 100).toFixed(2) + "%" : check.value}</code>
                        {check.threshold != null && <> &middot; Threshold: <code>{typeof check.threshold === "number" ? (check.threshold * 100).toFixed(1) + "%" : check.threshold}</code></>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {result.missingFields.length > 0 && (
              <div className="missing-fields">
                <AlertTriangle size={14} />
                <span>Missing evidence fields: {result.missingFields.join(", ")}</span>
              </div>
            )}

            <p className="disclaimer">{result.disclaimer}</p>
          </>
        )}
      </section>
    </main>
  );
}
