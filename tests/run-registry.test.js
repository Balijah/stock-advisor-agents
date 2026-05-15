import test from "node:test";
import assert from "node:assert/strict";
import { createRun, getRun, publishEvent } from "../src/v2/runRegistry.js";

test("run registry stores and publishes events", () => {
  createRun("abc123", { risk_tolerance: "neutral" });
  publishEvent("abc123", { event_type: "run_started", status: "running" });
  const run = getRun("abc123");
  assert.ok(run);
  assert.equal(run.events.length, 1);
  assert.equal(run.events[0].event_type, "run_started");
});
