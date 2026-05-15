export function buildAnalyzePayload(form) {
  return {
    risk_tolerance: form.risk_tolerance,
    investment_horizon_years: Number(form.investment_horizon_years),
    preferred_sectors: form.preferred_sectors || [],
    num_stocks_requested: Number(form.num_stocks_requested),
    min_volume: Number(form.min_volume),
  };
}

export function isMobileLayout(width) {
  return width <= 960;
}
