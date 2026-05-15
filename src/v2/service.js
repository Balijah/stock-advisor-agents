import crypto from "crypto";
import { runAdvisoryV2 } from "./advisoryEngine.js";
import { getRunById as readRunById } from "./persistence.js";
import {
  attachError,
  attachResult,
  createRun,
  getRun,
  publishEvent,
  setRunStatus,
} from "./runRegistry.js";

export async function analyzeV2(input) {
  return runAdvisoryV2(input);
}

export function startRunV2(input) {
  const runId = crypto.randomBytes(8).toString("hex");
  createRun(runId, input);
  queueMicrotask(async () => {
    try {
      setRunStatus(runId, "running");
      publishEvent(runId, { event_type: "run_started", stage: "run", status: "running", message: "Run started" });
      const result = await runAdvisoryV2(input, {
        runId,
        emitEvent: (evt) => publishEvent(runId, evt),
      });
      attachResult(runId, result);
      setRunStatus(runId, "completed");
    } catch (err) {
      attachError(runId, err);
      setRunStatus(runId, "failed");
      publishEvent(runId, {
        event_type: "run_failed",
        stage: "run",
        status: "failed",
        message: err?.message || "Run failed",
      });
    }
  });

  return { run_id: runId, status: "queued" };
}

export function getRunStatus(runId) {
  const run = getRun(runId);
  if (!run) return null;
  return {
    run_id: run.run_id,
    status: run.status,
    created_at: run.created_at,
    started_at: run.started_at,
    completed_at: run.completed_at,
    error: run.error,
    result: run.result,
  };
}

export function getPersistedRunById(runId) {
  return readRunById(runId);
}

export function getHealth() {
  return {
    status: "ok",
    time: new Date().toISOString(),
    env: {
      OPENAI_API_KEY: Boolean(process.env.OPENAI_API_KEY),
      ANTHROPIC_API_KEY: Boolean(process.env.ANTHROPIC_API_KEY),
    },
  };
}
