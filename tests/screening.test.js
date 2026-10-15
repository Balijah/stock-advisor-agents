import test from "node:test";
import assert from "node:assert/strict";
import { screenCompany } from "../src/screening/screen.js";

// --- Helpers ---

function makeEvidence(overrides = {}) {
  return {
    ticker: "TEST",
    companyName: "Test Corp",
    businessActivity: {
      classification: "technology",
      description: "Software",
      source: "test",
    },
    financials: {
      marketCap: 100_000_000_000,
      totalAssets: 50_000_000_000,
      interestBearingDebt: 10_000_000_000,
      cashAndInterestBearingSecurities: 5_000_000_000,
      accountsReceivable: 8_000_000_000,
      totalRevenue: 40_000_000_000,
      impureIncome: 500_000_000,
      periodEnd: new Date().toISOString().split("T")[0],
      source: "test",
    },
    ...overrides,
  };
}

// ===== CLEAR PASS =====

test("screening: clear pass for compliant company", () => {
  const evidence = makeEvidence();
  const result = screenCompany(evidence);

  assert.equal(result.outcome, "pass");
  assert.equal(result.ticker, "TEST");
  assert.ok(result.checks.length >= 5);
  assert.ok(result.checks.every((c) => c.result === "pass"));
  assert.equal(result.missingFields.length, 0);
  assert.ok(result.disclaimer.includes("placeholder"));
  assert.ok(result.methodology.id === "aaoifi-placeholder");
  assert.ok(result.methodology.version);
});

test("screening: pass preserves methodology metadata", () => {
  const result = screenCompany(makeEvidence());
  assert.equal(result.methodology.id, "aaoifi-placeholder");
  assert.equal(result.methodology.version, "0.1.0");
  assert.ok(result.methodology.name.includes("AAOIFI"));
});

// ===== BUSINESS ACTIVITY FAILS =====

test("screening: fail for conventional banking", () => {
  const evidence = makeEvidence({
    businessActivity: { classification: "conventional-banking", description: "Bank", source: "test" },
  });
  const result = screenCompany(evidence);

  assert.equal(result.outcome, "fail");
  const businessCheck = result.checks.find((c) => c.checkId === "business-activity");
  assert.equal(businessCheck.result, "fail");
  assert.ok(businessCheck.reason.includes("prohibited"));
});

test("screening: fail for alcohol", () => {
  const evidence = makeEvidence({
    businessActivity: { classification: "alcohol", description: "Spirits", source: "test" },
  });
  assert.equal(screenCompany(evidence).outcome, "fail");
});

test("screening: fail for gambling", () => {
  const evidence = makeEvidence({
    businessActivity: { classification: "gambling", description: "Casino", source: "test" },
  });
  assert.equal(screenCompany(evidence).outcome, "fail");
});

test("screening: fail for tobacco", () => {
  const evidence = makeEvidence({
    businessActivity: { classification: "tobacco", description: "Tobacco", source: "test" },
  });
  assert.equal(screenCompany(evidence).outcome, "fail");
});

test("screening: prohibited business short-circuits (no financial ratio checks)", () => {
  const evidence = makeEvidence({
    businessActivity: { classification: "conventional-banking", description: "Bank", source: "test" },
  });
  const result = screenCompany(evidence);

  assert.equal(result.outcome, "fail");
  assert.equal(result.checks.length, 1);
  assert.equal(result.checks[0].checkId, "business-activity");
});

// ===== BUSINESS ACTIVITY NEEDS REVIEW =====

test("screening: needs_review for entertainment", () => {
  const evidence = makeEvidence({
    businessActivity: { classification: "entertainment", description: "Media", source: "test" },
  });
  const result = screenCompany(evidence);

  assert.equal(result.outcome, "needs_review");
  const businessCheck = result.checks.find((c) => c.checkId === "business-activity");
  assert.equal(businessCheck.result, "needs_review");
});

test("screening: needs_review for conglomerate", () => {
  const evidence = makeEvidence({
    businessActivity: { classification: "conglomerate", description: "Diversified", source: "test" },
  });
  assert.equal(screenCompany(evidence).outcome, "needs_review");
});

test("screening: needs_review for hospitality", () => {
  const evidence = makeEvidence({
    businessActivity: { classification: "hospitality", description: "Hotels", source: "test" },
  });
  assert.equal(screenCompany(evidence).outcome, "needs_review");
});

// ===== FINANCIAL RATIO FAILS =====

test("screening: fail when debt ratio exceeds 33%", () => {
  const evidence = makeEvidence({
    financials: {
      ...makeEvidence().financials,
      interestBearingDebt: 50_000_000_000,
      marketCap: 100_000_000_000,
    },
  });
  const result = screenCompany(evidence);

  assert.equal(result.outcome, "fail");
  const debtCheck = result.checks.find((c) => c.checkId === "debt-ratio");
  assert.equal(debtCheck.result, "fail");
  assert.ok(debtCheck.value > 0.33);
});

test("screening: fail when cash/interest-bearing securities ratio exceeds 33%", () => {
  const evidence = makeEvidence({
    financials: {
      ...makeEvidence().financials,
      cashAndInterestBearingSecurities: 50_000_000_000,
      marketCap: 100_000_000_000,
    },
  });
  const result = screenCompany(evidence);

  assert.equal(result.outcome, "fail");
  const cashCheck = result.checks.find((c) => c.checkId === "cash-interest-bearing");
  assert.equal(cashCheck.result, "fail");
});

