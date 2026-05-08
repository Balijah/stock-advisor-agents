import test from "node:test";
import assert from "node:assert/strict";
import { Coordinator, runStage } from "../src/v2/coordinator.js";

test("coordinator stage transitions: success and degraded", async () => {
  const c = new Coordinator({ runId: "r1", userInput: {} });

  await runStage(c, "a", async () => ({ warnings: [] }));
  await runStage(c, "b", async () => ({ warnings: ["warn"] }));

  assert.equal(c.context.stage_statuses.a.status, "success");
  assert.equal(c.context.stage_statuses.b.status, "degraded");
  assert.equal(c.context.warnings.length, 1);
});

test("coordinator hard-fails critical stage", async () => {
  const c = new Coordinator({ runId: "r2", userInput: {} });
  await runStage(c, "critical", async () => {
    throw new Error("boom");
  }, { critical: true });

  assert.equal(c.context.hard_failed, true);
  assert.equal(c.context.stage_statuses.critical.status, "failed");
});
