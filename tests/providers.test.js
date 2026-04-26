import test from "node:test";
import assert from "node:assert/strict";
import { MarketProvider } from "../src/v2/providers/marketProvider.js";

test("provider returns health map", async () => {
  const provider = new MarketProvider();
  const scan = await provider.getCandidates({ preferred_sectors: [], min_volume: 500000, num_stocks_requested: 5 });
  assert.ok(Array.isArray(scan.tickers));
  assert.ok(provider.getHealth().market !== undefined);
});
