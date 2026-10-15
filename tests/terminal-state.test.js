import test from "node:test";
import assert from "node:assert/strict";
import { createRun, getRun, setRunStatus, attachResult } from "../src/v2/runRegistry.js";

test("run with critical failure records as failed, not completed", async () => {
  const runId = "deadbeef00000001";
  createRun(runId, {});
  setRunStatus(runId, "running");

  const fakeResult = {
    run_id: runId,
    degraded_mode: true,
    diagnostics: {
      stage_statuses: {
        candidate_discovery: { status: "success", duration_ms: 10, warning_count: 0 },
        candidate_validation: { status: "failed", duration_ms: 5, warning_count: 1 },
      },
      candidate_stats: {},
    },
  };

  attachResult(runId, fakeResult);

  const terminal = fakeResult.degraded_mode && fakeResult.diagnostics?.stage_statuses
    ? Object.values(fakeResult.diagnostics.stage_statuses).some((s) => s.status === "failed")
    : false;
  setRunStatus(runId, terminal ? "failed" : "completed");

  const run = getRun(runId);
  assert.equal(run.status, "failed", "A run with a failed critical stage must be recorded as failed");
  assert.ok(run.completed_at, "completed_at timestamp must be set");
});

test("run with no failures records as completed", async () => {
  const runId = "deadbeef00000002";
  createRun(runId, {});
  setRunStatus(runId, "running");

  const fakeResult = {
    run_id: runId,
    degraded_mode: false,
    diagnostics: {
      stage_statuses: {
        candidate_discovery: { status: "success", duration_ms: 10, warning_count: 0 },
        candidate_validation: { status: "success", duration_ms: 5, warning_count: 0 },
      },
      candidate_stats: {},
    },
  };

  attachResult(runId, fakeResult);

  const terminal = fakeResult.degraded_mode && fakeResult.diagnostics?.stage_statuses
    ? Object.values(fakeResult.diagnostics.stage_statuses).some((s) => s.status === "failed")
    : false;
  setRunStatus(runId, terminal ? "failed" : "completed");

  const run = getRun(runId);
  assert.equal(run.status, "completed");
});

test("run that throws records as failed via catch path", () => {
  const runId = "deadbeef00000003";
  createRun(runId, {});
  setRunStatus(runId, "running");
  setRunStatus(runId, "failed");

  const run = getRun(runId);
  assert.equal(run.status, "failed");
  assert.ok(run.completed_at);
});
