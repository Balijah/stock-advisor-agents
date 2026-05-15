import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, LoaderCircle, ShieldCheck, TrendingUp, XCircle } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { buildAnalyzePayload } from "./api";
import { initialWorkflowState, reduceWorkflow, stageOrder } from "./workflow";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:3001";
const sectorOptions = ["AI", "Semiconductors", "Energy", "Healthcare", "Utilities", "Financials", "Industrials", "Consumer Staples", "Consumer Discretionary", "Real Estate", "Materials", "Technology"];

const initialForm = {
  risk_tolerance: "neutral",
  investment_horizon_years: 5,
  preferred_sectors: ["AI", "Semiconductors"],
  num_stocks_requested: 5,
  min_volume: 500000,
};

export default function App() {
  const [form, setForm] = useState(initialForm);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [workflow, setWorkflow] = useState(initialWorkflowState());
  const [runId, setRunId] = useState(null);
  const startTs = useRef(0);

  const sorted = useMemo(
    () => [...(result?.portfolio || [])].sort((a, b) => b.allocation_pct - a.allocation_pct),
    [result]
  );

  const elapsedSec = useMemo(() => {
    if (!loading || !startTs.current) return 0;
    return Math.max(0, Math.round((Date.now() - startTs.current) / 1000));
  }, [loading, workflow.events.length]);

  useEffect(() => {
    if (!runId || !loading) return undefined;

    const ev = new EventSource(`${API_BASE}/api/v2/runs/${runId}/events`);
    ev.addEventListener("workflow", (m) => {
      try {
        const data = JSON.parse(m.data);
        setWorkflow((prev) => reduceWorkflow(prev, data));
      } catch {
        // ignore malformed event
      }
    });

    ev.onerror = () => {
      // keep open unless closed by completion
    };

    return () => ev.close();
  }, [runId, loading]);

  async function fetchFinal(run_id) {
    const res = await fetch(`${API_BASE}/api/v2/runs/${run_id}`);
    const json = await res.json();
    if (!res.ok || !json.success) throw new Error(json?.error?.message || "Failed fetching run result");
    return json.data.result || json.data;
  }

  async function analyze(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setResult(null);
    setWorkflow(initialWorkflowState());
    startTs.current = Date.now();

    try {
      const createRes = await fetch(`${API_BASE}/api/v2/runs`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(buildAnalyzePayload(form)),
      });
      const createJson = await createRes.json();
      if (!createRes.ok || !createJson.success) throw new Error(createJson?.error?.message || "Run creation failed");

      const id = createJson.data.run_id;
      setRunId(id);

      let done = false;
      const deadline = Date.now() + 120000;
      while (!done && Date.now() < deadline) {
        const runRes = await fetch(`${API_BASE}/api/v2/runs/${id}`);
        const runJson = await runRes.json();
        const status = runJson?.data?.status;
        if (status === "completed") {
          done = true;
          const finalData = runJson?.data?.result || (await fetchFinal(id));
          setResult(finalData);
        } else if (status === "failed") {
          done = true;
          throw new Error(runJson?.data?.error || "Run failed");
        } else {
          await new Promise((r) => setTimeout(r, 1200));
        }
      }
      if (!done) throw new Error("Run timed out while waiting for completion");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="page">
      <section className="panel">
        <h1>Athena Advisory V2</h1>
        <p className="sub">Actionable allocation with confidence and thesis-level explainability.</p>
        <form onSubmit={analyze} className="form-grid">
          <label>Risk tolerance
            <select value={form.risk_tolerance} onChange={(e) => setForm({ ...form, risk_tolerance: e.target.value })}>
              <option value="aggressive">Aggressive</option>
              <option value="neutral">Neutral</option>
              <option value="conservative">Conservative</option>
            </select>
          </label>
          <label>Horizon (years)
            <input type="number" min="0.02" max="20" step="0.1" value={form.investment_horizon_years} onChange={(e) => setForm({ ...form, investment_horizon_years: e.target.value })} />
          </label>
          <label>Requested picks
            <input type="number" min="1" max="10" value={form.num_stocks_requested} onChange={(e) => setForm({ ...form, num_stocks_requested: e.target.value })} />
          </label>
          <label>Min volume
            <input type="number" min="0" value={form.min_volume} onChange={(e) => setForm({ ...form, min_volume: e.target.value })} />
          </label>
          <label className="full">Preferred sectors
            <div className="chips">
              {sectorOptions.map((sector) => {
                const active = form.preferred_sectors.includes(sector);
                return (
                  <button key={sector} type="button" className={active ? "chip active" : "chip"} onClick={() => setForm({ ...form, preferred_sectors: active ? form.preferred_sectors.filter((s) => s !== sector) : [...form.preferred_sectors, sector] })}>
                    {sector}
                  </button>
                );
              })}
            </div>
          </label>
          <button disabled={loading} className="cta" type="submit">{loading ? "Running analysis..." : "Run Analysis"}</button>
        </form>
        {error && <p className="error"><AlertTriangle size={16} /> {error}</p>}
      </section>

      <section className="panel results">
        {loading && (
          <section className="workflow">
            <div className="result-header">
              <h2>Live Agent Workflow</h2>
              <div className="meta">Run {runId || "..."} | {workflow.runStatus} | {elapsedSec}s</div>
            </div>
            <p className="sub">Current stage: <strong>{workflow.currentStage}</strong></p>

            <div className="metrics-grid">
              <div>Discovered: {workflow.metrics.discovered_count || 0}</div>
              <div>Validated: {workflow.metrics.validated_count || 0}</div>
              <div>Enriched: {workflow.metrics.enriched_count || 0}</div>
              <div>Excluded by sector: {workflow.metrics.excluded_by_sector || 0}</div>
            </div>

            <div className="stage-list">
              {stageOrder.map((s) => {
                const info = workflow.stageStatuses[s] || { status: "pending", warning_count: 0 };
                return (
                  <div key={s} className={`stage-item ${info.status}`}>
                    <span className="stage-icon">{renderStatusIcon(info.status)}</span>
                    <span>{s}</span>
                    <span className="stage-meta">{info.duration_ms ? `${info.duration_ms}ms` : ""} {info.warning_count ? `| warnings:${info.warning_count}` : ""}</span>
                  </div>
                );
              })}
            </div>

            <details className="transcript" open>
              <summary>Live Timeline</summary>
              {workflow.events.slice(-30).map((evt, idx) => (
                <p key={`${evt.timestamp}-${idx}`}><strong>{evt.event_type}</strong> [{evt.timestamp}] {evt.stage || "run"} {evt.message || ""}</p>
              ))}
            </details>
          </section>
        )}

        {!loading && !result && <p className="empty">No run yet. Submit preferences to generate recommendations.</p>}
        {!loading && result && (
          <>
            <div className="result-header">
              <h2>Portfolio</h2>
              <div className="meta">Run {result.run_id} | {result.market_regime}</div>
            </div>

            {result.degraded_mode && <p className="warning"><AlertTriangle size={16} /> Partial-data mode: {result.warnings.join(" | ")}</p>}

            <div className="chart-wrap">
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={sorted}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="ticker" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="allocation_pct" fill="#0f9d7a" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="cards">
              {sorted.map((item) => (
                <article key={item.ticker} className="card">
                  <header>
                    <strong>{item.ticker}</strong>
                    <span>{item.allocation_pct}%</span>
                  </header>
                  <p>{item.thesis}</p>
                  <div className="row"><TrendingUp size={14} /> Score {item.score} | Confidence {Math.round(item.confidence * 100)}%</div>
                  <div className="row"><ShieldCheck size={14} /> Flags: {item.risk_flags.length ? item.risk_flags.join(", ") : "none"}</div>
                  <ul>
                    {item.key_signals.map((s) => <li key={s}>{s}</li>)}
                  </ul>
                  {!!item.citations.length && (
                    <details>
                      <summary>Citations ({item.citations.length})</summary>
                      {item.citations.filter((c)=>typeof c === "string" && /^https?:\/\//.test(c)).map((c, idx) => <a key={`${item.ticker}-${idx}`} href={c} target="_blank" rel="noreferrer">{c}</a>)}
                    </details>
                  )}
                </article>
              ))}
            </div>

            <details className="transcript">
              <summary>Run detail timeline</summary>
              <p>Saved artifact: {result.transcript_ref}</p>
              {(result.transcript || []).map((line, idx) => (
                <p key={idx}><strong>{line.stage}</strong> [{line.timestamp}] {line.message}</p>
              ))}
            </details>
          </>
        )}
      </section>
    </main>
  );
}

function renderStatusIcon(status) {
  if (status === "running") return <LoaderCircle size={16} className="spin" />;
  if (status === "success" || status === "completed") return <CheckCircle2 size={16} />;
  if (status === "degraded") return <AlertTriangle size={16} />;
  if (status === "failed") return <XCircle size={16} />;
  return <LoaderCircle size={16} />;
}
