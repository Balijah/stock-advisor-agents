export class Coordinator {
  constructor({ runId, userInput }) {
    this.context = {
      run_id: runId,
      user_input: userInput,
      artifacts: {
        discovered_candidates: [],
        validated_candidates: [],
        rejected_candidates: [],
        tickers: [],
        names: {},
        fundamentals: {},
        technicals: {},
        macro: { vix_level: 18 },
        social_news: {},
        ranked: [],
        allocated: [],
        portfolio: [],
      },
      warnings: [],
      transcript: [],
      stage_statuses: {},
      provider_health: {},
      hard_failed: false,
    };
  }

  log(stage, message) {
    this.context.transcript.push({
      timestamp: new Date().toISOString(),
      stage,
      message,
    });
  }

  addWarnings(warnings = []) {
    this.context.warnings.push(...warnings.filter(Boolean));
  }

  setStageStatus(stage, payload) {
    this.context.stage_statuses[stage] = payload;
  }

  setProviderHealth(health = {}) {
    this.context.provider_health = health;
  }

  candidateStats() {
    return {
      discovered_count: this.context.artifacts.discovered_candidates.length,
      validated_count: this.context.artifacts.validated_candidates.length,
      enriched_count: this.context.artifacts.tickers.length,
      excluded_by_sector: this.context.artifacts.rejected_candidates.filter(
        (r) => r.reason === "sector_mismatch"
      ).length,
    };
  }
}

export async function runStage(coordinator, stageName, fn, { critical = false } = {}) {
  const start = Date.now();
  coordinator.log(stageName, `${stageName} started`);

  try {
    const result = await fn(coordinator.context);
    const warnings = result?.warnings || [];
    coordinator.addWarnings(warnings);

    const status = warnings.length ? "degraded" : "success";
    coordinator.setStageStatus(stageName, {
      status,
      duration_ms: Date.now() - start,
      warning_count: warnings.length,
    });

    coordinator.log(stageName, `${stageName} ${status}`);
    return { status, result };
  } catch (err) {
    const warning = `${stageName}: ${err?.message || "stage failure"}`;
    coordinator.addWarnings([warning]);

    const status = critical ? "failed" : "degraded";
    coordinator.setStageStatus(stageName, {
      status,
      duration_ms: Date.now() - start,
      warning_count: 1,
    });
    coordinator.log(stageName, `${stageName} ${status}`);

    if (critical) coordinator.context.hard_failed = true;
    return { status, result: null };
  }
}