test("screening: fail when impure income ratio exceeds 5%", () => {
  const evidence = makeEvidence({
    financials: {
      ...makeEvidence().financials,
      impureIncome: 5_000_000_000,
      totalRevenue: 40_000_000_000,
    },
  });
  const result = screenCompany(evidence);

  assert.equal(result.outcome, "fail");
  const impureCheck = result.checks.find((c) => c.checkId === "impure-income");
  assert.equal(impureCheck.result, "fail");
});

test("screening: fail when accounts receivable ratio exceeds 49%", () => {
  const evidence = makeEvidence({
    financials: {
      ...makeEvidence().financials,
      accountsReceivable: 60_000_000_000,
      marketCap: 100_000_000_000,
    },
  });
  const result = screenCompany(evidence);

  assert.equal(result.outcome, "fail");
  const arCheck = result.checks.find((c) => c.checkId === "accounts-receivable");
  assert.equal(arCheck.result, "fail");
});

// ===== BOUNDARY CONDITIONS =====

test("screening: pass at exactly 33% debt ratio", () => {
  const evidence = makeEvidence({
    financials: {
      ...makeEvidence().financials,
      interestBearingDebt: 33_000_000_000,
      marketCap: 100_000_000_000,
    },
  });
  const debtCheck = screenCompany(evidence).checks.find((c) => c.checkId === "debt-ratio");
  assert.equal(debtCheck.result, "pass");
});

test("screening: pass at exactly 5% impure income", () => {
  const evidence = makeEvidence({
    financials: {
      ...makeEvidence().financials,
      impureIncome: 2_000_000_000,
      totalRevenue: 40_000_000_000,
    },
  });
  const impureCheck = screenCompany(evidence).checks.find((c) => c.checkId === "impure-income");
  assert.equal(impureCheck.result, "pass");
});

// ===== MISSING DATA =====

test("screening: insufficient evidence when financials are null", () => {
  const evidence = makeEvidence({ financials: null });
  const result = screenCompany(evidence);

  assert.equal(result.outcome, "insufficient_or_stale_evidence");
  assert.ok(result.missingFields.length > 0);
});

test("screening: insufficient evidence when business activity is missing", () => {
  const evidence = makeEvidence({ businessActivity: null });
  const result = screenCompany(evidence);

  assert.equal(result.outcome, "insufficient_or_stale_evidence");
  const businessCheck = result.checks.find((c) => c.checkId === "business-activity");
  assert.equal(businessCheck.result, "insufficient_data");
});

test("screening: insufficient evidence for partially missing financials", () => {
  const evidence = makeEvidence({
    financials: {
      marketCap: 100_000_000_000,
      totalAssets: null,
      interestBearingDebt: null,
      cashAndInterestBearingSecurities: null,
      accountsReceivable: null,
      totalRevenue: 40_000_000_000,
      impureIncome: 500_000_000,
      periodEnd: new Date().toISOString().split("T")[0],
      source: "test",
    },
  });
  const result = screenCompany(evidence);

  assert.equal(result.outcome, "insufficient_or_stale_evidence");
  assert.ok(result.missingFields.includes("interestBearingDebt"));
});

test("screening: missing periodEnd triggers staleness insufficient_data", () => {
  const evidence = makeEvidence({
    financials: {
      ...makeEvidence().financials,
      periodEnd: undefined,
    },
  });
  const result = screenCompany(evidence);

  const stalenessCheck = result.checks.find((c) => c.checkId === "data-staleness");
  assert.equal(stalenessCheck.result, "insufficient_data");
});

// ===== STALE DATA =====

test("screening: stale data triggers needs_review", () => {
  const evidence = makeEvidence({
    financials: {
      ...makeEvidence().financials,
      periodEnd: "2024-01-01",
    },
  });
  const result = screenCompany(evidence);

  const stalenessCheck = result.checks.find((c) => c.checkId === "data-staleness");
  assert.equal(stalenessCheck.result, "needs_review");
  assert.ok(stalenessCheck.value > 365);
});

// ===== OUTPUT SHAPE =====

test("screening: result contains all required fields", () => {
  const result = screenCompany(makeEvidence());

  assert.ok(["pass", "fail", "needs_review", "insufficient_or_stale_evidence"].includes(result.outcome));
  assert.equal(typeof result.ticker, "string");
  assert.equal(typeof result.companyName, "string");
  assert.ok(result.methodology);
  assert.ok(result.methodology.id);
  assert.ok(result.methodology.version);
  assert.ok(result.methodology.name);
  assert.equal(typeof result.screenedAt, "string");
  assert.ok(Array.isArray(result.checks));
  assert.ok(Array.isArray(result.missingFields));
  assert.equal(typeof result.disclaimer, "string");
});

test("screening: each check has required shape", () => {
  const result = screenCompany(makeEvidence());

  for (const check of result.checks) {
    assert.equal(typeof check.checkId, "string");
    assert.equal(typeof check.label, "string");
    assert.ok(["pass", "fail", "needs_review", "insufficient_data"].includes(check.result));
    assert.equal(typeof check.reason, "string");
    assert.ok("value" in check);
    assert.ok("threshold" in check);
  }
});
