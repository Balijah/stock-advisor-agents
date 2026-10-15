import test from "node:test";
import assert from "node:assert/strict";
import { DemoFixtureProvider } from "../src/providers/demoFixtures.js";
import { EvidenceProvider } from "../src/providers/interface.js";

test("DemoFixtureProvider extends EvidenceProvider", () => {
  const p = new DemoFixtureProvider();
  assert.ok(p instanceof EvidenceProvider);
});

test("DemoFixtureProvider is marked as demo", () => {
  const p = new DemoFixtureProvider();
  assert.equal(p.isDemo, true);
  assert.ok(p.name.toLowerCase().includes("demo"));
});

test("DemoFixtureProvider.listTickers returns 20+ companies", () => {
  const p = new DemoFixtureProvider();
  const tickers = p.listTickers();
  assert.ok(tickers.length >= 20, `Expected >= 20 tickers, got ${tickers.length}`);
  for (const entry of tickers) {
    assert.ok(entry.ticker);
    assert.ok(entry.companyName);
  }
});

test("DemoFixtureProvider.lookupTicker finds known ticker", () => {
  const p = new DemoFixtureProvider();
  const hit = p.lookupTicker("AAPL");
  assert.ok(hit);
  assert.equal(hit.ticker, "AAPL");
  assert.equal(hit.companyName, "Apple Inc");
});

test("DemoFixtureProvider.lookupTicker is case-insensitive", () => {
  const p = new DemoFixtureProvider();
  assert.ok(p.lookupTicker("aapl"));
  assert.ok(p.lookupTicker("Aapl"));
  assert.ok(p.lookupTicker(" AAPL "));
});

test("DemoFixtureProvider.lookupTicker returns null for unknown", () => {
  const p = new DemoFixtureProvider();
  assert.equal(p.lookupTicker("ZZZZZ"), null);
  assert.equal(p.lookupTicker(""), null);
  assert.equal(p.lookupTicker(null), null);
});

test("DemoFixtureProvider.getEvidence returns full evidence for known ticker", () => {
  const p = new DemoFixtureProvider();
  const ev = p.getEvidence("MSFT");
  assert.ok(ev);
  assert.equal(ev.ticker, "MSFT");
  assert.ok(ev.businessActivity);
  assert.ok(ev.financials);
  assert.ok(ev.financials.marketCap > 0);
  assert.ok(ev.financials.periodEnd);
  assert.equal(ev.financials.source, "demo-fixture");
});

test("DemoFixtureProvider.getEvidence returns null for unknown", () => {
  const p = new DemoFixtureProvider();
  assert.equal(p.getEvidence("ZZZZZ"), null);
});

test("DemoFixtureProvider contains clear pass companies", () => {
  const p = new DemoFixtureProvider();
  for (const ticker of ["MSFT", "AAPL", "JNJ", "NVDA", "GOOGL"]) {
    const ev = p.getEvidence(ticker);
    assert.ok(ev, `Missing fixture for ${ticker}`);
    assert.ok(ev.businessActivity);
    assert.ok(ev.financials);
  }
});

test("DemoFixtureProvider contains clear fail companies", () => {
  const p = new DemoFixtureProvider();
  for (const ticker of ["JPM", "BAC", "DEO", "PM", "MGM"]) {
    const ev = p.getEvidence(ticker);
    assert.ok(ev, `Missing fixture for ${ticker}`);
  }
});

test("DemoFixtureProvider contains ambiguous/review companies", () => {
  const p = new DemoFixtureProvider();
  for (const ticker of ["DIS", "MAR", "BRK.B"]) {
    const ev = p.getEvidence(ticker);
    assert.ok(ev, `Missing fixture for ${ticker}`);
  }
});

test("DemoFixtureProvider contains missing-evidence companies", () => {
  const p = new DemoFixtureProvider();

  const noData = p.getEvidence("NODATA");
  assert.ok(noData);
  assert.equal(noData.financials, null);

  const partial = p.getEvidence("PARTIAL");
  assert.ok(partial);
  assert.equal(partial.financials.interestBearingDebt, null);

  const noClass = p.getEvidence("NOCLASS");
  assert.ok(noClass);
  assert.equal(noClass.businessActivity, null);
});

test("EvidenceProvider base class throws on unimplemented methods", () => {
  const base = new EvidenceProvider();
  assert.throws(() => base.lookupTicker("X"));
  assert.throws(() => base.listTickers());
  assert.throws(() => base.getEvidence("X"));
});
