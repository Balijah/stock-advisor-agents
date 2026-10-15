/**
 * Pure screening engine.
 *
 * Takes a company's evidence and a methodology config, returns a
 * structured compliance result. No side effects, no network calls.
 */

import { AAOIFI_PLACEHOLDER, getMethodology } from "./methodology.js";

const STALE_DAYS = 365;

export function screenCompany(evidence, { methodologyId } = {}) {
  const methodology = getMethodology(methodologyId) || AAOIFI_PLACEHOLDER;

  const checks = [];
  const missingFields = [];

  const businessCheck = runBusinessActivityCheck(evidence, methodology);
  checks.push(businessCheck);

  if (businessCheck.result === "fail") {
    return buildResult({
      outcome: "fail",
      checks,
      missingFields,
      evidence,
      methodology,
    });
  }

  const financialChecks = runFinancialRatioChecks(evidence, methodology);
  checks.push(...financialChecks.checks);
  missingFields.push(...financialChecks.missingFields);

  const stalenessCheck = runStalenessCheck(evidence);
  checks.push(stalenessCheck);

  return buildResult({
    outcome: deriveOutcome(checks, missingFields),
    checks,
    missingFields,
    evidence,
    methodology,
  });
}

function runBusinessActivityCheck(evidence, methodology) {
  const classification = evidence.businessActivity?.classification;

  if (!classification) {
    return {
      checkId: "business-activity",
      label: "Business Activity Screen",
      result: "insufficient_data",
      reason: "No business activity classification provided.",
      value: null,
      threshold: null,
    };
  }

  const screen = methodology.businessActivityScreen;

  if (screen.prohibited.includes(classification)) {
    return {
      checkId: "business-activity",
      label: "Business Activity Screen",
      result: "fail",
      reason: `Core business activity "${classification}" is in the prohibited list.`,
      value: classification,
      threshold: "not in prohibited list",
    };
  }

  if (screen.requiresReview.includes(classification)) {
    return {
      checkId: "business-activity",
      label: "Business Activity Screen",
      result: "needs_review",
      reason: `Business activity "${classification}" requires Sharia adviser review.`,
      value: classification,
      threshold: "not in review-required list",
    };
  }

  return {
    checkId: "business-activity",
    label: "Business Activity Screen",
    result: "pass",
    reason: `Business activity "${classification}" is permissible.`,
    value: classification,
    threshold: "permissible activity",
  };
}

function runFinancialRatioChecks(evidence, methodology) {
  const checks = [];
  const missingFields = [];
  const fin = evidence.financials || {};
  const marketCap = fin.marketCap;

  const debtCheck = ratioCheck({
    checkId: "debt-ratio",
    label: methodology.financialRatios.debtRatio.label,
    numerator: fin.interestBearingDebt,
    denominator: marketCap,
    threshold: methodology.financialRatios.debtRatio.threshold,
    operator: methodology.financialRatios.debtRatio.operator,
    numeratorLabel: "interestBearingDebt",
    denominatorLabel: "marketCap",
    missingFields,
  });
  checks.push(debtCheck);

  const cashCheck = ratioCheck({
    checkId: "cash-interest-bearing",
    label: methodology.financialRatios.cashAndInterestBearingSecurities.label,
    numerator: fin.cashAndInterestBearingSecurities,
    denominator: marketCap,
    threshold: methodology.financialRatios.cashAndInterestBearingSecurities.threshold,
    operator: methodology.financialRatios.cashAndInterestBearingSecurities.operator,
    numeratorLabel: "cashAndInterestBearingSecurities",
    denominatorLabel: "marketCap",
    missingFields,
  });
  checks.push(cashCheck);

  const impureCheck = ratioCheck({
    checkId: "impure-income",
    label: methodology.financialRatios.impureIncomeRatio.label,
    numerator: fin.impureIncome,
    denominator: fin.totalRevenue,
    threshold: methodology.financialRatios.impureIncomeRatio.threshold,
    operator: methodology.financialRatios.impureIncomeRatio.operator,
    numeratorLabel: "impureIncome",
    denominatorLabel: "totalRevenue",
    missingFields,
  });
  checks.push(impureCheck);

  const arCheck = ratioCheck({
    checkId: "accounts-receivable",
    label: methodology.financialRatios.accountsReceivableRatio.label,
    numerator: fin.accountsReceivable,
    denominator: marketCap,
    threshold: methodology.financialRatios.accountsReceivableRatio.threshold,
    operator: methodology.financialRatios.accountsReceivableRatio.operator,
    numeratorLabel: "accountsReceivable",
    denominatorLabel: "marketCap",
    missingFields,
  });
  checks.push(arCheck);

  return { checks, missingFields };
}

