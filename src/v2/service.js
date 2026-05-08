import { runAdvisoryV2 } from "./advisoryEngine.js";
import { getRunById as readRunById } from "./persistence.js";

export async function analyzeV2(input) {
  return runAdvisoryV2(input);
}

export function getRunById(runId) {
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
