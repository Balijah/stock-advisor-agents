import test from "node:test";
import assert from "node:assert/strict";
import { initialWorkflowState, reduceWorkflow } from "../client/src/workflow.js";

test("workflow reducer updates stage status and metrics", () => {
  const init = initialWorkflowState();
  const s1 = reduceWorkflow(init, {
    event_type: "stage_started",
    stage: "candidate_discovery",
    status: "running",
  });
  const s2 = reduceWorkflow(s1, {
    event_type: "stage_completed",
    stage: "candidate_discovery",
    status: "success",
    duration_ms: 120,
    warning_count: 0,
    metrics: { discovered_count: 75 },
  });

  assert.equal(s2.stageStatuses.candidate_discovery.status, "success");
  assert.equal(s2.stageStatuses.candidate_discovery.duration_ms, 120);
  assert.equal(s2.metrics.discovered_count, 75);
});
