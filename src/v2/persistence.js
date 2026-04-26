import fs from "fs";
import path from "path";

const RUNS_DIR = path.join(process.cwd(), "runs");

export function persistRun(result) {
  fs.mkdirSync(RUNS_DIR, { recursive: true });
  const filePath = path.join(RUNS_DIR, `${result.run_id}_state.v2.json`);
  fs.writeFileSync(filePath, JSON.stringify(result, null, 2));
  return filePath;
}

export function getRunById(runId) {
  const filePath = path.join(RUNS_DIR, `${runId}_state.v2.json`);
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}