function ratioCheck({
  checkId,
  label,
  numerator,
  denominator,
  threshold,
  operator,
  numeratorLabel,
  denominatorLabel,
  missingFields,
}) {
  if (numerator == null) missingFields.push(numeratorLabel);
  if (denominator == null) missingFields.push(denominatorLabel);

  if (numerator == null || denominator == null || denominator === 0) {
    return {
      checkId,
      label,
      result: "insufficient_data",
      reason: `Missing ${[
        numerator == null ? numeratorLabel : null,
        denominator == null || denominator === 0 ? denominatorLabel : null,
      ]
        .filter(Boolean)
        .join(", ")}.`,
      value: null,
      threshold,
    };
  }

  const ratio = numerator / denominator;
  const passes = operator === "<=" ? ratio <= threshold : ratio < threshold;

  return {
    checkId,
    label,
    result: passes ? "pass" : "fail",
    reason: passes
      ? `${label}: ${formatPct(ratio)} ${operator} ${formatPct(threshold)} threshold.`
      : `${label}: ${formatPct(ratio)} exceeds ${formatPct(threshold)} threshold.`,
    value: Number(ratio.toFixed(6)),
    threshold,
  };
}

function runStalenessCheck(evidence) {
  const periodEnd = evidence.financials?.periodEnd;
  if (!periodEnd) {
    return {
      checkId: "data-staleness",
      label: "Data Staleness",
      result: "insufficient_data",
      reason: "No financial period end date provided.",
      value: null,
      threshold: `${STALE_DAYS} days`,
    };
  }

  const endDate = new Date(periodEnd);
  if (isNaN(endDate.getTime())) {
    return {
      checkId: "data-staleness",
      label: "Data Staleness",
      result: "insufficient_data",
      reason: "Invalid period end date.",
      value: periodEnd,
      threshold: `${STALE_DAYS} days`,
    };
  }

  const daysSince = Math.floor((Date.now() - endDate.getTime()) / 86400000);
  const stale = daysSince > STALE_DAYS;

  return {
    checkId: "data-staleness",
    label: "Data Staleness",
    result: stale ? "needs_review" : "pass",
    reason: stale
      ? `Financial data is ${daysSince} days old (threshold: ${STALE_DAYS} days).`
      : `Financial data is ${daysSince} days old (within ${STALE_DAYS}-day window).`,
    value: daysSince,
    threshold: `${STALE_DAYS} days`,
  };
}

function deriveOutcome(checks, missingFields) {
  if (checks.some((c) => c.result === "fail")) return "fail";
  if (missingFields.length > 0 || checks.some((c) => c.result === "insufficient_data")) {
    return "insufficient_or_stale_evidence";
  }
  if (checks.some((c) => c.result === "needs_review")) return "needs_review";
  return "pass";
}

function buildResult({ outcome, checks, missingFields, evidence, methodology }) {
  return {
    outcome,
    ticker: evidence.ticker || null,
    companyName: evidence.companyName || null,
    methodology: {
      id: methodology.id,
      version: methodology.version,
      name: methodology.name,
    },
    asOfDate: evidence.financials?.periodEnd || null,
    screenedAt: new Date().toISOString(),
    checks,
    missingFields: [...new Set(missingFields)],
    disclaimer:
      "This screening uses placeholder thresholds that have NOT been reviewed " +
      "by a qualified Sharia adviser. Do not rely on this result for " +
      "investment decisions without independent Sharia certification.",
  };
}

function formatPct(n) {
  return `${(n * 100).toFixed(1)}%`;
}
