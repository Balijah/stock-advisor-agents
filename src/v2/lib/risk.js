export const MAX_SINGLE_ALLOCATION = 30;

export function applyRisk({ ranked, technicalsByTicker, vixLevel }) {
  const highVolTickers = ranked
    .filter((r) => Number(technicalsByTicker[r.ticker]?.atr_pct ?? 0) > 0.08)
    .map((r) => r.ticker);

  const veto = vixLevel > 30 || highVolTickers.length > 0;
  const marketRegime = vixLevel > 25 ? "elevated_volatility" : "normal";

  const adjusted = ranked.map((item, idx) => {
    const atrPct = Number(technicalsByTicker[item.ticker]?.atr_pct ?? 0);
    const base = Math.max(0.05, 1 / Math.max(1, ranked.length));
    const volPenalty = atrPct > 0.08 ? 0.06 : 0;
    const regimePenalty = vixLevel > 30 ? 0.03 : 0;
    const rankBoost = Math.max(0, (ranked.length - idx) * 0.01);
    return {
      ...item,
      raw_weight: Math.max(0.03, base + rankBoost - volPenalty - regimePenalty),
      risk_flags: [
        ...(atrPct > 0.08 ? ["high_atr"] : []),
        ...(vixLevel > 30 ? ["high_vix"] : []),
      ],
    };
  });

  return {
    adjusted,
    veto,
    highVolTickers,
    marketRegime,
  };
}

export function allocateWeights(items) {
  const total = items.reduce((sum, i) => sum + i.raw_weight, 0) || 1;
  const base = items.map((i) => ({ ...i, allocation_pct: (i.raw_weight / total) * 100 }));
  const result = base.map((i) => ({ ...i, allocation_pct: 0 }));

  let remaining = 100;
  let active = base.map((_, idx) => idx);

  while (active.length > 0 && remaining > 0) {
    const activeWeight = active.reduce((sum, idx) => sum + base[idx].raw_weight, 0) || 1;
    const nextActive = [];

    active.forEach((idx) => {
      const proportional = (base[idx].raw_weight / activeWeight) * remaining;
      const allowed = Math.min(MAX_SINGLE_ALLOCATION - result[idx].allocation_pct, proportional);
      const applied = Math.max(0, allowed);
      result[idx].allocation_pct += applied;
      remaining -= applied;
      if (result[idx].allocation_pct < MAX_SINGLE_ALLOCATION - 1e-9) {
        nextActive.push(idx);
      }
    });

    if (nextActive.length === active.length) break;
    active = nextActive;
  }

  const rounded = result.map((i) => ({
    ...i,
    allocation_pct: Number(i.allocation_pct.toFixed(1)),
  }));
  const roundedTotal = rounded.reduce((sum, i) => sum + i.allocation_pct, 0);
  const drift = Number((100 - roundedTotal).toFixed(1));
  if (Math.abs(drift) > 0 && rounded.length > 0) {
    const idx = rounded.findIndex((r) =>
      drift > 0 ? r.allocation_pct < MAX_SINGLE_ALLOCATION : r.allocation_pct > 0
    );
    if (idx >= 0) {
      const maxAdd = MAX_SINGLE_ALLOCATION - rounded[idx].allocation_pct;
      const maxSub = rounded[idx].allocation_pct;
      const safeDelta = drift > 0 ? Math.min(drift, maxAdd) : Math.max(drift, -maxSub);
      rounded[idx].allocation_pct = Number((rounded[idx].allocation_pct + safeDelta).toFixed(1));
    }
  }
  return rounded;
}
