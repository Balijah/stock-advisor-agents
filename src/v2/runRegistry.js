const runs = new Map();

function nowIso() {
  return new Date().toISOString();
}

export function createRun(runId, input) {
  const run = {
    run_id: runId,
    input,
    status: "queued",
    created_at: nowIso(),
    started_at: null,
    completed_at: null,
    result: null,
    error: null,
    events: [],
    subscribers: new Set(),
  };
  runs.set(runId, run);
  return run;
}

export function getRun(runId) {
  return runs.get(runId) || null;
}

export function setRunStatus(runId, status) {
  const run = getRun(runId);
  if (!run) return;
  run.status = status;
  if (status === "running") run.started_at = run.started_at || nowIso();
  if (status === "completed" || status === "failed") run.completed_at = nowIso();
}

export function attachResult(runId, result) {
  const run = getRun(runId);
  if (!run) return;
  run.result = result;
}

export function attachError(runId, error) {
  const run = getRun(runId);
  if (!run) return;
  run.error = error?.message || String(error);
}

export function publishEvent(runId, event) {
  const run = getRun(runId);
  if (!run) return;
  const payload = {
    run_id: runId,
    timestamp: nowIso(),
    ...event,
  };
  run.events.push(payload);
  if (run.events.length > 300) run.events.shift();
  for (const res of run.subscribers) {
    res.write(`event: workflow\n`);
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  }
}

export function subscribe(runId, res) {
  const run = getRun(runId);
  if (!run) return null;
  run.subscribers.add(res);
  run.events.forEach((evt) => {
    res.write(`event: workflow\n`);
    res.write(`data: ${JSON.stringify(evt)}\n\n`);
  });
  return () => run.subscribers.delete(res);
}
