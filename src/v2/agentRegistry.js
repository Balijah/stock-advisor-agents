import {
  candidateDiscoveryAgent,
  candidateValidationAgent,
  enrichAgent,
  explainAgent,
  riskAllocateAgent,
  scoringAgent,
} from "./agents.js";

export function buildAgentRegistry() {
  return {
    candidate_discovery: candidateDiscoveryAgent,
    candidate_validation: candidateValidationAgent,
    enrich: enrichAgent,
    score: scoringAgent,
    risk_allocate: riskAllocateAgent,
    explain: explainAgent,
  };
}
