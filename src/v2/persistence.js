import fs from "fs";
import path from "path";

const RUNS_DIR = path.join(process.cwd(), "runs");

const RUN_ID_RE = /^[0-9a-f]{16}$/;

export function isValidRunId(id) {
  return typeof id === "string" && RUN_ID_RE.test(id);
}

function safeRunPath(runId) {
  if (!isValidRunId(runId)) {
    throw new Error(`Invalid run ID: ${runId}`);
  }
  const filePath = path.join(RUNS_DIR, `${runId}_state.v2.json`);
  const resolved = path.resolve(filePath);
  if (!resolved.startsWith(path.resolve(RUNS_DIR) + path.sep)) {
    throw new Error(`Path traversal blocked for run ID: ${runId}`);
  }
  return resolved;
}

export function persistRun(result) {
  fs.mkdirSync(RUNS_DIR, { recursive: true });
  const filePath = safeRunPath(result.run_id);
  fs.writeFileSync(filePath, JSON.stringify(result, null, 2));
  return filePath;
}

export function getRunById(runId) {
  let filePath;
  try {
    filePath = safeRunPath(runId);
  } catch {
    return null;
  }
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}
