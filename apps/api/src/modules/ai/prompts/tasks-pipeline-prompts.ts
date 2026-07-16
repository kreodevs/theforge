import { readFileSync } from "node:fs";
import { join } from "node:path";

const PLANNER_PATH = join(__dirname, "tasks-planner-prompt.md");
const AUDITOR_PATH = join(__dirname, "tasks-auditor-prompt.md");
const REPAIR_PATH = join(__dirname, "tasks-repair-prompt.md");

function load(path: string, fallback: string): string {
  try {
    return readFileSync(path, "utf-8").trim();
  } catch {
    return fallback;
  }
}

export const TASKS_PLANNER_PROMPT = load(
  PLANNER_PATH,
  "Devuelve solo JSON con sections e items (T-001…) trazables al MDD.",
);

export const TASKS_AUDITOR_LLM_PROMPT = load(
  AUDITOR_PATH,
  "Devuelve solo JSON con score, passed y listas de gaps.",
);

export const TASKS_REPAIR_PROMPT = load(
  REPAIR_PATH,
  "Repara tasks.md según gaps; salida solo markdown.",
);
