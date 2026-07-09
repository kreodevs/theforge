/**
 * Builds a ChangePlan JSON from The Forge stage/project deliverables for Ariadne Gate 2.
 */
import { parseTasksMarkdown } from "../tasks-parse.js";
import {
  CHANGE_PLAN_SCHEMA_VERSION,
  type ChangePlan,
  type ChangePlanFile,
  type ChangePlanTask,
  type BuildChangePlanInput,
} from "./change-plan.types.js";

const TASK_ID_RE = /T-\d+/i;
const FUNC_LINE_RE = /\*\*Funci[oó]n:\*\*\s*([^\n]+)/i;
const ENDPOINT_LINE_RE = /\*\*Endpoint:\*\*\s*([A-Z]+)\s+(\S+)/i;

function normalizePath(p: string): string {
  return p.replace(/\\/g, "/").replace(/^\/+/, "").trim();
}

function parseSymbolsFromTaskBlock(block: string): string[] {
  const m = block.match(FUNC_LINE_RE);
  if (!m?.[1]) return [];
  return m[1]
    .split(/[,/|]/)
    .map((s) => s.replace(/[()`]/g, "").trim())
    .filter((s) => s.length > 1 && /^[A-Za-z]/.test(s));
}

function parseTaskId(title: string, block: string): string | undefined {
  const fromTitle = title.match(TASK_ID_RE)?.[0];
  if (fromTitle) return fromTitle.toUpperCase();
  const fromBlock = block.match(/^##\s+(T-\d+)/im)?.[1];
  return fromBlock?.toUpperCase();
}

function extractApiChanges(apiMd: string): ChangePlan["apiChanges"] {
  const changes: NonNullable<ChangePlan["apiChanges"]> = [];
  const seen = new Set<string>();
  for (const line of (apiMd ?? "").split("\n")) {
    const m = line.match(/^\|\s*(GET|POST|PUT|PATCH|DELETE)\s*\|\s*`?([^`|]+)`?\s*\|/i);
    if (!m?.[1] || !m[2]) continue;
    const method = m[1].toUpperCase();
    const path = m[2].trim();
    const key = `${method} ${path}`;
    if (seen.has(key)) continue;
    seen.add(key);
    changes.push({ method, path, changeType: "modify" });
  }
  return changes.slice(0, 80);
}

function readChangeScope(raw: unknown): ChangePlan["changeScope"] | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const scope = (raw as Record<string, unknown>).changeScope;
  if (!scope || typeof scope !== "object") return undefined;
  const s = scope as Record<string, unknown>;
  const description = String(s.description ?? "").trim();
  if (!description) return undefined;
  return scope as ChangePlan["changeScope"];
}

function readReferencePlan(raw: unknown): ChangePlan["referencePlan"] | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const state = raw as Record<string, unknown>;
  const files = state.filesToModify;
  if (!Array.isArray(files) || files.length === 0) return undefined;
  const filesToModify: Array<{ path: string; repoId?: string }> = [];
  for (const f of files) {
    if (typeof f === "string" && f.trim()) {
      filesToModify.push({ path: normalizePath(f) });
      continue;
    }
    if (f && typeof f === "object") {
      const o = f as Record<string, unknown>;
      const path = String(o.path ?? "").trim();
      if (path) {
        filesToModify.push({
          path: normalizePath(path),
          repoId: o.repoId ? String(o.repoId) : undefined,
        });
      }
    }
  }
  return filesToModify.length ? { filesToModify } : undefined;
}

/**
 * Builds ChangePlan from deliverables + legacy change state for validate_change_plan MCP.
 */
export function buildChangePlanFromProject(input: BuildChangePlanInput): ChangePlan | null {
  const projectId = input.theforgeProjectId?.trim();
  if (!projectId) return null;

  const tasksMd = input.tasksContent ?? "";
  const parsedTasks = parseTasksMarkdown(tasksMd);
  const lines = tasksMd.split("\n");

  const fileMap = new Map<string, ChangePlanFile>();
  const planTasks: ChangePlanTask[] = [];

  for (const item of parsedTasks) {
    const start = Math.max(0, item.line - 1);
    const blockLines: string[] = [lines[start] ?? ""];
    for (
      let j = start + 1;
      j < lines.length && !lines[j]?.match(/^- \[( |x|X)\]/) && !lines[j]?.match(/^## /);
      j++
    ) {
      blockLines.push(lines[j] ?? "");
    }
    const block = blockLines.join("\n");
    const symbols = parseSymbolsFromTaskBlock(block);
    const endpoints: string[] = [];
    const epMatch = block.match(ENDPOINT_LINE_RE);
    if (epMatch?.[1] && epMatch[2]) {
      endpoints.push(`${epMatch[1].toUpperCase()} ${epMatch[2].trim()}`);
    }

    for (const fp of item.filePaths) {
      const path = normalizePath(fp);
      const existing = fileMap.get(path) ?? {
        path,
        changeType: "modify" as const,
        symbols: [] as string[],
      };
      for (const sym of symbols) {
        if (!existing.symbols!.includes(sym)) existing.symbols!.push(sym);
      }
      fileMap.set(path, existing);
    }

    planTasks.push({
      id: parseTaskId(item.title, block),
      title: item.cleanTitle || item.title,
      files: item.filePaths.map(normalizePath),
      symbols,
      endpoints,
    });
  }

  const legacy = input.legacyChangeState;
  const refPlan = readReferencePlan(legacy);
  if (refPlan) {
    for (const f of refPlan.filesToModify) {
      if (!fileMap.has(f.path)) {
        fileMap.set(f.path, { path: f.path, repoId: f.repoId, changeType: "modify" });
      }
    }
  }

  const files = [...fileMap.values()];
  if (files.length === 0) return null;

  const changeScope = readChangeScope(legacy);
  const stateObj =
    legacy && typeof legacy === "object" ? (legacy as Record<string, unknown>) : {};
  const changeDescription =
    changeScope?.description || String(stateObj.description ?? "").trim() || undefined;

  return {
    schemaVersion: CHANGE_PLAN_SCHEMA_VERSION,
    projectId,
    source: "theforge",
    changeDescription,
    changeScope,
    files,
    apiChanges: extractApiChanges(input.apiContractsContent ?? ""),
    tasks: planTasks.length ? planTasks : undefined,
    referencePlan: refPlan,
  };
}

/** True when project has codebase link (brownfield-capable for Gate 2). */
export function isBrownfieldCapable(theforgeProjectId?: string | null): boolean {
  return Boolean(theforgeProjectId?.trim());
}
