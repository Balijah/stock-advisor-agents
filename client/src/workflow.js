export const stageOrder = [
  "candidate_discovery",
  "candidate_validation",
  "enrich",
  "score",
  "risk_allocate",
  "explain",
];

export function reduceWorkflow(state, evt) {
  const next = { ...state, events: [...state.events, evt] };

  if (evt.event_type === "run_started") next.runStatus = "running";
  if (evt.event_type === "run_completed") next.runStatus = "completed";
  if (evt.event_type === "run_failed") next.runStatus = "failed";

  if (evt.stage && evt.stage !== "run") {
    next.stageStatuses = {
      ...next.stageStatuses,
      [evt.stage]: {
        status: evt.status || next.stageStatuses[evt.stage]?.status || "pending",
        duration_ms: evt.duration_ms ?? next.stageStatuses[evt.stage]?.duration_ms,
        warning_count: evt.warning_count ?? next.stageStatuses[evt.stage]?.warning_count ?? 0,
      },
    };
  }

  if (evt.metrics && typeof evt.metrics === "object") {
    next.metrics = { ...next.metrics, ...evt.metrics };
  }

  if (evt.stage && evt.status === "running") next.currentStage = evt.stage;
  return next;
}

export function initialWorkflowState() {
  return {
    runStatus: "queued",
    currentStage: "queued",
    events: [],
    stageStatuses: Object.fromEntries(stageOrder.map((s) => [s, { status: "pending", warning_count: 0 }])),
    metrics: {
      discovered_count: 0,
      validated_count: 0,
      enriched_count: 0,
      excluded_by_sector: 0,
    },
  };
}
