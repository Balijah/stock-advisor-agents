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
      LIVE_DATA: process.env.LIVE_DATA === "true",
      POLYGON_API_KEY: Boolean(process.env.POLYGON_API_KEY),
      XAI_API_KEY: Boolean(process.env.XAI_API_KEY),
      OPENAI_API_KEY: Boolean(process.env.OPENAI_API_KEY),
    },
  };
}
