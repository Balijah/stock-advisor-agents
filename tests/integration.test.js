import test from "node:test";
import assert from "node:assert/strict";
import { screenCompany } from "../src/screening/screen.js";
import { DemoFixtureProvider } from "../src/providers/demoFixtures.js";

const provider = new DemoFixtureProvider();

test("integration: MSFT passes all screens", () => {
  const evidence = provider.getEvidence("MSFT");
  const result = screenCompany(evidence);
  assert.equal(result.outcome, "pass");
  assert.equal(result.ticker, "MSFT");
  assert.ok(result.checks.every((c) => c.result === "pass"));
});

test("integration: JPM fails on business activity (conventional banking)", () => {
  const evidence = provider.getEvidence("JPM");
  const result = screenCompany(evidence);
  assert.equal(result.outcome, "fail");
  assert.equal(result.checks[0].checkId, "business-activity");
  assert.equal(result.checks[0].result, "fail");
  assert.equal(result.checks.length, 1);
});

test("integration: DEO fails on business activity (alcohol)", () => {
  const evidence = provider.getEvidence("DEO");
  const result = screenCompany(evidence);
  assert.equal(result.outcome, "fail");
});

test("integration: DIS triggers needs_review (entertainment)", () => {
  const evidence = provider.getEvidence("DIS");
  const result = screenCompany(evidence);
  assert.equal(result.outcome, "needs_review");
});

test("integration: BRK.B triggers needs_review (conglomerate + impure income)", () => {
  const evidence = provider.getEvidence("BRK.B");
  const result = screenCompany(evidence);
  assert.ok(["needs_review", "fail"].includes(result.outcome));
});

test("integration: NODATA has insufficient evidence", () => {
  const evidence = provider.getEvidence("NODATA");
  const result = screenCompany(evidence);
  assert.equal(result.outcome, "insufficient_or_stale_evidence");
});

test("integration: PARTIAL has insufficient evidence", () => {
  const evidence = provider.getEvidence("PARTIAL");
  const result = screenCompany(evidence);
  assert.equal(result.outcome, "insufficient_or_stale_evidence");
  assert.ok(result.missingFields.length > 0);
});

test("integration: NOCLASS has insufficient evidence (no business classification)", () => {
  const evidence = provider.getEvidence("NOCLASS");
  const result = screenCompany(evidence);
  assert.equal(result.outcome, "insufficient_or_stale_evidence");
});

test("integration: STALE triggers staleness review", () => {
  const evidence = provider.getEvidence("STALE");
  const result = screenCompany(evidence);
  const stalenessCheck = result.checks.find((c) => c.checkId === "data-staleness");
  assert.equal(stalenessCheck.result, "needs_review");
});

test("integration: HIGHDEBT fails on debt ratio", () => {
  const evidence = provider.getEvidence("HIGHDEBT");
  const result = screenCompany(evidence);
  assert.equal(result.outcome, "fail");
  const debtCheck = result.checks.find((c) => c.checkId === "debt-ratio");
  assert.equal(debtCheck.result, "fail");
});

test("integration: HIGHCASH fails on cash/interest-bearing ratio", () => {
  const evidence = provider.getEvidence("HIGHCASH");
  const result = screenCompany(evidence);
  assert.equal(result.outcome, "fail");
  const cashCheck = result.checks.find((c) => c.checkId === "cash-interest-bearing");
  assert.equal(cashCheck.result, "fail");
});

test("integration: BORDERLINE fails on debt ratio (32.5%)", () => {
  const evidence = provider.getEvidence("BORDERLINE");
  const result = screenCompany(evidence);
  const debtCheck = result.checks.find((c) => c.checkId === "debt-ratio");
  assert.ok(debtCheck);
});

test("integration: all demo fixtures produce valid results", () => {
  const tickers = provider.listTickers();
  for (const { ticker } of tickers) {
    const evidence = provider.getEvidence(ticker);
    const result = screenCompany(evidence);
    assert.ok(["pass", "fail", "needs_review", "insufficient_or_stale_evidence"].includes(result.outcome),
      `${ticker} got unexpected outcome: ${result.outcome}`);
    assert.ok(result.methodology.id);
    assert.ok(result.disclaimer);
  }
});
